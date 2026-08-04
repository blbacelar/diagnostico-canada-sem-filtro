import { z } from "zod";

const emailSchema = z
  .string()
  .trim()
  .email("Informe um e-mail válido.")
  .max(254, "O e-mail deve ter no máximo 254 caracteres.")
  .transform((value) => value.toLowerCase());

export const startDiagnosticSchema = z
  .object({
    fullName: z.string().trim().min(3, "Informe seu nome completo.").max(160, "O nome deve ter no máximo 160 caracteres."),
    email: emailSchema,
    emailConfirmation: emailSchema,
    consent: z.literal(true, { error: "Você precisa autorizar o tratamento dos dados." }),
    policyVersion: z.string().trim().min(1).max(40),
    source: z.literal("hotmart").default("hotmart"),
    utm: z.record(z.string(), z.string().max(120)).optional(),
    website: z.string().max(0).optional(),
  })
  .refine((data) => data.email === data.emailConfirmation, {
    path: ["emailConfirmation"],
    message: "Os e-mails precisam ser iguais.",
  });

export const resumeLinkSchema = z.object({ email: emailSchema, website: z.string().max(0).optional() });

export const passwordRecoveryRequestSchema = z.object({
  email: emailSchema,
  website: z.string().max(0).optional(),
});

export const passwordResetSchema = z
  .object({
    password: z
      .string()
      .min(12, "A senha precisa ter pelo menos 12 caracteres.")
      .max(72, "A senha deve ter no máximo 72 caracteres.")
      .regex(/[a-z]/, "Inclua pelo menos uma letra minúscula.")
      .regex(/[A-Z]/, "Inclua pelo menos uma letra maiúscula.")
      .regex(/[0-9]/, "Inclua pelo menos um número."),
    passwordConfirmation: z.string(),
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    path: ["passwordConfirmation"],
    message: "As senhas precisam ser iguais.",
  });

export const answersPayloadSchema = z.object({
  answers: z.record(z.string().min(1).max(80), z.unknown()).refine((value) => JSON.stringify(value).length <= 100_000),
  schemaVersion: z.literal(1).default(1),
});

export const submitPayloadSchema = z.object({
  consent: z.literal(true),
  policyVersion: z.string().min(1).max(40),
  idempotencyKey: z.string().uuid(),
});

export const requestInformationSchema = z.object({
  caseId: z.string().uuid(),
  subject: z.string().trim().min(3).max(180),
  message: z.string().trim().min(10).max(8_000),
  idempotencyKey: z.string().uuid(),
});

export const reviewSchema = z.object({
  caseId: z.string().uuid(),
  coherentPath: z.string().max(12_000),
  assumptionsToReview: z.string().max(12_000),
  likelyMistakes: z.string().max(12_000),
  immediateFocus: z.string().max(12_000),
  studyStrategy: z.string().max(12_000),
  validationRisks: z.string().max(12_000),
  nextSteps: z.array(z.string().min(1).max(2_000)).min(3).max(3),
  additionalNotes: z.string().max(12_000),
  recommendedResources: z.array(z.string().max(2_000)).max(20),
  status: z.enum(["draft", "ready_for_approval"]),
});

export const approveSchema = z.object({ caseId: z.string().uuid(), reviewId: z.string().uuid() });

export const sendDiagnosticSchema = z.object({
  caseId: z.string().uuid(),
  reviewId: z.string().uuid(),
  subject: z.string().trim().min(3).max(180),
  body: z.string().trim().min(10).max(30_000),
  deliveryMethod: z.enum(["secure_link", "pdf"]).default("secure_link"),
  idempotencyKey: z.string().uuid(),
});

export function normalizeEmail(value: string) {
  return emailSchema.parse(value);
}

export function sanitizedUtm(params: URLSearchParams) {
  const allowed = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];
  return Object.fromEntries(
    allowed.flatMap((key) => {
      const value = params.get(key)?.trim().slice(0, 120);
      return value ? [[key, value]] : [];
    }),
  );
}
