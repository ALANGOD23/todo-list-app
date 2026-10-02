// Tipos compartidos entre el navegador, el servidor y el pipeline de conocimiento.

export type SpecialtyId =
  | "medicina-interna" | "cardiologia" | "dermatologia" | "neurologia" | "endocrinologia"
  | "gastroenterologia" | "neumologia" | "nefrologia" | "urologia" | "ginecologia"
  | "pediatria" | "psiquiatria" | "oftalmologia" | "otorrinolaringologia" | "reumatologia"
  | "oncologia" | "infectologia" | "hematologia" | "ortopedia" | "traumatologia"
  | "alergologia" | "inmunologia" | "medicina-preventiva" | "nutricion" | "salud-sexual"
  | "salud-cardiovascular";

export interface Specialty {
  id: SpecialtyId;
  name: string;
  description: string;
}

export type SourceCategory = "oficial" | "academico" | "guia" | "farmacologia" | "cientifica";

/** Organismo o recurso médico de confianza. `trust` 3 = máxima prioridad en el ranking. */
export interface Source {
  id: string;
  name: string;
  publisher: string;
  category: SourceCategory;
  url: string;
  /** Plantilla de búsqueda: `{q}` se sustituye por el término. Evita inventar enlaces profundos. */
  searchUrl?: string;
  domain: string;
  trust: 1 | 2 | 3;
  lang: "es" | "en" | "multi";
}

/** Referencia de una ficha a una fuente. `query` construye el enlace de búsqueda en esa fuente. */
export interface SourceRef {
  sourceId: string;
  query?: string;
  url?: string;
}

export type KnowledgeStatus = "draft" | "in_review" | "published" | "retired";

/** Metadatos de gobernanza: nada se publica sin revisión. */
export interface KnowledgeMeta {
  version: number;
  status: KnowledgeStatus;
  reviewedAt: string; // ISO
  reviewer: string;
}

export interface Faq {
  q: string;
  a: string;
}

export interface Condition {
  id: string;
  name: string;
  aka?: string[];
  specialties: SpecialtyId[];
  summary: string;
  keyFact?: string;
  symptoms: string[];
  causes: string[];
  riskFactors: string[];
  diagnosis: string;
  treatments: string[];
  prevention: string[];
  complications?: string[];
  whenToSeek: string;
  faq?: Faq[];
  sources: SourceRef[];
  meta: KnowledgeMeta;
}

export interface Medication {
  id: string;
  name: string;
  activeIngredient: string;
  aka?: string[];
  drugClass: string;
  uses: string[];
  commonSideEffects: string[];
  seriousSideEffects: string[];
  contraindications: string[];
  interactions: string[];
  warnings: string[];
  pregnancy: string;
  sources: SourceRef[];
  meta: KnowledgeMeta;
}

export interface ReferenceRange {
  label: string; // "Adultos", "Mujeres", "Hombres"…
  low?: number;
  high?: number;
  unit: string;
  note?: string;
}

export interface LabTest {
  id: string;
  name: string;
  aka?: string[];
  panel: string;
  measures: string;
  ranges: ReferenceRange[];
  highMeaning: string[];
  lowMeaning: string[];
  questions: string[];
  caveats?: string;
  sources: SourceRef[];
  meta: KnowledgeMeta;
}

export interface SymptomCause {
  name: string;
  conditionId?: string;
  note?: string;
}

export interface SymptomGuide {
  id: string;
  name: string;
  description: string;
  commonCauses: SymptomCause[];
  questions: string[];
  selfCare: string[];
  whenToConsult: string;
  redFlags: string[];
  sources: SourceRef[];
  meta: KnowledgeMeta;
}

export type ProfileField = "age" | "sex" | "pregnant" | "conditions" | "habits";

export interface PreventionTopic {
  id: string;
  title: string;
  summary: string;
  actions: string[];
  /** Solo se personaliza si el perfil contiene estos datos. */
  personalizeWith?: ProfileField[];
  sources: SourceRef[];
  meta: KnowledgeMeta;
}

// ---------------------------------------------------------------------------
// Seguridad clínica y triage

/** Nivel de atención orientativo. No es un diagnóstico. */
export type TriageLevel = "emergency" | "urgent" | "consult" | "selfcare";

export type RedFlagCategory =
  | "cardiac" | "respiratory" | "neurological" | "consciousness" | "seizure" | "bleeding" | "allergic"
  | "poisoning" | "trauma" | "self_harm" | "harm_others" | "pregnancy" | "pediatric" | "infection"
  | "diabetes" | "abdominal" | "genitourinary" | "vascular" | "eye" | "skin" | "deterioration";

export interface RedFlagMatch {
  ruleId: string;
  category: RedFlagCategory;
  level: TriageLevel;
  title: string;
  firstAction: string;
  guidance: string[];
}

export interface SafetyFlags {
  doseRequest: boolean;
  treatmentChange: boolean;
  minor: boolean;
  pregnancy: boolean;
  interactionQuestion: boolean;
  selfHarm: boolean;
  intoxication: boolean;
  neurological: boolean;
  labQuestion: boolean;
  existingDiagnosis: boolean;
  insufficientInfo: boolean;
}

export interface SafetyAssessment {
  /** Nivel mínimo exigido por las reglas deterministas (null si no hay señales de alarma). */
  floor: TriageLevel | null;
  redFlags: RedFlagMatch[];
  flags: SafetyFlags;
  /** Edad detectada en el texto o aportada por el perfil. Nunca se asume si el usuario no la dio. */
  ageYears?: number;
  ageMonths?: number;
  /** Pregunta general sobre una enfermedad, no una descripción de síntomas propios. */
  educational: boolean;
}

// ---------------------------------------------------------------------------
// Recuperación de conocimiento (RAG)

export type KnowledgeKind = "condition" | "medication" | "lab" | "symptom" | "prevention";

export interface KnowledgeChunk {
  id: string;
  kind: KnowledgeKind;
  refId: string;
  title: string;
  text: string;
  sources: SourceRef[];
}

export interface RetrievedChunk extends KnowledgeChunk {
  score: number;
}

/** Cita mostrada al usuario. `knowledge` = base revisada; `web` = búsqueda en dominios de confianza. */
export interface Citation {
  title: string;
  url: string;
  origin: "knowledge" | "web";
  publisher?: string;
}

// ---------------------------------------------------------------------------
// Perfil y conversaciones (se guardan en el dispositivo del usuario)

export interface HealthProfile {
  age?: number;
  sex?: "femenino" | "masculino" | "intersexual" | "prefiero-no-decir";
  pregnant?: "si" | "no" | "posible";
  allergies?: string;
  medications?: string;
  conditions?: string;
  surgeries?: string;
  habits?: string;
}

/** Subconjunto mínimo del perfil enviado al servidor solo si el usuario lo autoriza. */
export type SharedProfile = Partial<HealthProfile>;

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  triage?: { level: TriageLevel; reason: string };
  redFlags?: RedFlagMatch[];
  citations?: Citation[];
  followUps?: string[];
  attachmentName?: string;
  offline?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  summary?: string;
  followUp?: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
}

export interface VisitPrep {
  reason: string;
  symptoms: { name: string; detail: string }[];
  timeline: string;
  medications: string[];
  questions: string[];
  mention: string[];
}

export interface ConversationSummary {
  title: string;
  summary: string;
  followUp: string;
}
