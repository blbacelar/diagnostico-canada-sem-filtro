import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    (window as Window & { dataLayer?: Array<Record<string, unknown>> }).dataLayer = [];
    window.addEventListener("click", (event) => {
      const target = event.target instanceof Element ? event.target.closest("[data-cta-placement]") : null;
      if (target) event.preventDefault();
    }, true);
  });
});

test("@smoke página de vendas apresenta promessa, limites e CTAs consistentes", async ({ page }) => {
  await page.goto("/simulador?utm_source=teste&utm_campaign=pagina-vendas");

  await expect(page.getByRole("heading", { name: /quer saber o que precisa ser organizado no seu perfil/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /este simulador é para você/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /o que o simulador não promete/i })).toBeVisible();
  await expect(page.getByText(/termina em|oferta especial de hoje|renovada diariamente/i)).toHaveCount(0);

  const ctas = page.locator("a[data-cta-placement]");
  expect(await ctas.count()).toBeGreaterThanOrEqual(5);
  await expect(ctas.first()).toHaveAttribute("href", "https://pay.hotmart.com/U107038059P?off=hyxqfyga");
  await expect(page.getByText(/demonstração ilustrativa/i).first()).toBeVisible();
  await expect.poll(() => page.locator(".testimonial-screenshots img").evaluateAll((images) => images.every((image) => (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
  await expect.poll(() => page.locator(".testimonial-screenshots img").first().evaluate((image) => getComputedStyle(image).objectFit)).toBe("contain");
});

test("@smoke registra eventos sem exigir tracker externo", async ({ page }) => {
  await page.goto("/simulador?utm_source=teste&utm_campaign=pagina-vendas");
  await page.locator('[data-cta-placement="hero"]').click();

  const events = await page.evaluate(() => (window as Window & { dataLayer?: Array<Record<string, unknown>> }).dataLayer);
  expect(events?.map((event) => event.event)).toEqual(expect.arrayContaining(["simulator_page_view", "simulator_checkout_started"]));
  expect(events?.find((event) => event.event === "simulator_checkout_started")).toMatchObject({ cta_placement: "hero", utm_source: "teste", utm_campaign: "pagina-vendas" });
});

test("@brand aplica a paleta oficial do manual de identidade", async ({ page }) => {
  await page.goto("/simulador");

  await expect.poll(() => page.locator(".simulator-offer-bar").evaluate((element) => getComputedStyle(element).backgroundColor)).toBe("rgb(246, 184, 54)");
  await expect.poll(() => page.locator(".simulator-hero__copy h1").evaluate((element) => getComputedStyle(element).color)).toBe("rgb(22, 60, 114)");
  await expect.poll(() => page.locator('[data-cta-placement="hero"]').evaluate((element) => getComputedStyle(element).backgroundColor)).toBe("rgb(200, 52, 50)");
  await expect.poll(() => page.locator(".simulator-hero-price strong").evaluate((element) => getComputedStyle(element).fontSize)).toBe("25px");
});

test("@a11y não apresenta violações críticas ou graves", async ({ page }) => {
  await page.goto("/simulador");
  const results = await new AxeBuilder({ page }).include(".simulator-sales-page").analyze();
  expect(results.violations.filter((violation) => ["critical", "serious"].includes(violation.impact ?? ""))).toEqual([]);
});
