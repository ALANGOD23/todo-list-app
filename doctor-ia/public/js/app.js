// Doctor IA — lógica de la interfaz
(function () {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const { render: renderMarkdown, escapeHtml } = window.Markdown;
  const DISEASES = window.DISEASES;
  const CATEGORIES = window.CATEGORIES;

  const normalize = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

  const storage = {
    get(key) { try { return localStorage.getItem(key); } catch { return null; } },
    set(key, value) { try { localStorage.setItem(key, value); } catch { /* sin almacenamiento */ } },
    remove(key) { try { localStorage.removeItem(key); } catch { /* sin almacenamiento */ } },
  };

  // ==========================================================
  // Tema, menú y animaciones generales
  // ==========================================================
  const themeBtn = $("#theme-toggle");
  function applyTheme(theme) {
    if (theme) document.documentElement.dataset.theme = theme;
    const dark = theme ? theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    themeBtn.textContent = dark ? "☀️" : "🌙";
  }
  applyTheme(storage.get("theme"));
  themeBtn.addEventListener("click", () => {
    const current = document.documentElement.dataset.theme ||
      (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = current === "dark" ? "light" : "dark";
    storage.set("theme", next);
    applyTheme(next);
  });

  $("#menu-toggle").addEventListener("click", () => $("#nav-links").classList.toggle("open"));
  $$("#nav-links a").forEach((a) => a.addEventListener("click", () => $("#nav-links").classList.remove("open")));

  const revealObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        revealObserver.unobserve(entry.target);
      }
    }
  }, { threshold: 0.12 });
  $$(".reveal").forEach((el) => revealObserver.observe(el));

  // Fondo animado de "células" flotando
  (function cellsBackground() {
    const canvas = $("#bg-cells");
    const ctx = canvas.getContext("2d");
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let cells = [];
    function resize() {
      canvas.width = innerWidth * devicePixelRatio;
      canvas.height = innerHeight * devicePixelRatio;
      const count = Math.min(26, Math.round(innerWidth / 55));
      cells = Array.from({ length: count }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: (8 + Math.random() * 26) * devicePixelRatio,
        vx: (Math.random() - 0.5) * 0.25 * devicePixelRatio,
        vy: (Math.random() - 0.5) * 0.25 * devicePixelRatio,
        hue: [174, 199, 262, 340][Math.floor(Math.random() * 4)],
        phase: Math.random() * Math.PI * 2,
      }));
    }
    function draw(t) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const c of cells) {
        c.x += c.vx; c.y += c.vy;
        if (c.x < -c.r) c.x = canvas.width + c.r;
        if (c.x > canvas.width + c.r) c.x = -c.r;
        if (c.y < -c.r) c.y = canvas.height + c.r;
        if (c.y > canvas.height + c.r) c.y = -c.r;
        const r = c.r * (1 + 0.06 * Math.sin(t / 900 + c.phase));
        const g = ctx.createRadialGradient(c.x, c.y, r * 0.1, c.x, c.y, r);
        g.addColorStop(0, `hsla(${c.hue}, 80%, 60%, .22)`);
        g.addColorStop(0.7, `hsla(${c.hue}, 80%, 55%, .10)`);
        g.addColorStop(1, `hsla(${c.hue}, 80%, 50%, 0)`);
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = `hsla(${c.hue}, 80%, 45%, .18)`;
        ctx.beginPath(); ctx.arc(c.x + r * 0.15, c.y - r * 0.1, r * 0.22, 0, Math.PI * 2); ctx.fill();
      }
      if (!reduced) requestAnimationFrame(draw);
    }
    resize();
    addEventListener("resize", resize);
    requestAnimationFrame(draw);
  })();

  // ==========================================================
  // Imágenes y resúmenes de Wikipedia (se piden desde el navegador)
  // ==========================================================
  const wikiCache = new Map();
  function fetchWikiSummary(title) {
    if (!wikiCache.has(title)) {
      const url = `https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`;
      wikiCache.set(title, fetch(url)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null));
    }
    return wikiCache.get(title);
  }

  function loadImageInto(img, src) {
    if (!src) return;
    img.onload = () => img.classList.add("loaded");
    img.src = src;
  }

  const imageObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const card = entry.target;
      imageObserver.unobserve(card);
      fetchWikiSummary(card.dataset.wiki).then((data) => {
        if (data?.thumbnail?.source) loadImageInto($("img", card), data.thumbnail.source);
      });
    }
  }, { rootMargin: "200px" });

  // ==========================================================
  // Enciclopedia
  // ==========================================================
  const grid = $("#disease-grid");
  const searchInput = $("#disease-search");
  const chipsBox = $("#category-chips");
  let activeCat = "all";

  $("#count-diseases").textContent = `${DISEASES.length}+`;

  chipsBox.innerHTML = [`<button class="chip active" data-cat="all">🌐 Todas (${DISEASES.length})</button>`]
    .concat(Object.entries(CATEGORIES).map(([key, c]) => {
      const n = DISEASES.filter((d) => d.cat === key).length;
      return `<button class="chip" data-cat="${key}" style="--c:${c.color}">${c.icon} ${c.name} (${n})</button>`;
    })).join("");

  chipsBox.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    $$(".chip", chipsBox).forEach((c) => c.classList.toggle("active", c === chip));
    activeCat = chip.dataset.cat;
    renderGrid();
  });

  let searchTimer;
  searchInput.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(renderGrid, 150);
  });

  function searchableText(d) {
    return normalize([d.name, d.summary, ...d.symptoms, ...d.causes].join(" "));
  }

  function renderGrid() {
    const query = normalize(searchInput.value.trim());
    const terms = query.split(/\s+/).filter(Boolean);
    const list = DISEASES
      .filter((d) => activeCat === "all" || d.cat === activeCat)
      .map((d) => {
        const name = normalize(d.name);
        const text = searchableText(d);
        let score = 0;
        for (const t of terms) {
          if (name.includes(t)) score += 5;
          else if (text.includes(t)) score += 1;
          else return null;
        }
        return { d, score };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.d);

    grid.innerHTML = list.length
      ? list.map((d, i) => cardHtml(d, i)).join("")
      : `<p class="no-results">No hay resultados en la enciclopedia local para “${escapeHtml(searchInput.value)}”.</p>`;

    $$(".disease-card", grid).forEach((card) => imageObserver.observe(card));

    const box = $("#web-search-box");
    box.hidden = !query;
    $("#web-query").textContent = searchInput.value.trim();
    $("#web-results").innerHTML = "";
  }

  function cardHtml(d, i) {
    const c = CATEGORIES[d.cat];
    return `
      <button class="disease-card" data-id="${d.id}" data-wiki="${escapeHtml(d.wiki)}" style="--c:${c.color};animation-delay:${Math.min(i, 12) * 40}ms">
        <div class="card-art"><img alt="" loading="lazy" /><span class="icon">${c.icon}</span></div>
        <div class="card-body">
          <span class="cat">${c.name}</span>
          <h3>${escapeHtml(d.name)}</h3>
          <p>${escapeHtml(d.summary)}</p>
        </div>
      </button>`;
  }

  grid.addEventListener("click", (e) => {
    const card = e.target.closest(".disease-card");
    if (card) openDisease(card.dataset.id);
  });

  // Efecto 3D al pasar el ratón
  grid.addEventListener("mousemove", (e) => {
    const card = e.target.closest(".disease-card");
    if (!card) return;
    const r = card.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    card.style.transform = `perspective(700px) rotateY(${x * 8}deg) rotateX(${-y * 8}deg) translateY(-6px)`;
  });
  grid.addEventListener("mouseout", (e) => {
    const card = e.target.closest(".disease-card");
    if (card && !card.contains(e.relatedTarget)) card.style.transform = "";
  });

  // ---------- Modal ----------
  const modal = $("#disease-modal");
  const modalBody = $("#modal-body");
  let lastFocus = null;

  function listBlock(icon, title, items, delay) {
    return `<div class="info-block" style="animation-delay:${delay}ms"><h3>${icon} ${title}</h3><ul>${items.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul></div>`;
  }

  function openDisease(id) {
    const d = DISEASES.find((x) => x.id === id);
    if (!d) return;
    const c = CATEGORIES[d.cat];
    lastFocus = document.activeElement;
    modalBody.style.setProperty("--c", c.color);
    modalBody.innerHTML = `
      <header class="modal-hero">
        <img alt="${escapeHtml(d.name)}" />
        <span class="big-icon">${c.icon}</span>
        <div><span class="cat">${c.name}</span><h2 id="modal-title">${escapeHtml(d.name)}</h2></div>
      </header>
      <div class="modal-content">
        <p class="summary">${escapeHtml(d.summary)}</p>
        ${d.fact ? `<div class="fact"><span>📊</span><span>${escapeHtml(d.fact)}</span></div>` : ""}
        <div class="info-grid">
          ${listBlock("🤒", "Síntomas", d.symptoms, 0)}
          ${listBlock("🔬", "Causas", d.causes, 60)}
          ${listBlock("⚠️", "Factores de riesgo", d.risk, 120)}
          <div class="info-block" style="animation-delay:180ms"><h3>🩺 Diagnóstico</h3><p>${escapeHtml(d.diagnosis)}</p></div>
          ${listBlock("💊", "Tratamientos y soluciones", d.treatment, 240)}
          ${listBlock("🛡️", "Prevención", d.prevention, 300)}
        </div>
        <div class="urgent-box"><h3>🚑 ¿Cuándo buscar ayuda?</h3><p>${escapeHtml(d.urgent)}</p></div>
        <div class="wiki-box" id="wiki-box">Cargando información adicional de la web…</div>
        <div class="modal-actions">
          <button class="btn btn-primary" id="modal-ask">🤖 Preguntar al Dr. IA sobre esto</button>
          <a class="btn btn-ghost" target="_blank" rel="noopener" href="https://vsearch.nlm.nih.gov/vivisimo/cgi-bin/query-meta?v%3Aproject=medlineplus-spanish&query=${encodeURIComponent(d.name)}">📖 MedlinePlus</a>
          <a class="btn btn-ghost" target="_blank" rel="noopener" href="https://www.who.int/es/search?query=${encodeURIComponent(d.name)}">🌍 OMS</a>
        </div>
      </div>`;
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    $(".modal-close", modal).focus();

    $("#modal-ask").addEventListener("click", () => {
      closeModal();
      askDoctor(`Explícame en detalle ${d.name}: cómo se detecta, los tratamientos más recientes y qué puedo hacer para prevenirlo.`);
    });

    fetchWikiSummary(d.wiki).then((data) => {
      const box = $("#wiki-box");
      if (!box) return;
      if (!data) {
        box.innerHTML = "No se pudo cargar información adicional de Wikipedia.";
        return;
      }
      loadImageInto($(".modal-hero img", modalBody), data.originalimage?.source || data.thumbnail?.source);
      box.innerHTML = `<strong>🌐 Según Wikipedia:</strong> ${escapeHtml(data.extract || "")} ${data.content_urls ? `<a href="${data.content_urls.desktop.page}" target="_blank" rel="noopener">Leer más →</a>` : ""}`;
    });
  }

  function closeModal() {
    modal.hidden = true;
    document.body.style.overflow = "";
    lastFocus?.focus();
  }
  modal.addEventListener("click", (e) => { if (e.target.closest("[data-close]")) closeModal(); });
  addEventListener("keydown", (e) => { if (e.key === "Escape" && !modal.hidden) closeModal(); });

  // ---------- Búsqueda de cualquier enfermedad en la web ----------
  $("#web-search-btn").addEventListener("click", async () => {
    const query = searchInput.value.trim();
    const box = $("#web-results");
    if (!query) return;
    box.innerHTML = `<p class="msg-status"><span class="spinner"></span> Buscando “${escapeHtml(query)}” en la web…</p>`;
    try {
      const url = `https://es.wikipedia.org/w/api.php?action=query&list=search&format=json&origin=*&srlimit=5&srsearch=${encodeURIComponent(query + " enfermedad")}`;
      const data = await fetch(url).then((r) => r.json());
      const results = data?.query?.search || [];
      if (!results.length) {
        box.innerHTML = "<p>No se encontraron resultados. Prueba a preguntarle al Dr. IA.</p>";
        return;
      }
      const summaries = await Promise.all(results.map((r) => fetchWikiSummary(r.title)));
      box.innerHTML = summaries.filter(Boolean).map((s, i) => `
        <article class="web-result" style="animation-delay:${i * 80}ms">
          ${s.thumbnail ? `<img src="${s.thumbnail.source}" alt="${escapeHtml(s.title)}" />` : ""}
          <div>
            <h4>${escapeHtml(s.title)}</h4>
            <p>${escapeHtml(s.extract || "")}</p>
            <a href="${s.content_urls?.desktop?.page}" target="_blank" rel="noopener">Leer en Wikipedia →</a>
          </div>
        </article>`).join("");
    } catch {
      box.innerHTML = "<p>No se pudo conectar con la web. Revisa tu conexión o pregúntale al Dr. IA.</p>";
    }
  });

  $("#ask-ai-btn").addEventListener("click", () => {
    const q = searchInput.value.trim();
    if (q) askDoctor(`Háblame de ${q}: qué es, síntomas, causas, tratamiento y prevención.`);
  });

  renderGrid();

  // ==========================================================
  // Orientador de síntomas
  // ==========================================================
  // Cada síntoma se relaciona con palabras clave que aparecen en las fichas.
  // Una clave terminada en "*" es un prefijo ("sangr*" → sangre, sangrado…); el resto son palabras completas.
  const SYMPTOMS = [
    ["🤒 Fiebre", ["fiebre"]],
    ["😮‍💨 Tos", ["tos"]],
    ["🫁 Falta de aire", ["falta de aire", "dificultad respiratoria", "ahogo"]],
    ["💔 Dolor de pecho", ["pecho", "toracico"]],
    ["🤕 Dolor de cabeza", ["dolor de cabeza"]],
    ["😴 Cansancio", ["cansancio", "fatiga"]],
    ["⚖️ Pérdida de peso", ["perdida de peso"]],
    ["🤢 Náuseas o vómitos", ["nauseas", "vomito*"]],
    ["🚽 Diarrea", ["diarrea"]],
    ["🧱 Estreñimiento", ["estreñimiento"]],
    ["🫃 Dolor abdominal", ["abdominal", "abdomen", "boca del estomago"]],
    ["🩸 Sangrado", ["sangr*"]],
    ["🟡 Piel amarilla", ["ictericia", "amarill*"]],
    ["🦵 Hinchazón de piernas", ["hinchazon de piernas", "hinchazon de tobillos", "pierna hinchada", "hinchazon de una sola pierna"]],
    ["🦴 Dolor articular", ["articula*"]],
    ["💪 Dolor muscular", ["muscular*"]],
    ["🌡️ Sudores nocturnos", ["sudores nocturnos", "sudoracion"]],
    ["🔴 Erupción o manchas", ["erupcion", "placas", "manchas", "ampollas"]],
    ["😖 Picor", ["picor"]],
    ["🫀 Palpitaciones", ["palpitaciones", "latido"]],
    ["😵 Mareo", ["mareo"]],
    ["🧠 Confusión o memoria", ["confusion", "memoria", "olvidos"]],
    ["🫨 Temblor", ["temblor"]],
    ["🥴 Hormigueo o debilidad", ["hormigueo", "debilidad", "entumecimiento"]],
    ["🚻 Molestias al orinar", ["orinar"]],
    ["🥤 Mucha sed", ["sed"]],
    ["👁️ Problemas de visión", ["vision"]],
    ["😔 Tristeza", ["tristeza", "desanimo", "animo bajo"]],
    ["😰 Ansiedad o nervios", ["nerviosismo", "preocupacion", "inquietud"]],
    ["🌙 Problemas de sueño", ["sueño", "insomnio"]],
    ["⚪ Bulto o ganglio", ["bulto", "ganglio*", "nodulo*"]],
    ["👂 Dolor de oído", ["oido"]],
  ];
  const SYMPTOM_REGEXES = SYMPTOMS.map(([, keys]) => keys.map((key) => {
    const k = normalize(key);
    return k.endsWith("*") ? new RegExp(`(^|[^a-z0-9])${k.slice(0, -1)}`) : new RegExp(`(^|[^a-z0-9])${k}(?![a-z0-9])`);
  }));

  const selected = new Set();
  const symptomBox = $("#symptom-chips");
  symptomBox.innerHTML = SYMPTOMS.map(([label], i) => `<button class="chip" data-i="${i}">${label}</button>`).join("");
  symptomBox.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    const i = Number(chip.dataset.i);
    selected.has(i) ? selected.delete(i) : selected.add(i);
    chip.classList.toggle("active");
    renderSymptomMatches();
  });

  $("#symptom-clear").addEventListener("click", () => {
    selected.clear();
    $$(".chip", symptomBox).forEach((c) => c.classList.remove("active"));
    renderSymptomMatches();
  });

  $("#symptom-ask").addEventListener("click", () => {
    if (!selected.size) return;
    const labels = [...selected].map((i) => SYMPTOMS[i][0].replace(/^\S+\s/, "").toLowerCase());
    askDoctor(`Tengo estos síntomas: ${labels.join(", ")}. ¿Qué podría ser y qué debería hacer? (Te doy más detalles si me preguntas.)`);
  });

  function renderSymptomMatches() {
    const out = $("#symptom-results");
    if (!selected.size) {
      out.innerHTML = `<div class="empty-state"><div class="pulse-heart">❤️</div><p>Elige uno o más síntomas para empezar.</p></div>`;
      return;
    }
    const keys = [...selected].map((i) => SYMPTOM_REGEXES[i]);
    const ranked = DISEASES.map((d) => {
      const items = d.symptoms.map(normalize);
      const text = items.join(" | ");
      const hits = keys.filter((variants) => variants.some((re) => re.test(text))).length;
      // En empates, gana la enfermedad cuyos síntomas coinciden en mayor proporción.
      const coverage = items.filter((s) => keys.some((variants) => variants.some((re) => re.test(s)))).length / items.length;
      return { d, hits, coverage, pct: Math.round((hits / keys.length) * 100) };
    }).filter((x) => x.hits > 0).sort((a, b) => b.hits - a.hits || b.coverage - a.coverage).slice(0, 10);

    out.innerHTML = `<p class="msg-status">⚠️ Coincidencias orientativas, no un diagnóstico.</p>` + (ranked.length
      ? ranked.map((x, i) => {
          const c = CATEGORIES[x.d.cat];
          return `<button class="match" data-id="${x.d.id}" style="--c:${c.color};animation-delay:${i * 50}ms">
            <span class="icon">${c.icon}</span>
            <span style="flex:1"><strong>${escapeHtml(x.d.name)}</strong><br><small>${x.hits} de ${keys.length} síntomas coinciden</small>
            <div class="bar"><i style="width:${x.pct}%"></i></div></span></button>`;
        }).join("")
      : "<p>No hay coincidencias en la enciclopedia. Pregúntale al Dr. IA.</p>");
  }
  $("#symptom-results").addEventListener("click", (e) => {
    const m = e.target.closest(".match");
    if (m) openDisease(m.dataset.id);
  });

  // ==========================================================
  // Estadísticas con contadores animados
  // ==========================================================
  const statsGrid = $("#stats-grid");
  statsGrid.innerHTML = window.WORLD_STATS.map((s, i) => `
    <div class="stat reveal" style="transition-delay:${i * 80}ms">
      <strong data-value="${s.value}" data-decimals="${s.decimals}" data-suffix="${s.suffix}">0</strong>
      <p>${escapeHtml(s.label)}</p>
      <a href="${s.url}" target="_blank" rel="noopener">Fuente: ${escapeHtml(s.source)}</a>
    </div>`).join("");
  const counterObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      counterObserver.unobserve(entry.target);
      entry.target.classList.add("visible");
      const el = $("strong", entry.target);
      const target = Number(el.dataset.value);
      const decimals = Number(el.dataset.decimals);
      const start = performance.now();
      const step = (now) => {
        const p = Math.min(1, (now - start) / 1600);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = (target * eased).toLocaleString("es-ES", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + el.dataset.suffix;
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }
  }, { threshold: 0.3 });
  $$(".stat", statsGrid).forEach((el) => counterObserver.observe(el));

  // ==========================================================
  // Chat con el Dr. IA
  // ==========================================================
  const messagesBox = $("#chat-messages");
  const form = $("#chat-form");
  const textArea = $("#chat-text");
  const sendBtn = $("#send-btn");
  const heroDoctor = $(".doctor");
  const HISTORY_KEY = "doctor-ia-history";
  let aiOnline = false;
  let busy = false;
  let pendingImage = null; // { media_type, data, url }
  let history = [];

  try { history = JSON.parse(storage.get(HISTORY_KEY) || "[]"); } catch { history = []; }

  const EMERGENCY_PATTERNS = [
    /dolor (fuerte |intenso )?(en el|de) pecho/, /opresion en el pecho/, /no puedo respirar/, /me ahogo/,
    /cara (caida|torcida)/, /no puedo mover (el|la|un)/, /convulsi/, /perdio el conocimiento|se desmayo|inconsciente/,
    /sangr(ado|a) (mucho|abundante|sin parar)/, /suicid/, /quitarme la vida/, /hacerme dano/, /no quiero vivir/,
    /sobredosis/, /envenen/,
  ];
  const isEmergency = (text) => EMERGENCY_PATTERNS.some((re) => re.test(normalize(text)));

  function saveHistory() {
    // Las imágenes no se guardan para no llenar el almacenamiento del navegador.
    storage.set(HISTORY_KEY, JSON.stringify(history.slice(-30).map(({ role, content }) => ({ role, content }))));
  }

  function addMessage(role, html) {
    const el = document.createElement("div");
    el.className = `msg ${role}`;
    el.innerHTML = `<div class="avatar">${role === "user" ? "🙂" : "👨‍⚕️"}</div><div class="content">${html}</div>`;
    messagesBox.appendChild(el);
    messagesBox.scrollTop = messagesBox.scrollHeight;
    return $(".content", el);
  }

  function greet() {
    addMessage("bot", renderMarkdown(
      "¡Hola! Soy el **Dr. IA** 👋. Puedo ayudarte a entender síntomas, enfermedades (desde el cáncer hasta infecciones tropicales), tratamientos y prevención.\n\n" +
      "Cuéntame qué te pasa: **edad, qué sientes, desde cuándo** y si tomas algún medicamento. También puedes adjuntar una foto 📷.\n\n" +
      "_Recuerda: soy una herramienta educativa y no sustituyo a tu médico._"
    ));
  }

  function restoreHistory() {
    messagesBox.innerHTML = "";
    greet();
    for (const m of history) addMessage(m.role === "user" ? "user" : "bot", m.role === "user" ? escapeHtml(m.content) : renderMarkdown(m.content));
  }

  fetch("/api/status").then((r) => r.json()).then((s) => {
    aiOnline = s.ai;
    $("#ai-status").textContent = s.ai ? "En línea · con búsqueda web" : "Modo sin conexión · enciclopedia local";
    $("#status-dot").classList.toggle("online", s.ai);
  }).catch(() => {
    $("#ai-status").textContent = "Modo sin conexión · enciclopedia local";
  });

  restoreHistory();

  // Textarea que crece sola; Enter envía, Shift+Enter hace salto de línea.
  textArea.addEventListener("input", () => {
    textArea.style.height = "auto";
    textArea.style.height = Math.min(textArea.scrollHeight, 160) + "px";
  });
  textArea.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      form.requestSubmit();
    }
  });

  $("#chat-suggestions").addEventListener("click", (e) => {
    if (e.target.tagName === "BUTTON") askDoctor(e.target.textContent);
  });

  $("#clear-chat").addEventListener("click", () => {
    if (busy) return;
    history = [];
    storage.remove(HISTORY_KEY);
    restoreHistory();
  });

  // ---------- Imagen adjunta (se reduce para que pese poco) ----------
  $("#chat-image").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    try {
      pendingImage = await resizeImage(file, 1280);
      const preview = $("#image-preview");
      $("img", preview).src = pendingImage.url;
      preview.hidden = false;
    } catch {
      alert("No se pudo leer la imagen.");
    }
  });
  $("#image-preview button").addEventListener("click", () => {
    pendingImage = null;
    $("#image-preview").hidden = true;
  });

  function resizeImage(file, maxSide) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        const url = canvas.toDataURL("image/jpeg", 0.85);
        URL.revokeObjectURL(img.src);
        resolve({ media_type: "image/jpeg", data: url.split(",")[1], url });
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }

  // ---------- Dictado por voz ----------
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const micBtn = $("#mic-btn");
  if (!Recognition) {
    micBtn.hidden = true;
  } else {
    const rec = new Recognition();
    rec.lang = "es-ES";
    rec.interimResults = true;
    let base = "";
    rec.onresult = (e) => {
      const transcript = [...e.results].map((r) => r[0].transcript).join("");
      textArea.value = (base + " " + transcript).trim();
      textArea.dispatchEvent(new Event("input"));
    };
    rec.onend = () => micBtn.classList.remove("recording");
    micBtn.addEventListener("click", () => {
      if (micBtn.classList.contains("recording")) return rec.stop();
      base = textArea.value;
      micBtn.classList.add("recording");
      rec.start();
    });
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = textArea.value.trim();
    if ((!text && !pendingImage) || busy) return;
    textArea.value = "";
    textArea.style.height = "auto";
    sendMessage(text);
  });

  function askDoctor(text) {
    location.hash = "#chat";
    $("#chat").scrollIntoView({ behavior: "smooth" });
    if (!busy) sendMessage(text);
  }

  async function sendMessage(text) {
    busy = true;
    sendBtn.disabled = true;
    const image = pendingImage;
    pendingImage = null;
    $("#image-preview").hidden = true;

    addMessage("user", (image ? `<img class="attached" src="${image.url}" alt="Imagen adjunta">` : "") + escapeHtml(text));
    history.push({ role: "user", content: text || "¿Qué ves en esta imagen?", ...(image && { image: { media_type: image.media_type, data: image.data } }) });

    const bubble = addMessage("bot", "");
    if (isEmergency(text)) {
      bubble.innerHTML = `<div class="emergency-alert">🚨 Lo que describes puede ser una emergencia. Si ocurre ahora, llama al <strong>112</strong> / <strong>911</strong> o acude a urgencias de inmediato.</div>`;
    }
    const statusEl = document.createElement("div");
    statusEl.className = "msg-status";
    statusEl.innerHTML = `<span class="typing"><i></i><i></i><i></i></span>`;
    const textEl = document.createElement("div");
    bubble.append(statusEl, textEl);
    heroDoctor?.classList.add("talking");

    let answer = "";
    const sources = new Map();
    try {
      if (!aiOnline) throw Object.assign(new Error("offline"), { offline: true });

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw Object.assign(new Error(err.error || `Error ${res.status}`), { offline: res.status === 503 });
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let sep;
        while ((sep = buffer.indexOf("\n\n")) !== -1) {
          const raw = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);
          const event = raw.match(/^event: (.*)$/m)?.[1];
          const data = JSON.parse(raw.match(/^data: (.*)$/m)?.[1] || "{}");
          if (event === "text") {
            answer += data.text;
            statusEl.hidden = true;
            textEl.innerHTML = renderMarkdown(answer);
            messagesBox.scrollTop = messagesBox.scrollHeight;
          } else if (event === "status") {
            statusEl.hidden = false;
            statusEl.innerHTML = `<span class="spinner"></span> ${escapeHtml(data.text)}`;
          } else if (event === "sources") {
            for (const s of data.sources) sources.set(s.url, s.title);
          } else if (event === "error") {
            throw new Error(data.error);
          }
        }
      }
      statusEl.remove();
      if (sources.size) {
        textEl.insertAdjacentHTML("beforeend", `<div class="sources"><strong>🔗 Fuentes consultadas</strong>${[...sources].slice(0, 8)
          .map(([url, title]) => `<a href="${escapeHtml(url)}" target="_blank" rel="noopener" title="${escapeHtml(title)}">${escapeHtml(new URL(url).hostname.replace(/^www\./, ""))}</a>`).join("")}</div>`);
      }
    } catch (err) {
      statusEl.remove();
      if (err.offline) {
        answer = offlineAnswer(text);
        textEl.innerHTML = renderMarkdown(answer);
      } else {
        textEl.innerHTML = `<p>⚠️ ${escapeHtml(err.message)}</p>`;
        answer = answer || "";
      }
    } finally {
      heroDoctor?.classList.remove("talking");
      if (answer) {
        history.push({ role: "assistant", content: answer });
      } else {
        history.pop(); // no guardar una pregunta sin respuesta
      }
      saveHistory();
      busy = false;
      sendBtn.disabled = false;
      messagesBox.scrollTop = messagesBox.scrollHeight;
    }
  }

  // Respuesta sin IA: busca en la enciclopedia local.
  function offlineAnswer(text) {
    const words = normalize(text).split(/[^a-z0-9ñ]+/).filter((w) => w.length > 3);
    const ranked = DISEASES.map((d) => {
      const name = normalize(d.name);
      const body = searchableText(d);
      const score = words.reduce((acc, w) => acc + (name.includes(w) ? 6 : body.includes(w) ? 1 : 0), 0);
      return { d, score };
    }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 3);

    const note = "\n\n_Estoy en **modo sin conexión** (la IA no está configurada en el servidor), así que respondo con la enciclopedia local. Para respuestas personalizadas, el administrador debe añadir `ANTHROPIC_API_KEY`._";
    if (!ranked.length) {
      return "No encontré nada relacionado en la enciclopedia local. Prueba con el nombre de una enfermedad o un síntoma concreto (por ejemplo, *fiebre*, *tos* o *diabetes*)." + note;
    }
    const [top, ...rest] = ranked.map((x) => x.d);
    return `### ${top.name}\n${top.summary}\n\n**Síntomas frecuentes:**\n${top.symptoms.slice(0, 5).map((s) => `- ${s}`).join("\n")}\n\n**Tratamiento:**\n${top.treatment.slice(0, 4).map((s) => `- ${s}`).join("\n")}\n\n**¿Cuándo buscar ayuda?** ${top.urgent}` +
      (rest.length ? `\n\nTambién podría interesarte: ${rest.map((d) => `**${d.name}**`).join(", ")} (búscalas en la enciclopedia).` : "") + note;
  }
})();
