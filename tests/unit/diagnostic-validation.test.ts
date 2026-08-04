import { describe, expect, it } from "vitest";
import {
  diagnosticDraftAnswersSchema,
  diagnosticSubmissionAnswersSchema,
  validateQuestionAnswer,
  validationErrorsForSection,
} from "../../lib/diagnostic-validation";
import { diagnosticSections } from "../../lib/questions";

function question(key: string) {
  const found = diagnosticSections.flatMap((section) => section.questions).find((item) => item.key === key);
  if (!found) throw new Error(`Pergunta ${key} não encontrada.`);
  return found;
}

describe("schemas Zod do diagnóstico", () => {
  it.each([
    ["texto numérico", "35", "Informe somente números."],
    ["valor decimal", 35.5, "Informe um número inteiro."],
    ["abaixo do mínimo", 15, "Informe um número inteiro entre 16 e 100."],
    ["acima do máximo", 101, "Informe um número inteiro entre 16 e 100."],
  ])("rejeita idade inválida: %s", (_scenario, value, message) => {
    expect(validateQuestionAnswer(question("age"), value, true)).toBe(message);
  });

  it("aceita números inteiros dentro da faixa", () => {
    expect(validateQuestionAnswer(question("age"), 35, true)).toBeNull();
    expect(validateQuestionAnswer(question("children_count"), 20, true)).toBeNull();
  });

  it.each([
    ["300000", "Informe um valor monetário válido."],
    [-1, "O valor deve ser maior ou igual a 0."],
    [12.345, "Use no máximo duas casas decimais."],
    [Number.POSITIVE_INFINITY, "Informe um valor monetário válido."],
  ])("rejeita valor não monetário: %o", (value, message) => {
    expect(validateQuestionAnswer(question("available_funds"), value, true)).toBe(message);
  });

  it("aceita valores monetários numéricos com até duas casas decimais", () => {
    expect(validateQuestionAnswer(question("available_funds"), 0, true)).toBeNull();
    expect(validateQuestionAnswer(question("available_funds"), 125000.5, true)).toBeNull();
    expect(validateQuestionAnswer(question("available_funds"), 1234.56, true)).toBeNull();
  });

  it("mantém campos de texto realmente livres e limita apenas tamanho e tipo", () => {
    const nationality = question("nationality");
    expect(validateQuestionAnswer(nationality, "Brasileira — luso-canadense, 2ª geração!", true)).toBeNull();
    expect(validateQuestionAnswer(nationality, 123, true)).toBe("Informe um texto válido.");
    expect(validateQuestionAnswer(nationality, "a".repeat(301), true)).toBe("Use no máximo 300 caracteres.");
  });

  it("rejeita valores que não existem nos selects e múltipla escolha", () => {
    expect(validateQuestionAnswer(question("marital_status"), "Complicado", true)).toBe("Selecione uma opção válida.");
    expect(validateQuestionAnswer(question("life_priorities"), ["Segurança", "Opção inventada"], true)).toBe("Selecione opções válidas.");
    expect(validateQuestionAnswer(question("life_priorities"), ["Segurança", "Segurança"], true)).toBe("Não repita a mesma opção.");
  });

  it("permite rascunho incompleto, mas nunca aceita tipos inválidos ou campos desconhecidos", () => {
    expect(diagnosticDraftAnswersSchema.safeParse({ age: "35" }).success).toBe(false);
    expect(diagnosticDraftAnswersSchema.safeParse({ age: "" }).success).toBe(true);
    expect(diagnosticDraftAnswersSchema.safeParse({ campo_inventado: "valor" }).success).toBe(false);
  });

  it("aplica obrigatoriedade condicional somente aos campos visíveis", () => {
    const withoutChildren = validationErrorsForSection(diagnosticSections[0], {
      age: 35,
      marital_status: "Solteiro(a)",
      nationality: "Brasileira",
      country_of_residence: "Brasil",
      has_children: false,
    });
    expect(withoutChildren).toEqual({});

    const withChildren = validationErrorsForSection(diagnosticSections[0], {
      age: 35,
      marital_status: "Solteiro(a)",
      nationality: "Brasileira",
      country_of_residence: "Brasil",
      has_children: true,
    });
    expect(withChildren).toMatchObject({
      children_count: "Este campo é obrigatório.",
      children_ages: "Este campo é obrigatório.",
    });
  });

  it("o schema final rejeita um diagnóstico incompleto", () => {
    const result = diagnosticSubmissionAnswersSchema.safeParse({ age: 35 });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.some((issue) => issue.path[0] === "marital_status")).toBe(true);
  });
});
