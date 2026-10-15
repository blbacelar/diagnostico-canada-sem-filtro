import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.addEventListener("click", (event) => {
      const target = event.target instanceof Element ? event.target.closest("[data-cta-placement]") : null;
      if (target) event.preventDefault();
    }, true);
  });
});

test("@smoke página de vendas apresenta as quatro dobras e CTAs consistentes", async ({ page }) => {
  await page.goto("/simulador?utm_source=teste&utm_campaign=pagina-vendas");

  await expect(page.getByRole("heading", { name: /existem vários caminhos para imigrar/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /escolher o caminho antes de entender/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /o simulador foi criado para você/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /antes de investir em um caminho/i })).toBeVisible();
  await expect(page.getByText(/seus 3 próximos passos/i).first()).toBeVisible();
  await expect(page.getByText(/termina em|oferta especial de hoje|renovada diariamente/i)).toHaveCount(0);

  const ctas = page.locator("a[data-cta-placement]");
  expect(await ctas.count()).toBeGreaterThanOrEqual(4);
  expect(await ctas.allTextContents()).toEqual(Array(await ctas.count()).fill("Quero começar o meu projeto"));
  await expect(ctas.first()).toHaveAttribute("href", "https://pay.hotmart.com/U107038059P?off=hyxqfyga");
  await expect(page.locator('[data-cta-placement="hero"]')).toHaveText(/quero começar o meu projeto/i);
  await expect(page.locator(".simulator-hero__copy").getByText(/por apenas/i)).toHaveCount(0);
  await expect(page.getByText(/clareza agora, antes de decisões/i)).toBeVisible();
});

test("@brand aplica a paleta oficial do manual de identidade", async ({ page }) => {
  await page.goto("/simulador");

  await expect.poll(() => page.locator(".simulator-offer-bar").evaluate((element) => getComputedStyle(element).backgroundColor)).toBe("rgb(246, 184, 54)");
  await expect.poll(() => page.locator(".simulator-hero__copy h1").evaluate((element) => getComputedStyle(element).color)).toBe("rgb(22, 60, 114)");
  await expect.poll(() => page.locator('[data-cta-placement="hero"]').evaluate((element) => getComputedStyle(element).backgroundColor)).toBe("rgb(200, 52, 50)");
});

test("@tracking instala GTM, gtag e Vercel Analytics sem Meta Pixel direto", async ({ page, request }) => {
  await page.goto("/simulador?utm_source=teste&utm_campaign=pagina-vendas");

  await expect(page.locator("script#csf-google-tag-manager")).toHaveCount(1);
  expect(await page.locator("script#csf-google-tag-manager").textContent()).toContain("GTM-P2K5JWSC");
  await expect(page.locator('script[src*="googletagmanager.com/gtag/js?id=AW-18488294475"]')).toHaveCount(1);
  expect(await page.locator("script#csf-google-ads").textContent()).toContain("gtag('config', 'AW-18488294475')");
  await expect(page.locator('script[src*="/_vercel/insights"], script[src*="va.vercel-scripts.com"]')).toHaveCount(1);
  await expect(page.locator("script#csf-meta-pixel")).toHaveCount(0);
  expect(await page.evaluate(() => "dataLayer" in window)).toBe(true);

  const response = await request.get(page.url());
  const html = await response.text();
  expect(html).toContain("https://www.googletagmanager.com/ns.html?id=GTM-P2K5JWSC");
  expect(html).not.toContain("facebook.net");
  expect(html).not.toContain("1505495854011697");
});

test("@a11y não apresenta violações críticas ou graves", async ({ page }) => {
  await page.goto("/simulador");
  const results = await new AxeBuilder({ page }).include(".simulator-sales-page").analyze();
  expect(results.violations.filter((violation) => ["critical", "serious"].includes(violation.impact ?? ""))).toEqual([]);
});
