// Números de emergencia y de crisis por región.
// REVISIÓN EDITORIAL: verificar cada número antes de publicar en un país nuevo y anotar la fecha en `verified`.
export interface EmergencyContacts {
  id: string;
  region: string;
  emergency: string;
  crisis?: { name: string; number: string };
  poison?: { name: string; number: string };
  verified: string;
}

export const emergencyContacts: EmergencyContacts[] = [
  { id: "es", region: "España", emergency: "112", crisis: { name: "Línea de atención a la conducta suicida", number: "024" }, poison: { name: "Servicio de Información Toxicológica", number: "91 562 04 20" }, verified: "pendiente" },
  { id: "us", region: "Estados Unidos", emergency: "911", crisis: { name: "Línea 988 de Prevención del Suicidio y Crisis", number: "988" }, poison: { name: "Poison Help", number: "1-800-222-1222" }, verified: "pendiente" },
  { id: "mx", region: "México", emergency: "911", crisis: { name: "Línea de la Vida", number: "800 911 2000" }, poison: { name: "SINTOX", number: "800 009 2800" }, verified: "pendiente" },
  { id: "ar", region: "Argentina", emergency: "911", crisis: { name: "Centro de Asistencia al Suicida", number: "135" }, poison: { name: "Centro Nacional de Intoxicaciones", number: "0800 333 0160" }, verified: "pendiente" },
  { id: "co", region: "Colombia", emergency: "123", crisis: { name: "Línea 106", number: "106" }, poison: { name: "CISPROQUIM", number: "01 8000 916012" }, verified: "pendiente" },
  { id: "cl", region: "Chile", emergency: "131", crisis: { name: "Línea *4141 Prevención del suicidio", number: "*4141" }, poison: { name: "CITUC", number: "2 2635 3800" }, verified: "pendiente" },
  { id: "other", region: "Otro país", emergency: "112 / 911", verified: "n/a" },
];

export const crisisDirectory = { name: "Directorio internacional de líneas de ayuda", url: "https://findahelpline.com" };

export function contactsForLocale(locale: string | undefined): EmergencyContacts {
  const region = (locale ?? "").split("-")[1]?.toLowerCase();
  return emergencyContacts.find((c) => c.id === region) ?? emergencyContacts[emergencyContacts.length - 1]!;
}
