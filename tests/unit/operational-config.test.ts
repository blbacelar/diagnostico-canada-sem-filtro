import { describe, expect, it } from "vitest";
import { operationalSettingsUpdateSchema } from "../../lib/operational-config";

const valid = {
  policy_version: "2026-08-03",
  methodology_version: "1.0.0",
  prompt_version: "2026-08-03",
  model: "openai/gpt-5.6-terra",
  form_link_days: 14,
  report_link_days: 30,
  review_sla_hours: 48,
  revision: 1,
};

describe("parâmetros operacionais", () => {
  it("aceita uma configuração completa e tipada", () => {
    expect(operationalSettingsUpdateSchema.parse(valid)).toEqual(valid);
  });

  it.each([
    ["formulário abaixo do limite", { form_link_days: 0 }, "O mínimo é 1 dia."],
    ["formulário acima do limite", { form_link_days: 91 }, "O máximo é 90 dias."],
    ["relatório acima do limite", { report_link_days: 366 }, "O máximo é 365 dias."],
    ["SLA acima do limite", { review_sla_hours: 721 }, "O máximo é 720 horas."],
    ["valor fracionário", { review_sla_hours: 1.5 }, "Use um número inteiro."],
    ["modelo sem provedor", { model: "gpt-5.6-terra" }, "Use o formato provedor/modelo."],
  ])("rejeita %s", (_scenario, change, message) => {
    const result = operationalSettingsUpdateSchema.safeParse({ ...valid, ...change });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.message).toBe(message);
  });

  it("rejeita propriedades desconhecidas e revisão inválida", () => {
    expect(operationalSettingsUpdateSchema.safeParse({ ...valid, segredo: "não" }).success).toBe(false);
    expect(operationalSettingsUpdateSchema.safeParse({ ...valid, revision: 0 }).success).toBe(false);
  });
});
