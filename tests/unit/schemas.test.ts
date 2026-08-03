import { describe, expect, it } from "vitest";
import { normalizeEmail, startDiagnosticSchema } from "../../lib/schemas";

describe("normalização e identificação", () => {
  it("normaliza o e-mail sem alterar a identidade", () => expect(normalizeEmail("  Pessoa@EXEMPLO.com ")).toBe("pessoa@exemplo.com"));
  it("recusa confirmações diferentes", () => {
    const result = startDiagnosticSchema.safeParse({ fullName: "Pessoa Teste", email: "a@example.com", emailConfirmation: "b@example.com", consent: true, policyVersion: "v1", source: "hotmart" });
    expect(result.success).toBe(false);
  });
  it("exige consentimento explícito", () => {
    const result = startDiagnosticSchema.safeParse({ fullName: "Pessoa Teste", email: "a@example.com", emailConfirmation: "a@example.com", consent: false, policyVersion: "v1", source: "hotmart" });
    expect(result.success).toBe(false);
  });
});
