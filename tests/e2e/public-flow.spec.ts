import { expect, test, type Page, type Route } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

type StartFormData = {
  fullName?: string;
  email?: string;
  emailConfirmation?: string;
  consent?: boolean;
};

async function fillStartForm(page: Page, data: StartFormData = {}) {
  await page.getByLabel("Nome completo").fill(data.fullName ?? "Pessoa Teste");
  await page.getByLabel("E-mail", { exact: true }).fill(data.email ?? "pessoa@example.com");
  await page.getByLabel("Confirmar e-mail").fill(data.emailConfirmation ?? "pessoa@example.com");
  if (data.consent ?? true) await page.getByRole("checkbox").check();
}

async function fulfillStart(route: Route) {
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ message: "Enviamos seu acesso seguro." }),
  });
}

test("@smoke @a11y landing pública apresenta identificação e mensagem sem promessas", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /vamos entender o seu projeto canadá/i })).toBeVisible();
  await expect(page.getByLabel("Nome completo")).toBeVisible();
  await expect(page.getByText(/não promete elegibilidade/i)).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((violation) => ["critical", "serious"].includes(violation.impact ?? ""))).toEqual([]);
});

test("@regression fluxo é navegável por teclado", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus")).toBeVisible();
});

test("@smoke layout mobile mantém a ação principal visível", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: /iniciar meu diagnóstico/i })).toBeVisible();
});

test("@critical @smoke início concluído troca o formulário pela confirmação", async ({ page }) => {
  await page.route("**/api/diagnostics/start", fulfillStart);
  await page.goto("/");
  await fillStartForm(page);
  await page.getByRole("button", { name: /iniciar meu diagnóstico/i }).click();

  await expect(page.getByRole("heading", { name: /agora, confira seu e-mail/i })).toBeVisible();
  await expect(page.getByText("Enviamos seu acesso seguro.")).toBeVisible();
  await expect(page.getByText(/cannot read properties/i)).toHaveCount(0);
});

test("@critical @smoke bloqueia e-mails diferentes antes de chamar a API", async ({ page }) => {
  let requests = 0;
  await page.route("**/api/diagnostics/start", async (route) => {
    requests += 1;
    await fulfillStart(route);
  });
  await page.goto("/");
  await fillStartForm(page, { emailConfirmation: "outra-pessoa@example.com" });
  await page.getByRole("button", { name: /iniciar meu diagnóstico/i }).click();

  const confirmation = page.getByLabel("Confirmar e-mail");
  await expect(page.getByText("Os e-mails precisam ser iguais.")).toBeVisible();
  await expect(confirmation).toHaveAttribute("aria-invalid", "true");
  await expect(confirmation).toBeFocused();
  await expect(page.getByRole("heading", { name: /agora, confira seu e-mail/i })).toHaveCount(0);
  expect(requests).toBe(0);

  await confirmation.fill("pessoa@example.com");
  await expect(page.getByText("Os e-mails precisam ser iguais.")).toHaveCount(0);
  await expect(confirmation).toHaveAttribute("aria-invalid", "false");
  await page.getByRole("button", { name: /iniciar meu diagnóstico/i }).click();
  await expect(page.getByRole("heading", { name: /agora, confira seu e-mail/i })).toBeVisible();
  expect(requests).toBe(1);
});

test("@critical @regression aceita e normaliza diferenças apenas de caixa e espaços", async ({ page }) => {
  let body: Record<string, unknown> | undefined;
  await page.route("**/api/diagnostics/start", async (route) => {
    body = route.request().postDataJSON() as Record<string, unknown>;
    await fulfillStart(route);
  });
  await page.goto("/");
  await fillStartForm(page, {
    email: "  Pessoa@EXAMPLE.com ",
    emailConfirmation: "pessoa@example.com",
  });
  await page.getByRole("button", { name: /iniciar meu diagnóstico/i }).click();

  await expect(page.getByRole("heading", { name: /agora, confira seu e-mail/i })).toBeVisible();
  expect(body?.email).toBe("pessoa@example.com");
  expect(body?.emailConfirmation).toBe("pessoa@example.com");
});

test("@regression exibe erros acessíveis para campos obrigatórios", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /iniciar meu diagnóstico/i }).click();

  await expect(page.getByText("Informe seu nome completo.")).toBeVisible();
  await expect(page.getByText("Informe um e-mail válido.")).toHaveCount(2);
  await expect(page.getByText("Você precisa autorizar o tratamento dos dados.")).toBeVisible();
  await expect(page.getByLabel("Nome completo")).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("Nome completo")).toBeFocused();
});

test("@regression rejeita formato de e-mail inválido sem chamar a API", async ({ page }) => {
  let requests = 0;
  await page.route("**/api/diagnostics/start", async (route) => {
    requests += 1;
    await fulfillStart(route);
  });
  await page.goto("/");
  await fillStartForm(page, { email: "email-invalido", emailConfirmation: "email-invalido" });
  await page.getByRole("button", { name: /iniciar meu diagnóstico/i }).click();

  await expect(page.getByText("Informe um e-mail válido.")).toHaveCount(2);
  expect(requests).toBe(0);
});

test("@regression exige consentimento explícito", async ({ page }) => {
  await page.goto("/");
  await fillStartForm(page, { consent: false });
  await page.getByRole("button", { name: /iniciar meu diagnóstico/i }).click();

  await expect(page.getByText("Você precisa autorizar o tratamento dos dados.")).toBeVisible();
  await expect(page.getByRole("checkbox")).toHaveAttribute("aria-invalid", "true");
});

test("@critical @regression impede submissões duplicadas enquanto a primeira está pendente", async ({ page }) => {
  let requests = 0;
  let releaseRequest!: () => void;
  let markRequestStarted!: () => void;
  const requestStarted = new Promise<void>((resolve) => { markRequestStarted = resolve; });
  await page.route("**/api/diagnostics/start", async (route) => {
    requests += 1;
    markRequestStarted();
    await new Promise<void>((resolve) => { releaseRequest = resolve; });
    await fulfillStart(route);
  });
  await page.goto("/");
  await fillStartForm(page);

  await page.locator("form").evaluate((form: HTMLFormElement) => {
    form.requestSubmit();
    form.requestSubmit();
  });
  await requestStarted;
  await expect(page.getByRole("button", { name: "Enviando…" })).toBeDisabled();
  expect(requests).toBe(1);
  releaseRequest();
  await expect(page.getByRole("heading", { name: /agora, confira seu e-mail/i })).toBeVisible();
});

test("@critical @regression recupera de falha de rede e permite tentar novamente", async ({ page }) => {
  await page.route("**/api/diagnostics/start", (route) => route.abort("failed"));
  await page.goto("/");
  await fillStartForm(page);
  await page.getByRole("button", { name: /iniciar meu diagnóstico/i }).click();

  await expect(page.locator(".form-error")).toHaveText("Não foi possível enviar o link agora. Tente novamente.");
  await expect(page.getByRole("button", { name: /iniciar meu diagnóstico/i })).toBeEnabled();
});

test("@regression retomada exige somente um e-mail válido", async ({ page }) => {
  let body: Record<string, unknown> | undefined;
  await page.route("**/api/diagnostics/resume-link", async (route) => {
    body = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ message: "Se houver um diagnóstico, enviaremos um link." }),
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Já comecei meu diagnóstico" }).click();
  await expect(page.getByLabel("Confirmar e-mail")).toHaveCount(0);
  await page.getByLabel("E-mail", { exact: true }).fill("  Pessoa@EXAMPLE.com ");
  await page.getByRole("button", { name: /enviar link para continuar/i }).click();

  await expect(page.getByRole("heading", { name: /agora, confira seu e-mail/i })).toBeVisible();
  expect(body?.email).toBe("pessoa@example.com");
});
