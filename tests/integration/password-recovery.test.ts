import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  enforceRateLimit: vi.fn(),
  generateLink: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  sendPasswordRecoveryEmail: vi.fn(),
}));

vi.mock("../../lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/api")>();
  return { ...actual, enforceRateLimit: mocks.enforceRateLimit };
});

vi.mock("../../lib/supabase", () => ({
  getAdminSupabase: () => ({
    auth: {
      admin: { generateLink: mocks.generateLink },
      resetPasswordForEmail: mocks.resetPasswordForEmail,
    },
  }),
}));

vi.mock("../../lib/email", () => ({
  sendPasswordRecoveryEmail: mocks.sendPasswordRecoveryEmail,
}));

import { POST } from "../../app/api/auth/password-recovery/route";

const neutralMessage = "Se a conta estiver ativa, enviaremos as instruções de recuperação.";

function request(email = "Consultora@Example.com") {
  return new Request("https://diagnostico-canada-sem-filtro.vercel.app/api/auth/password-recovery", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email }),
  });
}

describe("recuperação de senha", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.generateLink.mockResolvedValue({
      data: { properties: { hashed_token: "token-hash-de-uso-unico" }, user: { id: "user-id" } },
      error: null,
    });
    mocks.sendPasswordRecoveryEmail.mockResolvedValue({ data: { id: "resend-id" }, error: null });
  });

  it("gera um token de recuperação e envia pelo Resend com a URL correta", async () => {
    const response = await POST(request());
    const body = await response.json() as { message: string };

    expect(response.status).toBe(200);
    expect(body.message).toBe(neutralMessage);
    expect(mocks.generateLink).toHaveBeenCalledWith({ type: "recovery", email: "consultora@example.com" });
    expect(mocks.sendPasswordRecoveryEmail).toHaveBeenCalledWith({
      to: "consultora@example.com",
      resetUrl: "https://diagnostico-canada-sem-filtro.vercel.app/recuperar-senha/confirmar?recovery=1&token_hash=token-hash-de-uso-unico",
    });
  });

  it("não revela se a conta não existe", async () => {
    mocks.generateLink.mockResolvedValue({ data: null, error: { name: "AuthApiError" } });
    mocks.resetPasswordForEmail.mockResolvedValue({ data: null, error: null });

    const response = await POST(request("nao-existe@example.com"));
    const body = await response.json() as { message: string };

    expect(response.status).toBe(200);
    expect(body.message).toBe(neutralMessage);
    expect(mocks.sendPasswordRecoveryEmail).not.toHaveBeenCalled();
    expect(mocks.resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it("rejeita e-mail inválido antes de chamar os provedores", async () => {
    const response = await POST(request("email-invalido"));

    expect(response.status).toBe(422);
    expect(mocks.generateLink).not.toHaveBeenCalled();
    expect(mocks.sendPasswordRecoveryEmail).not.toHaveBeenCalled();
  });

  it("faz fallback para o reset nativo quando o provedor de e-mail falha", async () => {
    mocks.sendPasswordRecoveryEmail.mockResolvedValue({ data: null, error: { name: "ResendError" } });

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(mocks.generateLink).toHaveBeenCalled();
    expect(mocks.sendPasswordRecoveryEmail).toHaveBeenCalled();
    expect(mocks.resetPasswordForEmail).toHaveBeenCalledWith(
      "consultora@example.com",
      { redirectTo: "https://diagnostico-canada-sem-filtro.vercel.app/recuperar-senha/confirmar?recovery=1&token_hash=token-hash-de-uso-unico" },
    );
  });
});
