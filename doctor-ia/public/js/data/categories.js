// Categorías de la enciclopedia. `color` y `icon` se usan en tarjetas y filtros.
window.DISEASES = [];

window.CATEGORIES = {
  cancer:       { name: "Cáncer y oncología",        icon: "🎗️", color: "#e8578c" },
  cardio:       { name: "Corazón y circulación",     icon: "❤️", color: "#ef4444" },
  respiratorio: { name: "Respiratorias",             icon: "🫁", color: "#38bdf8" },
  infeccioso:   { name: "Infecciosas",               icon: "🦠", color: "#22c55e" },
  metabolico:   { name: "Metabólicas y hormonales",  icon: "🧬", color: "#f59e0b" },
  neuro:        { name: "Cerebro y nervios",         icon: "🧠", color: "#a855f7" },
  mental:       { name: "Salud mental",              icon: "💭", color: "#6366f1" },
  digestivo:    { name: "Aparato digestivo",         icon: "🫃", color: "#f97316" },
  renal:        { name: "Riñón y vías urinarias",    icon: "💧", color: "#0ea5e9" },
  autoinmune:   { name: "Huesos, articulaciones e inmunidad", icon: "🦴", color: "#14b8a6" },
  piel:         { name: "Piel",                      icon: "🧴", color: "#ec4899" },
  sangre:       { name: "Sangre y genéticas",        icon: "🩸", color: "#dc2626" },
  sentidos:     { name: "Ojos y oídos",              icon: "👁️", color: "#0891b2" },
};

// Cifras mundiales verificadas (se muestran en la sección de estadísticas).
window.WORLD_STATS = [
  { value: 20.6, suffix: " M", decimals: 1, label: "nuevos casos de cáncer al año", source: "OMS / IARC, 2026", url: "https://www.who.int/news/item/08-07-2026-who-calls-for-urgent-action-as-new-cancer-cases-are-projected-to-nearly-double-by-2050" },
  { value: 19.8, suffix: " M", decimals: 1, label: "muertes anuales por enfermedades cardiovasculares", source: "OMS, 2025", url: "https://www.who.int/news-room/fact-sheets/detail/cardiovascular-diseases-(cvds)" },
  { value: 589, suffix: " M", decimals: 0, label: "adultos viven con diabetes", source: "FID, Atlas 2025", url: "https://diabetesatlas.org/" },
  { value: 10.7, suffix: " M", decimals: 1, label: "personas enfermaron de tuberculosis en 2024", source: "OMS", url: "https://www.who.int/news-room/fact-sheets/detail/tuberculosis" },
  { value: 263, suffix: " M", decimals: 0, label: "casos de malaria en 2023", source: "OMS", url: "https://www.who.int/news-room/fact-sheets/detail/malaria" },
  { value: 57, suffix: " M", decimals: 0, label: "personas viven con demencia", source: "OMS, 2021", url: "https://www.who.int/news-room/fact-sheets/detail/dementia" },
];
