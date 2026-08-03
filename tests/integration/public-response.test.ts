import { describe, expect, it } from "vitest";
import { POST } from "../../app/api/diagnostics/start/route";

const validPayload = {
  fullName: "Pessoa Teste",
  email: "pessoa@example.com",
  emailConfirmation: "pessoa@example.com",
  consent: true,
  policyVersion: "v1",
  source: "hotmart",
};

async function postStart(payload: Record<string, unknown>) {
  return POST(new Request("http://localhost/api/diagnostics/start", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  }));
}

describe("contrato público e prevenção de enumeração", () => {
  it("mantém resposta pública neutra mesmo sem backend configurado", async () => {
    const previousServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const previousTokenSecret = process.env.FORM_TOKEN_SECRET;
    try {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      process.env.FORM_TOKEN_SECRET = "segredo-de-teste-com-mais-de-trinta-e-dois-caracteres";
      const response = await postStart(validPayload);
      const body = await response.json() as { message: string };

      expect(response.status).toBe(200);
      expect(body.message.toLowerCase()).not.toContain("cadastrado");
      expect(body.message.toLowerCase()).toContain("receberá");
    } finally {
      if (previousServiceRoleKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      else process.env.SUPABASE_SERVICE_ROLE_KEY = previousServiceRoleKey;
      if (previousTokenSecret === undefined) delete process.env.FORM_TOKEN_SECRET;
      else process.env.FORM_TOKEN_SECRET = previousTokenSecret;
    }
  });

  it.each([
    ["e-mails diferentes", { ...validPayload, emailConfirmation: "outra@example.com" }],
    ["e-mail inválido", { ...validPayload, email: "inválido", emailConfirmation: "inválido" }],
    ["consentimento ausente", { ...validPayload, consent: false }],
    ["nome curto", { ...validPayload, fullName: "AB" }],
    ["honeypot preenchido", { ...validPayload, website: "bot" }],
  ])("não expõe detalhes internos para %s", async (_scenario, payload) => {
    const response = await postStart(payload);
    const body = await response.json() as { message: string; details?: unknown };

    expect(response.status).toBe(200);
    expect(body.message.toLowerCase()).toContain("receberá");
    expect(body.details).toBeUndefined();
  });
});
