// Esquemas de validación de la base de conocimiento (etapa VALIDATE del pipeline y tests).
import { z } from "zod";

const text = z.string().trim().min(2);
const short = z.string().trim().min(1); // unidades y símbolos como "%" o "K"
const list = z.array(text).min(1);

export const sourceRefSchema = z.object({
  sourceId: z.string(),
  query: z.string().optional(),
  url: z.string().url().optional(),
});

export const metaSchema = z.object({
  version: z.number().int().positive(),
  status: z.enum(["draft", "in_review", "published", "retired"]),
  reviewedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
  reviewer: text,
});

const base = { id: z.string().regex(/^[a-z0-9-]+$/), sources: z.array(sourceRefSchema).min(1), meta: metaSchema };

/** Patrones que nunca deben aparecer en contenido educativo: dosis concretas. */
export const DOSE_PATTERN = /\b\d+(?:[.,]\d+)?\s?(?:mg|mcg|µg|g|ml|mL|UI)\b(?:\s?(?:\/|cada|por)\s?(?:kg|día|dia|h|horas?))?/;

const noDose = (s: string) => !DOSE_PATTERN.test(s);
const doseFree = z.array(text.refine(noDose, "Contiene una dosis concreta")).min(1);

export const conditionSchema = z.object({
  ...base,
  name: text,
  aka: z.array(text).optional(),
  specialties: z.array(z.string()).min(1),
  summary: text,
  keyFact: text.optional(),
  symptoms: list,
  causes: list,
  riskFactors: list,
  diagnosis: text,
  treatments: doseFree,
  prevention: list,
  complications: list.optional(),
  whenToSeek: text,
  faq: z.array(z.object({ q: text, a: text })).optional(),
});

export const medicationSchema = z.object({
  ...base,
  name: text,
  activeIngredient: text,
  aka: z.array(text).optional(),
  drugClass: text,
  uses: doseFree,
  commonSideEffects: list,
  seriousSideEffects: list,
  contraindications: list,
  interactions: list,
  warnings: doseFree,
  pregnancy: text.refine(noDose, "Contiene una dosis concreta"),
});

const range = z.object({ label: text, low: z.number().optional(), high: z.number().optional(), unit: short, note: z.string().optional() })
  .refine((r) => r.low !== undefined || r.high !== undefined, "Un rango necesita límite inferior o superior");

export const labSchema = z.object({
  ...base,
  name: text,
  aka: z.array(short).optional(),
  panel: text,
  measures: text,
  ranges: z.array(range).min(1),
  highMeaning: list,
  lowMeaning: list,
  questions: list,
  caveats: text.optional(),
});

export const symptomSchema = z.object({
  ...base,
  name: text,
  description: text,
  commonCauses: z.array(z.object({ name: text, conditionId: z.string().optional(), note: z.string().optional() })).min(1),
  questions: list,
  selfCare: list,
  whenToConsult: text,
  redFlags: list,
});

export const preventionSchema = z.object({
  ...base,
  title: text,
  summary: text,
  actions: list,
  personalizeWith: z.array(z.enum(["age", "sex", "pregnant", "conditions", "habits"])).optional(),
});

export const sourceSchema = z.object({
  id: z.string(),
  name: text,
  publisher: text,
  category: z.enum(["oficial", "academico", "guia", "farmacologia", "cientifica"]),
  url: z.string().url(),
  searchUrl: z.string().includes("{q}").optional(),
  domain: z.string(),
  trust: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  lang: z.enum(["es", "en", "multi"]),
});

export const collections = {
  conditions: conditionSchema,
  medications: medicationSchema,
  labs: labSchema,
  symptoms: symptomSchema,
  prevention: preventionSchema,
} as const;

export type CollectionName = keyof typeof collections;
