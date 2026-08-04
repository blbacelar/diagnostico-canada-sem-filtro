import { z } from "zod";

export type OperationalConfig = {
  policyVersion: string;
  methodologyVersion: string;
  promptVersion: string;
  model: string;
  formLinkDays: number;
  reportLinkDays: number;
  reviewSlaHours: number;
};

export const operationalConfig: OperationalConfig = {
  policyVersion: "2026-08-03",
  methodologyVersion: "1.0.0",
  promptVersion: "2026-08-03",
  model: "openai/gpt-5.6-terra",
  formLinkDays: 14,
  reportLinkDays: 30,
  reviewSlaHours: 48,
};

const versionSchema = z
  .string()
  .trim()
  .min(1, "Informe uma versão.")
  .max(40, "Use no máximo 40 caracteres.")
  .regex(/^[A-Za-z0-9._-]+$/, "Use apenas letras, números, ponto, hífen ou sublinhado.");

export const operationalSettingsUpdateSchema = z.object({
  policy_version: versionSchema,
  methodology_version: versionSchema,
  prompt_version: versionSchema,
  model: z
    .string()
    .trim()
    .min(3, "Informe o modelo no formato provedor/modelo.")
    .max(200, "Use no máximo 200 caracteres.")
    .regex(/^[A-Za-z0-9._-]+\/[A-Za-z0-9._:-]+$/, "Use o formato provedor/modelo."),
  form_link_days: z.number({ error: "Informe a validade em dias." }).int("Use um número inteiro.").min(1, "O mínimo é 1 dia.").max(90, "O máximo é 90 dias."),
  report_link_days: z.number({ error: "Informe a validade em dias." }).int("Use um número inteiro.").min(1, "O mínimo é 1 dia.").max(365, "O máximo é 365 dias."),
  review_sla_hours: z.number({ error: "Informe a meta em horas." }).int("Use um número inteiro.").min(1, "O mínimo é 1 hora.").max(720, "O máximo é 720 horas."),
  revision: z.number().int().positive(),
}).strict();

export type OperationalSettingsUpdate = z.infer<typeof operationalSettingsUpdateSchema>;

export type OperationalSettingsRecord = Omit<OperationalSettingsUpdate, "revision"> & {
  revision: number;
  updated_at: string;
};
