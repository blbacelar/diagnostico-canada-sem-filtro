const supportedCurrencies = new Set(["BRL", "CAD", "USD", "EUR"]);

function numericValue(value: unknown) {
  if (value === "" || value === null || value === undefined) return null;
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function analyzeCurrencyInput(input: string) {
  const isNegative = /^\s*-/.test(input);
  const cleaned = input.replace(/[^\d.,]/g, "");
  if (!/\d/.test(cleaned)) return null;

  const comma = cleaned.lastIndexOf(",");
  const dot = cleaned.lastIndexOf(".");
  const separator = Math.max(comma, dot);
  const hasBothSeparators = comma >= 0 && dot >= 0;
  const digitsAfterSeparator = separator >= 0 ? cleaned.slice(separator + 1).replace(/\D/g, "").length : 0;
  const hasDecimalSeparator = separator >= 0 && (hasBothSeparators || digitsAfterSeparator <= 2);
  const integerPart = (hasDecimalSeparator ? cleaned.slice(0, separator) : cleaned).replace(/\D/g, "") || "0";
  const fractionPart = hasDecimalSeparator ? cleaned.slice(separator + 1).replace(/\D/g, "").slice(0, 2) : "";
  const value = Number(`${isNegative ? "-" : ""}${integerPart}.${fractionPart}`);

  return {
    value: Number.isFinite(value) ? value : 0,
    fractionDigits: fractionPart.length,
    trailingDecimal: hasDecimalSeparator && fractionPart.length === 0,
  };
}

export function formatCurrencyAmount(value: unknown, currencyCode?: string) {
  const amount = numericValue(value);
  if (amount === null) return "";
  const currency = String(currencyCode ?? "").toUpperCase();
  if (supportedCurrencies.has(currency)) {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(amount);
  }
  return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
}

export function formatCurrencyEditingAmount(value: unknown) {
  const amount = numericValue(value);
  if (amount === null) return "";
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(amount);
}

export function normalizeCurrencyInput(input: string) {
  const analyzed = analyzeCurrencyInput(input);
  if (!analyzed) return { value: "" as const, display: "" };
  const display = new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: analyzed.fractionDigits,
    maximumFractionDigits: analyzed.fractionDigits,
  }).format(analyzed.value);
  return {
    value: analyzed.value,
    display: analyzed.trailingDecimal ? `${display},` : display,
  };
}

export function isSupportedCurrency(currencyCode?: string) {
  return supportedCurrencies.has(String(currencyCode ?? "").toUpperCase());
}
