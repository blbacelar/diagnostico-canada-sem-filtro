import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("landing pública apresenta identificação e mensagem sem promessas",async({page})=>{await page.goto("/");await expect(page.getByRole("heading",{name:/vamos entender o seu projeto canadá/i})).toBeVisible();await expect(page.getByLabel("Nome completo")).toBeVisible();await expect(page.getByText(/não promete elegibilidade/i)).toBeVisible();const results=await new AxeBuilder({page}).analyze();expect(results.violations.filter(v=>["critical","serious"].includes(v.impact??""))).toEqual([]);});
test("fluxo é navegável por teclado",async({page})=>{await page.goto("/");await page.keyboard.press("Tab");await page.keyboard.press("Tab");await expect(page.locator(":focus")).toBeVisible();});
test("layout mobile mantém a ação principal visível",async({page})=>{await page.goto("/");await expect(page.getByRole("button",{name:/iniciar meu diagnóstico/i})).toBeVisible();});
