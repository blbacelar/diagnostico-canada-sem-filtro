export type DiagnosticStatus =
  | "client_draft"
  | "submitted"
  | "ai_processing"
  | "awaiting_triage"
  | "in_review"
  | "awaiting_client"
  | "ready_for_approval"
  | "approved"
  | "sending"
  | "sent"
  | "processing_error"
  | "archived";

export type FieldType =
  | "text"
  | "email"
  | "number"
  | "textarea"
  | "select"
  | "radio"
  | "boolean"
  | "checkbox"
  | "multi";

export type QuestionLayout = "compact" | "wide" | "half" | "third" | "full";

export type FormAnswers = Record<string, unknown>;

export interface DiagnosticQuestion {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  optionalLabel?: string;
  placeholder?: string;
  options?: string[];
  min?: number;
  max?: number;
  sensitive?: boolean;
  layout?: QuestionLayout;
  showWhen?: (answers: FormAnswers) => boolean;
}

export interface DiagnosticSection {
  key: string;
  number: string;
  title: string;
  intro: string;
  sensitive?: boolean;
  questions: DiagnosticQuestion[];
}

export interface AiAssessment {
  overallScore: number;
  scoreExplanation: string;
  readinessLevel: "inicial" | "intermediario" | "avancado";
  scoreComponents: Array<{ key: string; label: string; weight: number; score: number; explanation: string }>;
  strengths: string[];
  risks: string[];
  missingOrContradictory: string[];
  priorities: { threeMonths: string[]; sixMonths: string[]; twelveMonths: string[] };
  regionalCompatibility: string[];
  cityTypes: string[];
  initialInvestmentRange: string;
  recommendedReserve: string;
  preparationTimeEstimate: string;
  recommendedContent: string[];
  technicalAlerts: string[];
  followUpQuestions: string[];
  executiveSummary: string;
  confidence: number;
  methodologyVersion: string;
  promptVersion: string;
  model: string;
}
