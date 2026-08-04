import { expect, test } from "@playwright/test";

test("@critical @smoke dashboard sem sessão redireciona para login", async ({ page }) => {
  await page.goto("/dashboard");

  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard/);
  await expect(page.getByRole("heading", { name: /acesse o dashboard/i })).toBeVisible();
  await expect(page.getByRole("textbox", { name: /e-mail profissional/i })).toBeVisible();
});

test("@critical @smoke subrota protegida sem sessão redireciona para login", async ({ page }) => {
  await page.goto("/dashboard/clientes");

  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard%2Fclientes/);
  await expect(page.getByRole("heading", { name: /acesse o dashboard/i })).toBeVisible();
  await expect(page.getByRole("textbox", { name: /e-mail profissional/i })).toBeVisible();
});
