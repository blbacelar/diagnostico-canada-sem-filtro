import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText, Output } from "ai";
import { z } from "zod";
import { operationalConfig, type OperationalConfig } from "./operational-config";
import type { FormAnswers } from "./types";

type AssessmentConfig = Pick<OperationalConfig, "methodologyVersion" | "promptVersion" | "model">;

const assessmentOutputSchema = z.object({
  overallScore: z.number().int().min(0).max(100).describe("Pontuação geral de preparo, nunca de elegibilidade."),
  scoreExplanation: z.string().max(2_000),
  readinessLevel: z.enum(["inicial", "intermediario", "avancado"]),
  scoreComponents: z.array(z.object({ key: z.string(), label: z.string(), weight: z.number().min(0).max(100), score: z.number().min(0).max(100), explanation: z.string() })),
  strengths: z.array(z.string()).max(12),
  risks: z.array(z.string()).max(12),
  missingOrContradictory: z.array(z.string()).max(20),
  priorities: z.object({ threeMonths: z.array(z.string()), sixMonths: z.array(z.string()), twelveMonths: z.array(z.string()) }),
  regionalCompatibility: z.array(z.string()).max(10),
  cityTypes: z.array(z.string()).max(8),
  initialInvestmentRange: z.string(),
  recommendedReserve: z.string(),
  preparationTimeEstimate: z.string(),
  recommendedContent: z.array(z.string()).max(12),
  technicalAlerts: z.array(z.string()).max(12),
  followUpQuestions: z.array(z.string()).max(15),
  executiveSummary: z.string().max(3_000),
  confidence: z.number().min(0).max(1),
});

export function assessmentSchemaFor(config: AssessmentConfig) {
  return assessmentOutputSchema.extend({
    methodologyVersion: z.literal(config.methodologyVersion),
    promptVersion: z.literal(config.promptVersion),
    model: z.literal(config.model),
  });
}

export const assessmentSchema = assessmentSchemaFor(operationalConfig);

const methodology = `Metodologia 1.0.0. Calcule preparo, não elegibilidade. Pesos: idiomas 18; formação 12; experiência 13; recursos financeiros 15; prazo 8; flexibilidade 10; clareza do objetivo 8; histórico canadense 5; participação do cônjuge 4; completude 7. Fatores sensíveis (recusa, permanência irregular, questões criminais, médicas ou migratórias) geram alerta técnico e não uma penalidade arbitrária.`;

export async function generateAssessment(answers: FormAnswers, config: AssessmentConfig) {
  const apiKey = process.env.OPEN_ROUTER_API_KEY;
  if (!apiKey) throw new Error("OPEN_ROUTER_API_KEY não configurada.");
  const provider = createOpenRouter({ apiKey });
  const { output } = await generateText({
    model: provider(config.model),
    temperature: 0,
    output: Output.object({ schema: assessmentOutputSchema }),
    system: `Você apoia duas consultoras na triagem educacional de projetos Canadá. Sua saída é um rascunho interno. Não afirme elegibilidade ou inelegibilidade, não garanta visto, permissão, residência ou aprovação, não escolha programa migratório conclusivamente e não dê aconselhamento jurídico definitivo. Não invente regras, critérios, valores ou programas. Diferencie fatos informados de inferências, marque ausências e recomende validação profissional para elegibilidade, inadmissibilidade, recusas, histórico criminal ou médico, permanência irregular, status migratório e escolha de programa. Não exponha raciocínio interno; use somente justificativas curtas e verificáveis. ${methodology}`,
    prompt: `Analise o snapshot abaixo. Dados pessoais diretos foram excluídos do prompt. Respostas:\n${JSON.stringify(answers)}`,
  });
  return assessmentSchemaFor(config).parse({ ...output, methodologyVersion: config.methodologyVersion, promptVersion: config.promptVersion, model: config.model });
}
