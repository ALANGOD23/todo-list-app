// Doctor IA — servidor Node.js
// Sirve la web estática de /public y expone /api/chat, que conversa con Claude
// (con búsqueda web) mediante Server-Sent Events.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";

const here = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(here, "public");
const PORT = Number(process.env.PORT) || 3000;
const MODEL = process.env.DOCTOR_MODEL || "claude-opus-5";
// Chat interactivo: "medium" equilibra calidad y latencia. Súbelo a "high" si prefieres respuestas más profundas.
const EFFORT = process.env.DOCTOR_EFFORT || "medium";
const MAX_BODY_BYTES = 8 * 1024 * 1024; // permite adjuntar una imagen
const MAX_HISTORY = 20;
const RATE_LIMIT_PER_MIN = Number(process.env.RATE_LIMIT_PER_MIN) || 15;

loadDotEnv(path.join(here, ".env"));

const hasCredentials = Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
const client = hasCredentials ? new Anthropic() : null;

const SYSTEM_PROMPT = `Eres "Dr. IA", un asistente médico educativo que conoce enfermedades de todas las especialidades: oncología, cardiología, infectología, neurología, salud mental, pediatría, dermatología, endocrinología y más. Hablas con calidez, claridad y rigor, como un buen médico de familia que explica las cosas sin tecnicismos innecesarios.

Tu papel y sus límites:
- Das información médica general basada en evidencia. No eres un médico humano, no examinas a la persona y no puedes dar un diagnóstico definitivo ni sustituir una consulta. Dilo con naturalidad cuando sea relevante, sin repetirlo en cada mensaje.
- Cuando alguien describe síntomas, pregunta lo que un médico preguntaría (edad, desde cuándo, intensidad, otros síntomas, enfermedades previas, medicamentos) antes de sugerir posibilidades. Presenta las causas posibles de más a menos probable y explica qué las distingue.
- Termina las consultas sobre síntomas con una orientación clara del nivel de urgencia: autocuidado, consulta programada, consulta en 24-48 h, o urgencias ya.
- Si aparecen señales de alarma (dolor u opresión en el pecho, falta de aire intensa, signos de ictus como cara caída, brazo débil o habla alterada, sangrado abundante, pérdida de conciencia, convulsiones, fiebre alta con rigidez de nuca o manchas que no desaparecen al presionar, reacción alérgica grave, dolor abdominal súbito e intenso, ideas de suicidio o de hacerse daño), empieza la respuesta indicando que llame a emergencias (112 en Europa y gran parte de Latinoamérica, 911 en México, EE. UU. y otros países) o acuda a urgencias de inmediato.
- Ante ideas de suicidio o autolesión, responde con empatía, anima a hablar con alguien de confianza y a contactar una línea de crisis o emergencias locales, y mantén la conversación.
- Sobre medicamentos puedes explicar para qué sirven, cómo actúan y sus efectos secundarios frecuentes. Para dosis concretas remite al prospecto, al farmacéutico o al médico, y nunca animes a suspender un tratamiento prescrito por tu cuenta.
- Sobre el cáncer y otras enfermedades graves, sé honesto con los datos (supervivencia, tratamientos) y a la vez humano. Menciona que el pronóstico depende del tipo, estadio y la persona.
- Desmiente con respeto las "curas milagro" y los tratamientos sin evidencia, y explica por qué pueden ser peligrosos.

Búsqueda web:
- Usa la herramienta de búsqueda web cuando necesites datos recientes (estadísticas, brotes, nuevos tratamientos o vacunas, guías clínicas actualizadas) o cuando pregunten por una enfermedad rara. Prioriza fuentes fiables: OMS, OPS, CDC, NIH/MedlinePlus, NHS, Mayo Clinic, sociedades médicas y revistas revisadas por pares.
- Al usar información de la web, menciona la fuente por su nombre.

Formato:
- Responde en el idioma del usuario (por defecto, español).
- Usa Markdown ligero: párrafos cortos, **negritas** para lo importante, listas con viñetas y títulos con ### cuando la respuesta tenga varias partes. Evita tablas.
- Sé completo pero conciso: ve al grano y no rellenes.`;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
};

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

// ---------------------------------------------------------------------------
// Utilidades

function loadDotEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]] !== undefined) continue;
    process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
  }
}

const rateBuckets = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const bucket = (rateBuckets.get(ip) || []).filter((t) => now - t < 60_000);
  bucket.push(now);
  rateBuckets.set(ip, bucket);
  return bucket.length > RATE_LIMIT_PER_MIN;
}

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": MIME[".json"] });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error("El mensaje es demasiado grande (máx. 8 MB)."), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

// Convierte el historial del navegador al formato de la API, validándolo.
function toApiMessages(history) {
  if (!Array.isArray(history) || history.length === 0) {
    throw Object.assign(new Error("No hay mensajes."), { status: 400 });
  }
  const recent = history.slice(-MAX_HISTORY);
  // La conversación debe empezar con el usuario.
  while (recent.length && recent[0].role !== "user") recent.shift();

  return recent.map((msg) => {
    if (msg.role !== "user" && msg.role !== "assistant") {
      throw Object.assign(new Error("Rol de mensaje no válido."), { status: 400 });
    }
    const text = typeof msg.content === "string" ? msg.content.slice(0, 8000) : "";
    const content = [];
    if (msg.role === "user" && msg.image && ALLOWED_IMAGE_TYPES.has(msg.image.media_type)) {
      content.push({
        type: "image",
        source: { type: "base64", media_type: msg.image.media_type, data: String(msg.image.data) },
      });
    }
    content.push({ type: "text", text: text || "(imagen adjunta)" });
    return { role: msg.role, content };
  });
}

// ---------------------------------------------------------------------------
// Chat con Claude (SSE)

async function handleChat(req, res) {
  const ip = req.socket.remoteAddress || "unknown";
  if (rateLimited(ip)) {
    return sendJson(res, 429, { error: "Demasiadas consultas seguidas. Espera un minuto e inténtalo de nuevo." });
  }
  if (!client) {
    return sendJson(res, 503, {
      error: "La IA no está configurada. Añade ANTHROPIC_API_KEY en el archivo .env para activar al Dr. IA.",
    });
  }

  let messages;
  try {
    const body = JSON.parse(await readBody(req));
    messages = toApiMessages(body.messages);
  } catch (err) {
    return sendJson(res, err.status || 400, { error: err.status ? err.message : "Petición no válida." });
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  });
  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

  let aborted = false;
  let currentStream = null;
  res.on("close", () => {
    aborted = true;
    currentStream?.abort();
  });

  try {
    // Con búsqueda web el servidor puede pausar el turno (pause_turn); lo reanudamos.
    for (let round = 0; round < 4 && !aborted; round++) {
      currentStream = client.beta.messages.stream({
        model: MODEL,
        max_tokens: 64000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        thinking: { type: "adaptive" },
        output_config: { effort: EFFORT },
        system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
        tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 4 }],
        messages,
      });

      for await (const event of currentStream) {
        if (event.type === "content_block_start") {
          const block = event.content_block;
          if (block.type === "server_tool_use" && block.name === "web_search") {
            send("status", { text: "Buscando en fuentes médicas de la web…" });
          } else if (block.type === "web_search_tool_result" && Array.isArray(block.content)) {
            const sources = block.content
              .filter((r) => r.type === "web_search_result")
              .map((r) => ({ title: r.title, url: r.url }));
            if (sources.length) send("sources", { sources });
          } else if (block.type === "thinking") {
            send("status", { text: "Analizando tu consulta…" });
          }
        } else if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          send("text", { text: event.delta.text });
        }
      }

      const final = await currentStream.finalMessage();
      if (final.stop_reason === "pause_turn") {
        messages = [...messages, { role: "assistant", content: final.content }];
        continue;
      }
      if (final.stop_reason === "refusal") {
        send("text", {
          text: "\n\nLo siento, no puedo ayudar con esa solicitud. Si se trata de una urgencia, contacta con los servicios de emergencia de tu país.",
        });
      } else if (final.stop_reason === "max_tokens") {
        send("text", { text: "\n\n_(La respuesta se ha cortado por su longitud. Pídeme que continúe.)_" });
      }
      break;
    }
    send("done", {});
  } catch (err) {
    if (!aborted) send("error", { error: describeApiError(err) });
  } finally {
    res.end();
  }
}

function describeApiError(err) {
  if (err instanceof Anthropic.AuthenticationError) return "La clave de la API no es válida. Revisa ANTHROPIC_API_KEY.";
  if (err instanceof Anthropic.RateLimitError) return "El servicio de IA está saturado. Inténtalo en unos segundos.";
  if (err instanceof Anthropic.BadRequestError) return `Petición rechazada por la API: ${err.message}`;
  if (err instanceof Anthropic.APIConnectionError) return "No se pudo conectar con el servicio de IA. Revisa tu conexión.";
  if (err instanceof Anthropic.APIError) return `Error del servicio de IA (${err.status ?? "desconocido"}).`;
  console.error(err);
  return "Ha ocurrido un error inesperado.";
}

// ---------------------------------------------------------------------------
// Archivos estáticos

function serveStatic(req, res) {
  let urlPath;
  try {
    urlPath = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  } catch {
    res.writeHead(400);
    return res.end("URL no válida");
  }
  const filePath = path.normalize(path.join(PUBLIC_DIR, urlPath === "/" ? "index.html" : urlPath));
  if (!filePath.startsWith(PUBLIC_DIR + path.sep)) {
    res.writeHead(403);
    return res.end("Prohibido");
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end("No encontrado");
    }
    res.writeHead(200, { "Content-Type": MIME[path.extname(filePath)] || "application/octet-stream" });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  if (req.method === "GET" && req.url === "/api/status") {
    return sendJson(res, 200, { ai: Boolean(client), model: client ? MODEL : null });
  }
  if (req.method === "POST" && req.url === "/api/chat") {
    return handleChat(req, res);
  }
  if (req.method === "GET" || req.method === "HEAD") return serveStatic(req, res);
  res.writeHead(405);
  res.end();
});

server.listen(PORT, () => {
  console.log(`🩺 Doctor IA escuchando en http://localhost:${PORT}`);
  if (!client) console.log("⚠️  Sin ANTHROPIC_API_KEY: el chat funcionará en modo sin conexión (enciclopedia local).");
});
