// Acceso tipado a la base de conocimiento médico revisada.
// Los datos viven en ./data/*.json y se gestionan con el pipeline (server/knowledge), nunca dentro de componentes.
import type {
  Condition, LabTest, Medication, PreventionTopic, Source, SourceRef, Specialty, SpecialtyId, SymptomGuide, Citation,
} from "../types";
import conditionsData from "./data/conditions.json";
import medicationsData from "./data/medications.json";
import labsData from "./data/labs.json";
import symptomsData from "./data/symptoms.json";
import preventionData from "./data/prevention.json";
import sourcesData from "./data/sources.json";
import specialtiesData from "./data/specialties.json";

const published = <T extends { meta: { status: string } }>(items: T[]) => items.filter((i) => i.meta.status === "published");

export const conditions = published(conditionsData as Condition[]);
export const medications = published(medicationsData as Medication[]);
export const labs = published(labsData as LabTest[]);
export const symptomGuides = published(symptomsData as SymptomGuide[]);
export const preventionTopics = published(preventionData as PreventionTopic[]);
export const sources = sourcesData as Source[];
export const specialties = specialtiesData as Specialty[];

const byId = <T extends { id: string }>(list: T[]) => new Map(list.map((x) => [x.id, x]));
const conditionMap = byId(conditions);
const medicationMap = byId(medications);
const labMap = byId(labs);
const symptomMap = byId(symptomGuides);
const sourceMap = byId(sources);

export const getCondition = (id: string) => conditionMap.get(id);
export const getMedication = (id: string) => medicationMap.get(id);
export const getLab = (id: string) => labMap.get(id);
export const getSymptomGuide = (id: string) => symptomMap.get(id);
export const getSource = (id: string) => sourceMap.get(id);
export const getSpecialty = (id: SpecialtyId) => specialties.find((s) => s.id === id);

export const conditionsBySpecialty = (id: SpecialtyId) => conditions.filter((c) => c.specialties.includes(id));

/** Construye el enlace de una referencia sin inventar URLs profundas: usa la búsqueda oficial de la fuente o su portada. */
export function resolveSourceRef(ref: SourceRef): Citation | null {
  const source = sourceMap.get(ref.sourceId);
  if (!source) return null;
  const url = ref.url ?? (ref.query && source.searchUrl ? source.searchUrl.replace("{q}", encodeURIComponent(ref.query)) : source.url);
  return {
    title: ref.query ? `${source.name}: ${ref.query}` : source.name,
    url,
    origin: "knowledge",
    publisher: source.publisher,
  };
}

export const resolveSources = (refs: SourceRef[]): Citation[] =>
  refs.map(resolveSourceRef).filter((c): c is Citation => c !== null);

/** Dominios de confianza permitidos para la búsqueda web de la IA. */
export const trustedDomains = [...new Set(sources.map((s) => s.domain))];

export function trustOfUrl(url: string): number {
  try {
    const host = new URL(url).hostname;
    const match = sources.find((s) => host === s.domain || host.endsWith(`.${s.domain}`));
    return match?.trust ?? 0;
  } catch {
    return 0;
  }
}

export const knowledgeStats = {
  conditions: conditions.length,
  medications: medications.length,
  labs: labs.length,
  symptoms: symptomGuides.length,
  specialties: specialties.length,
  sources: sources.length,
};
