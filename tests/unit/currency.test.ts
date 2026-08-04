import { describe, expect, it } from "vitest";
import { formatCurrencyAmount, formatCurrencyEditingAmount, normalizeCurrencyInput } from "../../lib/currency";

describe("formatação monetária", () => {
  it.each([
    ["BRL", "R$\u00a0300.000,00"],
    ["CAD", "CA$\u00a0300.000,00"],
    ["USD", "US$\u00a0300.000,00"],
    ["EUR", "€\u00a0300.000,00"],
  ])("formata 300000 em %s", (currency, expected) => {
    expect(formatCurrencyAmount(300000, currency)).toBe(expected);
  });

  it("usa formato numérico localizado quando a moeda ainda não foi escolhida", () => {
    expect(formatCurrencyAmount(300000)).toBe("300.000,00");
    expect(formatCurrencyEditingAmount(300000.5)).toBe("300.000,5");
  });

  it.each([
    ["300000", 300000, "300.000"],
    ["300.000", 300000, "300.000"],
    ["300.000,50", 300000.5, "300.000,50"],
    ["300,000.50", 300000.5, "300.000,50"],
    ["R$ 1.234,56", 1234.56, "1.234,56"],
    ["300000,", 300000, "300.000,"],
    ["", "", ""],
  ])("normaliza a entrada %j sem perder o valor numérico", (input, value, display) => {
    expect(normalizeCurrencyInput(input)).toEqual({ value, display });
  });

  it("preserva o sinal negativo para a validação exibir o erro sem alterar o valor silenciosamente", () => {
    expect(normalizeCurrencyInput("-100")).toEqual({ value: -100, display: "-100" });
    expect(formatCurrencyAmount(-100, "BRL")).toBe("-R$\u00a0100,00");
  });
});
