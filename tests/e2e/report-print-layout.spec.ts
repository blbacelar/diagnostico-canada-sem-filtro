import { expect, test, type Page } from "@playwright/test";
import { publicSupabaseUrl } from "../../lib/supabase";

const projectRef = new URL(publicSupabaseUrl).hostname.split(".")[0];
const authStorageKey = `sb-${projectRef}-auth-token`;
const userId = "11111111-1111-4111-8111-111111111111";
const caseId = "11111111-1111-4111-8111-111111111112";

function jwt(payload: Record<string, unknown>) {
  const encode = (value: Record<string, unknown>) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode(payload)}.test-signature`;
}

async function mockDashboardReport(page: Page) {
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
    access_token: jwt({
      sub: userId,
      aud: "authenticated",
      role: "authenticated",
      email: user.email,
      iat: now,
      exp: now + 3600,
    }),
    refresh_token: "test-refresh-token",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: now + 3600,
    user,
  };

  await page.addInitScript(
    ({ key, value }) => localStorage.setItem(key, value),
    { key: authStorageKey, value: JSON.stringify(session) },
  );

  await page.route("**/rest/v1/diagnostic_consultants*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ display_name: "Consultora Teste", role: "consultant", active: true }),
    });
  });

  await page.route("**/api/dashboard/cases/*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        case: {
          id: caseId,
          case_number: "CSF-2026-052952",
          status: "approved",
          objective: "Imigrar permanentemente",
          submitted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          assigned_consultant_id: userId,
        },
        client: { full_name: "Bruno Bacelar", email_display: "bruno@example.com" },
        answers: {},
        assessment: {
          id: "21111111-1111-4111-8111-111111111111",
          version: 1,
          created_at: new Date().toISOString(),
          structured_result: {
            overallScore: 63,
            scoreExplanation:
              "Preparo geral intermediário para avançar com validação profissional específica.",
            readinessLevel: "intermediario",
            scoreComponents: [],
            strengths: [
              "Objetivo familiar e de longo prazo claramente declarado.",
              "Inglês avançado autodeclarado do aplicante principal.",
              "Formação em TI e ocupação declarada como desenvolvedor.",
            ],
            risks: ["Ausência de teste de idioma comprovado."],
            missingOrContradictory: [],
            priorities: {
              threeMonths: ["Mapear comprovação de experiência profissional."],
              sixMonths: ["Planejar trilha formal de idioma."],
              twelveMonths: ["Consolidar documentos e estratégia final."],
            },
            regionalCompatibility: [],
            cityTypes: [],
            initialInvestmentRange: "CAD 20k-40k",
            recommendedReserve: "CAD 15k",
            preparationTimeEstimate: "12 meses",
            recommendedContent: [],
            technicalAlerts: ["Campos de experiência com inconsistência temporal."],
            followUpQuestions: [],
            executiveSummary:
              "Há uma base promissora de preparação, com necessidade de validações críticas.",
            confidence: 0.72,
            methodologyVersion: "v1",
            promptVersion: "v1",
            model: "gpt",
          },
        },
        review: {
          id: "31111111-1111-4111-8111-111111111111",
          version: 3,
          status: "approved",
          updated_at: new Date().toISOString(),
        },
        history: [],
      }),
    });
  });

  await page.route(`**/api/diagnostics/reviews?caseId=${caseId}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        review: {
          coherent_path: "Trilha com foco em validação de elegibilidade técnica e documental.",
          assumptions_to_review: "Necessidade de prova formal de idioma e ajuste de narrativa profissional.",
          likely_mistakes: "Submeter perfil sem evidência documental completa.",
          immediate_focus: "Organizar documentação e cronograma de prova de idioma.",
          study_strategy: "Usar estudo no Canadá apenas se alinhar com plano principal.",
          validation_risks: "Risco de recusa por inconsistências não saneadas previamente.",
          next_steps: [
            "Fechar lacunas documentais.",
            "Concluir benchmark de programas.",
            "Validar plano com profissional habilitado.",
          ],
          additional_notes: "",
          recommended_resources: [],
          version: 3,
          approved_at: new Date().toISOString(),
          status: "approved",
        },
      }),
    });
  });
}

test("@regression relatório respeita regras de impressão", async ({ page }) => {
  await mockDashboardReport(page);

  await page.goto(`/dashboard/diagnosticos/${caseId}/relatorio`);
  await expect(page.getByRole("button", { name: "Imprimir" })).toBeVisible();
  await expect(page.getByText("Voltar ao caso")).toBeVisible();
  await expect(page.getByText("Versão aprovada")).toBeVisible();

  await page.emulateMedia({ media: "print" });

  await expect(page.getByText("Voltar ao caso")).toBeHidden();
  await expect(page.getByText("Versão aprovada")).toBeHidden();

  const reportPaperMetrics = await page.locator(".report-paper").first().evaluate((el) => {
    const style = getComputedStyle(el);
    return {
      width: parseFloat(style.width),
      minHeight: parseFloat(style.minHeight),
      paddingTop: parseFloat(style.paddingTop),
      paddingLeft: parseFloat(style.paddingLeft),
    };
  });

  expect(reportPaperMetrics.width).toBeGreaterThan(700);
  expect(reportPaperMetrics.minHeight).toBeGreaterThan(1000);
  expect(reportPaperMetrics.paddingTop).toBe(70);
  expect(reportPaperMetrics.paddingLeft).toBe(74);

  const coverFooterPlacement = await page.locator(".report-cover > footer").evaluate((footer) => {
    const parent = footer.closest(".report-cover");
    if (!parent) return { bottomSpace: -1 };
    const footerRect = footer.getBoundingClientRect();
    const parentRect = parent.getBoundingClientRect();
    return { bottomSpace: parentRect.bottom - footerRect.bottom };
  });

  expect(coverFooterPlacement.bottomSpace).toBeGreaterThan(20);
});
