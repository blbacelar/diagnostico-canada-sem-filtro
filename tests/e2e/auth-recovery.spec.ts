import { expect, test, type Page } from "@playwright/test";
import { publicSupabaseUrl } from "../../lib/supabase";

const projectRef = new URL(publicSupabaseUrl).hostname.split(".")[0];
const authStorageKey = `sb-${projectRef}-auth-token`;
const userId = "11111111-1111-4111-8111-111111111111";

function jwt(payload: Record<string, unknown>) {
  const encode = (value: Record<string, unknown>) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode(payload)}.test-signature`;
}

function recoveryFixture() {
  const now = Math.floor(Date.now() / 1000);
  const user = {
    id: userId,
    aud: "authenticated",
    role: "authenticated",
    email: "consultora@example.com",
    email_confirmed_at: new Date().toISOString(),
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: {},
    identities: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    is_anonymous: false,
  };
  const session = {
    access_token: jwt({ sub: userId, aud: "authenticated", role: "authenticated", email: user.email, iat: now, exp: now + 3600 }),
    refresh_token: "test-refresh-token",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: now + 3600,
    user,
  };
  return { session, user };
}

async function mockRecoverySession(page: Page) {
  const { session, user } = recoveryFixture();
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), { key: authStorageKey, value: JSON.stringify(session) });
  return user;
}

test("@critical @regression recuperação solicita link para a página de nova senha", async ({ page }) => {
  let requestedEmail: string | null = null;
  await page.route("**/api/auth/password-recovery", async (route) => {
    requestedEmail = (route.request().postDataJSON() as { email: string }).email;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ message: "Se a conta estiver ativa, enviaremos as instruções de recuperação." }),
    });
  });

  await page.goto("/recuperar-senha");
  await page.getByRole("textbox", { name: "E-mail profissional" }).fill("consultora@example.com");
  await page.getByRole("button", { name: "Enviar instruções" }).click();

  await expect(page.getByRole("status")).toContainText("enviaremos as instruções");
  expect(requestedEmail).toBe("consultora@example.com");
});

test("@critical @regression link ausente ou inválido não permite trocar a senha", async ({ page }) => {
  await page.goto("/recuperar-senha/confirmar?recovery=1");
  await expect(page.getByRole("heading", { name: "Este link não é mais válido" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Salvar nova senha" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Solicitar novo link" })).toHaveAttribute("href", "/recuperar-senha");
});

test("@critical @regression callback de recuperação estabelece a sessão a partir do link", async ({ page }) => {
  const { session, user } = recoveryFixture();
  await page.route("**/auth/v1/user", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(user) }));

  await page.goto(`/recuperar-senha/confirmar?recovery=1#access_token=${encodeURIComponent(session.access_token)}&refresh_token=${encodeURIComponent(session.refresh_token)}&expires_in=3600&token_type=bearer&type=recovery`);

  await expect(page.getByRole("button", { name: "Salvar nova senha" })).toBeVisible();
  expect(page.url()).toBe(`${new URL(page.url()).origin}/recuperar-senha/confirmar?recovery=1`);
});

test("@critical @regression link do Resend valida o token de recuperação de uso único", async ({ page }) => {
  const { session, user } = recoveryFixture();
  let verification: { token_hash?: string; type?: string } | null = null;
  await page.route("**/auth/v1/verify", async (route) => {
    verification = route.request().postDataJSON() as { token_hash?: string; type?: string };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(session) });
  });
  await page.route("**/auth/v1/user", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(user) }));

  await page.goto("/recuperar-senha/confirmar?recovery=1&token_hash=token-secreto-de-recuperacao");

  await expect(page.getByRole("button", { name: "Salvar nova senha" })).toBeVisible();
  expect(verification).toEqual(expect.objectContaining({ token_hash: "token-secreto-de-recuperacao", type: "recovery" }));
  expect(page.url()).toBe(`${new URL(page.url()).origin}/recuperar-senha/confirmar?recovery=1`);
});

test("@critical @regression nova senha exige força e confirmação idêntica", async ({ page }) => {
  const user = await mockRecoverySession(page);
  await page.route("**/auth/v1/user", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(user) }));

  await page.goto("/recuperar-senha/confirmar?recovery=1");
  await expect(page.getByRole("button", { name: "Salvar nova senha" })).toBeVisible();
  await page.getByLabel("Nova senha", { exact: true }).fill("SenhaSegura2026");
  await page.getByLabel("Confirme a nova senha", { exact: true }).fill("OutraSenha2026");
  await page.getByRole("button", { name: "Salvar nova senha" }).click();

  await expect(page.getByText("As senhas precisam ser iguais.", { exact: true })).toBeVisible();
});

test("@critical @regression sessão de recuperação atualiza senha e é encerrada", async ({ page }) => {
  const user = await mockRecoverySession(page);
  let updatedPassword: string | null = null;
  let logoutRequests = 0;
  await page.route("**/auth/v1/user", async (route) => {
    if (route.request().method() === "PUT") {
      updatedPassword = (route.request().postDataJSON() as { password: string }).password;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(user) });
  });
  await page.route("**/auth/v1/logout*", async (route) => {
    logoutRequests += 1;
    await route.fulfill({ status: 204, body: "" });
  });

  await page.goto("/recuperar-senha/confirmar?recovery=1");
  await page.getByLabel("Nova senha", { exact: true }).fill("SenhaSegura2026");
  await page.getByLabel("Confirme a nova senha", { exact: true }).fill("SenhaSegura2026");
  await page.getByRole("button", { name: "Salvar nova senha" }).click();

  await expect(page.getByRole("heading", { name: "Senha atualizada" })).toBeVisible();
  expect(updatedPassword).toBe("SenhaSegura2026");
  expect(logoutRequests).toBe(1);
  await expect(page.getByRole("link", { name: "Ir para o login" })).toHaveAttribute("href", "/login?reset=success");
});

test("@regression login confirma a atualização sem expor dados técnicos", async ({ page }) => {
  await page.goto("/login?reset=success");
  await expect(page.getByRole("status")).toHaveText("Senha atualizada. Entre com sua nova senha.");
  await expect(page.getByText("diagnostic_consultants")).toHaveCount(0);
});
