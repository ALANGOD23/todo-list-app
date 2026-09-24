# 🩺 Doctor IA

Asistente médico con inteligencia artificial y enciclopedia de enfermedades de todo el mundo: cáncer, corazón, infecciones, salud mental, enfermedades raras y más.

> ⚠️ **Aviso:** Doctor IA ofrece información educativa. No sustituye el diagnóstico ni el tratamiento de un profesional sanitario. En una emergencia llama al 112 / 911.

## ✨ Funciones

| Sección | Qué hace |
|---|---|
| 💬 **Chat con el Dr. IA** | Conversación en streaming con Claude (Anthropic). Pregunta lo que un médico preguntaría, orienta el nivel de urgencia, **busca en la web** datos recientes (OMS, CDC, NIH…) y muestra las fuentes. Admite **fotos** (p. ej., una lesión de piel) y **dictado por voz**. |
| 📚 **Enciclopedia** | 89 enfermedades en 13 especialidades, cada una con resumen, dato clave, síntomas, causas, factores de riesgo, diagnóstico, tratamientos, prevención y cuándo ir a urgencias. |
| 🌐 **Cualquier enfermedad del mundo** | Si no está en la enciclopedia, la busca en Wikipedia en directo o se la pregunta al Dr. IA. |
| 🖼️ **Imágenes** | Las fichas cargan imágenes y resúmenes de Wikipedia de forma diferida. |
| 🩻 **Orientador de síntomas** | Eliges síntomas y ves las enfermedades que coinciden, con la opción de analizarlos con la IA. |
| 🌍 **Datos mundiales** | Contadores animados con cifras de la OMS, IARC y FID (con enlace a la fuente). |
| 🚨 **Emergencias** | Detecta frases de alarma (dolor de pecho, ictus, ideas suicidas…) y muestra un aviso para llamar a emergencias. |

Animaciones: doctor en SVG que parpadea, respira y "habla" mientras responde, electrocardiograma animado, órbitas, fondo de células en `<canvas>`, tarjetas con efecto 3D, entradas al hacer scroll y contadores. Modo claro/oscuro y diseño adaptado a móvil. Respeta `prefers-reduced-motion`.

## 🚀 Puesta en marcha

Necesitas **Node.js 18 o superior**.

```bash
cd doctor-ia
npm install
cp .env.example .env      # y pega tu clave en ANTHROPIC_API_KEY
npm start
```

Abre <http://localhost:3000>.

Consigue la clave en <https://console.anthropic.com>. Sin clave, la web funciona igualmente en **modo sin conexión**: la enciclopedia, el orientador y las búsquedas en Wikipedia van perfectas, y el chat responde con la información local.

### Variables de entorno

| Variable | Por defecto | Descripción |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | Clave de la API de Anthropic (obligatoria para la IA). |
| `PORT` | `3000` | Puerto del servidor. |
| `DOCTOR_MODEL` | `claude-opus-5` | Modelo de Claude. |
| `DOCTOR_EFFORT` | `medium` | Profundidad de razonamiento: `low`, `medium`, `high`, `xhigh`, `max`. Más alto = respuestas más elaboradas pero más lentas y caras. |
| `RATE_LIMIT_PER_MIN` | `15` | Consultas por minuto y por IP (protege tu clave). |

## 🧠 Cómo funciona la IA

`server.js` usa el SDK oficial `@anthropic-ai/sdk`:

- **Modelo** `claude-opus-5` con razonamiento adaptativo.
- **Búsqueda web** (`web_search`) para datos recientes; las fuentes se envían al navegador y se muestran bajo la respuesta.
- **Streaming** por Server-Sent Events para que la respuesta aparezca palabra a palabra.
- **Fallback automático** (`fallbacks: "default"`): si el modelo declina una petición por sus filtros de seguridad, la API la reintenta con otro modelo.
- **Caché del prompt de sistema** para abaratar las consultas repetidas.
- El prompt de sistema define la personalidad del Dr. IA, las señales de alarma y los límites (sin diagnósticos definitivos ni dosis concretas).

La clave nunca llega al navegador: todas las llamadas pasan por el servidor.

## 📁 Estructura

```
doctor-ia/
├── server.js                 # Servidor HTTP + /api/chat (Claude) + archivos estáticos
├── public/
│   ├── index.html
│   ├── css/styles.css        # Estilos y animaciones
│   └── js/
│       ├── app.js            # Chat, enciclopedia, síntomas, estadísticas
│       ├── markdown.js       # Render seguro de las respuestas
│       └── data/             # Base de datos de enfermedades por especialidad
└── .env.example
```

### Añadir una enfermedad

Añade un objeto en el archivo de `public/js/data/` que corresponda:

```js
{
  id: "mi-enfermedad", name: "Nombre", cat: "infeccioso", wiki: "Título en es.wikipedia",
  summary: "…", fact: "…",
  symptoms: ["…"], causes: ["…"], risk: ["…"],
  diagnosis: "…", treatment: ["…"], prevention: ["…"], urgent: "…",
}
```

## 📚 Fuentes

Contenido redactado a partir de información de la [OMS](https://www.who.int/es/news-room/fact-sheets), [IARC/GLOBOCAN](https://gco.iarc.who.int/), [FID – Atlas de la Diabetes](https://diabetesatlas.org/), [ONUSIDA](https://www.unaids.org/es), [MedlinePlus](https://medlineplus.gov/spanish/) y guías clínicas. Imágenes y resúmenes externos de Wikipedia (CC BY-SA).
