import { describe, expect, it } from "vitest";
import { normalizeEmail, passwordResetSchema, resumeLinkSchema, sanitizedUtm, startDiagnosticSchema } from "../../lib/schemas";

const validStartPayload = {
  fullName: "Pessoa Teste",
  email: "pessoa@example.com",
  emailConfirmation: "pessoa@example.com",
  consent: true,
  policyVersion: "v1",
  source: "hotmart",
} as const;

describe("normalização e identificação", () => {
  it("normaliza o e-mail sem alterar a identidade", () => {
    expect(normalizeEmail("  Pessoa@EXEMPLO.com ")).toBe("pessoa@exemplo.com");
  });

  it("aceita confirmação equivalente depois da normalização", () => {
    const result = startDiagnosticSchema.safeParse({
      ...validStartPayload,
      email: " Pessoa@EXAMPLE.com ",
      emailConfirmation: "pessoa@example.com",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("pessoa@example.com");
      expect(result.data.emailConfirmation).toBe("pessoa@example.com");
    }
  });

  it("recusa confirmações diferentes com erro no campo de confirmação", () => {
    const result = startDiagnosticSchema.safeParse({
      ...validStartPayload,
      emailConfirmation: "outra@example.com",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.emailConfirmation).toContain("Os e-mails precisam ser iguais.");
    }
  });

  it.each(["sem-arroba", "@example.com", "pessoa@", "pessoa exemplo@example.com"])(
    "recusa o formato inválido %s",
    (email) => {
      const result = startDiagnosticSchema.safeParse({
        ...validStartPayload,
        email,
        emailConfirmation: email,
      });
      expect(result.success).toBe(false);
    },
  );

  it("recusa e-mail acima do limite aceito", () => {
    const email = `${"a".repeat(244)}@example.com`;
    expect(startDiagnosticSchema.safeParse({ ...validStartPayload, email, emailConfirmation: email }).success).toBe(false);
  });

  it.each(["", "A", "AB"])("recusa nome curto: %j", (fullName) => {
    expect(startDiagnosticSchema.safeParse({ ...validStartPayload, fullName }).success).toBe(false);
  });

  it("aceita nome com exatamente três caracteres depois de remover espaços externos", () => {
    const result = startDiagnosticSchema.safeParse({ ...validStartPayload, fullName: " Ana " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.fullName).toBe("Ana");
  });

  it("recusa nome acima de 160 caracteres", () => {
    expect(startDiagnosticSchema.safeParse({ ...validStartPayload, fullName: "a".repeat(161) }).success).toBe(false);
  });

  it("exige consentimento explícito", () => {
    expect(startDiagnosticSchema.safeParse({ ...validStartPayload, consent: false }).success).toBe(false);
  });

  it("recusa campo honeypot preenchido", () => {
    expect(startDiagnosticSchema.safeParse({ ...validStartPayload, website: "bot" }).success).toBe(false);
  });

  it("normaliza o e-mail na retomada", () => {
    expect(resumeLinkSchema.parse({ email: " Pessoa@EXAMPLE.com " }).email).toBe("pessoa@example.com");
  });

  it("mantém apenas UTMs permitidas, preenchidas e limitadas", () => {
    const params = new URLSearchParams({
      utm_source: " newsletter ",
      utm_campaign: "x".repeat(130),
      ignored: "secret",
      utm_term: "   ",
    });
    expect(sanitizedUtm(params)).toEqual({
      utm_source: "newsletter",
      utm_campaign: "x".repeat(120),
    });
  });
});

describe("nova senha", () => {
  it("aceita uma senha forte com confirmação idêntica", () => {
    expect(passwordResetSchema.safeParse({ password: "SenhaSegura2026", passwordConfirmation: "SenhaSegura2026" }).success).toBe(true);
  });

  it.each([
    ["curta", "Senha1"],
    ["sem maiúscula", "senhasegura2026"],
    ["sem minúscula", "SENHASEGURA2026"],
    ["sem número", "SenhaMuitoSegura"],
    ["acima do limite", `Aa1${"x".repeat(70)}`],
  ])("recusa senha %s", (_scenario, password) => {
    expect(passwordResetSchema.safeParse({ password, passwordConfirmation: password }).success).toBe(false);
  });

  it("recusa confirmação diferente", () => {
    const result = passwordResetSchema.safeParse({ password: "SenhaSegura2026", passwordConfirmation: "OutraSenha2026" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.flatten().fieldErrors.passwordConfirmation).toContain("As senhas precisam ser iguais.");
  });
});
