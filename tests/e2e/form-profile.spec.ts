import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { formatCurrencyAmount } from "../../lib/currency";
import { diagnosticSections, visibleQuestions } from "../../lib/questions";

async function openProfile(page: Page, answers: Record<string, unknown> = {}) {
  await page.route("**/api/diagnostics/form-session", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      caseNumber: "CAN-E2E-001",
      status: "client_draft",
      answers,
      client: { fullName: "Pessoa Teste" },
      submittedAt: null,
    }),
  }));
  await page.route("**/api/diagnostics/answers", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ savedAt: new Date().toISOString() }),
  }));
  await page.goto("/formulario?token=e2e-token");
  await expect(page.getByRole("heading", { name: "Perfil pessoal" })).toBeVisible();
}

function question(page: Page, key: string) {
  return page.locator(`[data-question-key="${key}"]`);
}

function completeRequiredAnswers() {
  const answers: Record<string, unknown> = {};
  for (const section of diagnosticSections) {
    for (const question of visibleQuestions(section, answers)) {
      if (!question.required) continue;
      if (question.type === "number") answers[question.key] = question.min ?? 1;
      else if (question.type === "multi") answers[question.key] = [question.options?.[0] ?? "Teste"];
      else if (question.type === "boolean") answers[question.key] = false;
      else if (question.options?.length) answers[question.key] = question.options.at(-1);
      else answers[question.key] = "Resposta de teste";
    }
  }
  return answers;
}

async function openReview(page: Page) {
  await page.goto("/formulario?token=e2e-submit-token");
  await expect(page.getByRole("heading", { name: "Perfil pessoal" })).toBeVisible();
  await page.getByRole("button", { name: /Revisão e envio$/ }).click();
  await expect(page.getByRole("heading", { name: "Revise antes de enviar" })).toBeVisible();
}

test("@regression perfil pessoal usa controles shadcn e limpa respostas condicionais", async ({ page }) => {
  await openProfile(page);

  const maritalStatus = page.getByRole("combobox", { name: "Qual é o seu estado civil?" });
  await expect(maritalStatus).toBeVisible();
  await expect(page.locator('select[name="marital_status"]')).toHaveCount(0);
  await maritalStatus.click();
  await expect(page.getByRole("option", { name: "Casado(a)" })).toBeVisible();
  await page.getByRole("option", { name: "Casado(a)" }).click();
  await expect(maritalStatus).toHaveText("Casado(a)");

  const hasChildren = page.getByRole("checkbox", { name: "Tenho filhos" });
  await expect(hasChildren).not.toBeChecked();
  await expect(question(page, "children_count")).toHaveCount(0);
  await expect(question(page, "children_ages")).toHaveCount(0);

  await hasChildren.click();
  await expect(hasChildren).toBeChecked();
  await page.getByRole("spinbutton", { name: "Quantos filhos?" }).fill("2");
  await page.getByRole("textbox", { name: "Idade dos filhos" }).fill("4 e 9 anos");

  await hasChildren.click();
  await expect(question(page, "children_count")).toHaveCount(0);
  await expect(question(page, "children_ages")).toHaveCount(0);

  await hasChildren.click();
  await expect(page.getByRole("spinbutton", { name: "Quantos filhos?" })).toHaveValue("");
  await expect(page.getByRole("textbox", { name: "Idade dos filhos" })).toHaveValue("");
});

test("@regression @a11y select shadcn funciona por teclado e mantém semântica acessível", async ({ page }) => {
  await openProfile(page);

  const maritalStatus = page.getByRole("combobox", { name: "Qual é o seu estado civil?" });
  await maritalStatus.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("option", { name: "Solteiro(a)" })).toBeVisible();
  await page.keyboard.press("Home");
  await page.keyboard.press("Enter");
  await expect(maritalStatus).toHaveText("Solteiro(a)");

  await maritalStatus.click();
  const selectedOption = page.getByRole("option", { name: "Solteiro(a)" });
  await expect(selectedOption).toHaveAttribute("data-state", "checked");
  await expect(selectedOption.locator("span").last()).toHaveCSS("color", "rgb(23, 34, 43)");
  await expect(selectedOption).toHaveCSS("background-color", "rgba(183, 28, 61, 0.08)");
  await page.keyboard.press("Escape");
  await expect(selectedOption).toBeHidden();

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((violation) => ["critical", "serious"].includes(violation.impact ?? ""))).toEqual([]);
});

test("@regression grade desktop agrupa status pessoal, residência e filhos", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Validação específica do breakpoint desktop.");
  await openProfile(page);

  const age = await question(page, "age").boundingBox();
  const nationality = await question(page, "nationality").boundingBox();
  const country = await question(page, "country_of_residence").boundingBox();
  const marital = await question(page, "marital_status").boundingBox();
  expect(age).not.toBeNull();
  expect(nationality).not.toBeNull();
  expect(country).not.toBeNull();
  expect(marital).not.toBeNull();
  expect(age!.width).toBeLessThan(marital!.width);
  expect(Math.abs(age!.y - marital!.y)).toBeLessThan(2);
  expect(Math.abs(nationality!.width - country!.width)).toBeLessThan(2);
  expect(Math.abs(nationality!.y - country!.y)).toBeLessThan(2);
  expect(nationality!.y).toBeGreaterThan(age!.y + age!.height);

  await page.getByRole("checkbox", { name: "Tenho filhos" }).click();
  const childrenToggle = await question(page, "has_children").boundingBox();
  const childrenCount = await question(page, "children_count").boundingBox();
  const childrenAges = await question(page, "children_ages").boundingBox();
  expect(childrenToggle).not.toBeNull();
  expect(childrenCount).not.toBeNull();
  expect(childrenAges).not.toBeNull();
  expect(Math.abs(childrenToggle!.y - childrenCount!.y)).toBeLessThan(2);
  expect(Math.abs(childrenCount!.y - childrenAges!.y)).toBeLessThan(2);
});

test("@regression todas as seções preservam linhas semânticas e alinhamento visual", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Validação visual da grade completa no breakpoint desktop.");
  await openProfile(page, {
    has_children: true,
    marital_status: "Casado(a)",
    canadian_work_experience: "Sim",
    english_test: "IELTS",
    french_test: "TEF",
    has_refusal: "Sim",
  });

  const sectionRows = [
    ["Perfil pessoal", ["personal-status", "residence", "children", "partner-context"]],
    ["Objetivo principal", ["objective", "objective-context"]],
    ["Formação acadêmica", ["education-background", "education-credentials", "education-institution"]],
    ["Experiência profissional", ["career-summary", "career-profile", "canadian-experience"]],
    ["Inglês e francês", ["english", "english-details", "french", "french-details", "language-investment"]],
    ["Recursos financeiros", ["available-funds", "funds-scope", "funding-options", "financial-context"]],
    ["Cônjuge ou parceiro", ["spouse-background", "spouse-career", "spouse-languages", "spouse-commitment", "spouse-context"]],
    ["Histórico migratório", ["canada-history", "compliance-history", "refusal-details", "canada-family", "admissibility", "immigration-context"]],
    ["Preferências de vida", ["life-priorities", "location-fit", "location-preference", "family-needs"]],
    ["Prazo e flexibilidade", ["timeline-flexibility", "project-adaptations"]],
    ["Obstáculos e dúvidas", ["biggest-challenge", "difficulty-factors", "main-question", "anything-else"]],
  ] as const;

  for (const [sectionTitle, rows] of sectionRows) {
    if (sectionTitle !== "Perfil pessoal") await page.getByRole("button", { name: new RegExp(`${sectionTitle}$`) }).click();
    await expect(page.getByRole("heading", { name: sectionTitle, exact: true })).toBeVisible();

    for (const rowKey of rows) {
      const row = page.locator(`[data-layout-row="${rowKey}"]`);
      await expect(row).toBeVisible();
      const boxes = await row.locator(":scope > .question-card").evaluateAll((cards) => cards.map((card) => {
        const box = card.getBoundingClientRect();
        return { y: box.y, height: box.height };
      }));
      expect(boxes.length).toBeGreaterThan(0);
      expect(Math.max(...boxes.map(box => box.y)) - Math.min(...boxes.map(box => box.y))).toBeLessThan(2);
      expect(Math.max(...boxes.map(box => box.height)) - Math.min(...boxes.map(box => box.height))).toBeLessThan(2);
    }
  }
});

test("@regression grade mobile empilha os campos sem overflow horizontal", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Validação específica do breakpoint mobile.");
  await openProfile(page);

  const age = await question(page, "age").boundingBox();
  const marital = await question(page, "marital_status").boundingBox();
  const nationality = await question(page, "nationality").boundingBox();
  expect(age).not.toBeNull();
  expect(marital).not.toBeNull();
  expect(nationality).not.toBeNull();
  expect(Math.abs(age!.x - marital!.x)).toBeLessThan(2);
  expect(Math.abs(marital!.x - nationality!.x)).toBeLessThan(2);
  expect(marital!.y).toBeGreaterThan(age!.y + age!.height);
  expect(nationality!.y).toBeGreaterThan(marital!.y + marital!.height);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(await page.evaluate(() => document.documentElement.clientWidth));
});

test("@regression valor disponível é formatado como moeda e salvo como número", async ({ page }) => {
  await openProfile(page, { available_funds: 300000, funds_currency: "BRL" });
  await page.getByRole("button", { name: /Recursos financeiros$/ }).click();

  const amount = page.getByRole("textbox", { name: "Quanto possui disponível para investir no projeto Canadá?" });
  await expect(amount).toHaveValue(formatCurrencyAmount(300000, "BRL"));
  await expect(question(page, "available_funds").getByText("BRL")).toBeVisible();

  const numericSave = page.waitForRequest((request) => {
    if (!request.url().includes("/api/diagnostics/answers") || request.method() !== "PUT") return false;
    return request.postDataJSON().answers.available_funds === 125000.5;
  });
  await amount.focus();
  await expect(amount).toHaveValue("300.000");
  await amount.fill("125000,50");
  await expect(amount).toHaveValue("125.000,50");
  await page.getByRole("heading", { name: "Recursos financeiros" }).click();
  await expect(amount).toHaveValue(formatCurrencyAmount(125000.5, "BRL"));
  await numericSave;

  const currency = page.getByRole("combobox", { name: "Em qual moeda?" });
  await currency.click();
  await page.getByRole("option", { name: "CAD" }).click();
  await expect(amount).toHaveValue(formatCurrencyAmount(125000.5, "CAD"));
  await expect(question(page, "available_funds").getByText("CAD")).toBeVisible();
});

test("@critical @regression valida números, texto livre e exibe erros acessíveis na UI", async ({ page }) => {
  await openProfile(page);

  const age = page.getByRole("spinbutton", { name: "Qual é a sua idade?" });
  await age.fill("15");
  await age.blur();
  await expect(question(page, "age").getByRole("alert")).toHaveText("Informe um número inteiro entre 16 e 100.");
  await expect(age).toHaveAttribute("aria-invalid", "true");

  await age.fill("35");
  await age.blur();
  await expect(question(page, "age").getByRole("alert")).toHaveCount(0);
  await expect(age).toHaveAttribute("aria-invalid", "false");

  const nationality = page.getByRole("textbox", { name: "Qual é a sua nacionalidade?" });
  await nationality.fill("Brasileira — luso-canadense, 2ª geração!");
  await nationality.blur();
  await expect(nationality).toHaveValue("Brasileira — luso-canadense, 2ª geração!");
  await expect(question(page, "nationality").getByRole("alert")).toHaveCount(0);

  await age.focus();
  await age.pressSequentially("e-.,abc");
  await expect(age).toHaveValue("35");
});

test("@critical @regression entrada monetária descarta caracteres não monetários", async ({ page }) => {
  await openProfile(page, { funds_currency: "BRL" });
  await page.getByRole("button", { name: /Recursos financeiros$/ }).click();

  const amount = page.getByRole("textbox", { name: "Quanto possui disponível para investir no projeto Canadá?" });
  await amount.fill("R$ abc 1.234,567");
  await expect(amount).toHaveValue("1.234,56");
  await amount.blur();
  await expect(amount).toHaveValue(formatCurrencyAmount(1234.56, "BRL"));
  await expect(question(page, "available_funds").getByRole("alert")).toHaveCount(0);

  await amount.focus();
  await expect(amount).toHaveValue("1.234,56");
  await amount.fill("-100");
  await expect(amount).toHaveValue("-100");
  await amount.blur();
  await expect(amount).toHaveValue(formatCurrencyAmount(-100, "BRL"));
  await expect(question(page, "available_funds").getByRole("alert")).toHaveText("O valor deve ser maior ou igual a 0.");
});

test("@critical @regression diagnóstico enviado não exibe novamente a ação de envio", async ({ page }) => {
  await page.route("**/api/diagnostics/form-session", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      caseNumber: "CAN-E2E-SUBMITTED",
      status: "ai_processing",
      answers: completeRequiredAnswers(),
      client: { fullName: "Pessoa Teste" },
      submittedAt: new Date().toISOString(),
    }),
  }));

  await page.goto("/formulario?token=e2e-submitted-token");
  await expect(page.getByRole("heading", { name: "Diagnóstico já enviado" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Enviar para análise" })).toHaveCount(0);
});

test("@critical @regression aba desatualizada aceita o bloqueio final sem tentar reenviar", async ({ page }) => {
  let submitRequests = 0;
  await page.route("**/api/diagnostics/form-session", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ caseNumber: "CAN-E2E-LOCKED", status: "client_draft", answers: completeRequiredAnswers(), client: { fullName: "Pessoa Teste" }, submittedAt: null }),
  }));
  await page.route("**/api/diagnostics/answers", (route) => route.fulfill({
    status: 409,
    contentType: "application/json",
    body: JSON.stringify({ error: "As respostas deste diagnóstico já foram enviadas.", code: "ANSWERS_LOCKED" }),
  }));
  await page.route("**/api/diagnostics/submit", (route) => {
    submitRequests += 1;
    return route.fulfill({ status: 500, body: "should not be called" });
  });

  await openReview(page);
  await page.getByRole("button", { name: "Enviar para análise" }).click();
  await expect(page.getByRole("heading", { name: "Diagnóstico já enviado" })).toBeVisible();
  expect(submitRequests).toBe(0);
});

test("@critical @regression conflito de envio troca o formulário pelo estado bloqueado", async ({ page }) => {
  let submitRequests = 0;
  await page.route("**/api/diagnostics/form-session", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ caseNumber: "CAN-E2E-CONFLICT", status: "client_draft", answers: completeRequiredAnswers(), client: { fullName: "Pessoa Teste" }, submittedAt: null }),
  }));
  await page.route("**/api/diagnostics/answers", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ savedAt: new Date().toISOString() }) }));
  await page.route("**/api/diagnostics/submit", (route) => {
    submitRequests += 1;
    return route.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ error: "Este diagnóstico já foi enviado.", code: "ALREADY_SUBMITTED" }) });
  });

  await openReview(page);
  await page.getByRole("button", { name: "Enviar para análise" }).click();
  await expect(page.getByRole("heading", { name: "Diagnóstico já enviado" })).toBeVisible();
  expect(submitRequests).toBe(1);
});

test("@critical @regression cliques rápidos produzem somente um envio idempotente", async ({ page }) => {
  const submissions: Array<{ headerKey: string | null; bodyKey: string }> = [];
  await page.route("**/api/diagnostics/form-session", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ caseNumber: "CAN-E2E-ONCE", status: "client_draft", answers: completeRequiredAnswers(), client: { fullName: "Pessoa Teste" }, submittedAt: null }),
  }));
  await page.route("**/api/diagnostics/answers", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ savedAt: new Date().toISOString() }) }));
  await page.route("**/api/diagnostics/submit", async (route) => {
    const body = route.request().postDataJSON() as { idempotencyKey: string };
    submissions.push({ headerKey: route.request().headers()["idempotency-key"] ?? null, bodyKey: body.idempotencyKey });
    await route.fulfill({ status: 202, contentType: "application/json", body: JSON.stringify({ caseNumber: "CAN-E2E-ONCE", expectedTime: "até 5 dias úteis" }) });
  });

  await openReview(page);
  const submitButton = page.getByRole("button", { name: "Enviar para análise" });
  await submitButton.evaluate((button) => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await expect(page.getByRole("heading", { name: "Respostas recebidas" })).toBeVisible();
  expect(submissions).toHaveLength(1);
  expect(submissions[0].headerKey).toBe(submissions[0].bodyKey);
});
