import { describe, expect, it } from "vitest";
import { diagnosticSections, missingRequiredQuestions, visibleQuestions } from "../../lib/questions";

describe("perguntas condicionais", () => {
  const personal = diagnosticSections[0]; const spouse = diagnosticSections[6];
  it("não pede dados dos filhos quando a caixa não está marcada", () => {
    expect(visibleQuestions(personal, { has_children: false }).some(q => q.key === "children_count")).toBe(false);
    expect(visibleQuestions(personal, { has_children: false }).some(q => q.key === "children_ages")).toBe(false);
  });
  it("mostra quantidade e idades quando a caixa de filhos está marcada", () => {
    const keys = visibleQuestions(personal, { has_children: true }).map(q => q.key);
    expect(keys).toContain("children_count");
    expect(keys).toContain("children_ages");
  });
  it("mantém compatibilidade com respostas antigas de filhos", () => {
    expect(visibleQuestions(personal, { has_children: "Sim" }).some(q => q.key === "children_count")).toBe(true);
    expect(visibleQuestions(personal, { has_children: "Não" }).some(q => q.key === "children_count")).toBe(false);
  });
  it("não exige que pessoas sem filhos marquem a caixa", () => {
    expect(missingRequiredQuestions(personal, {}).some(q => q.key === "has_children")).toBe(false);
  });
  it("define a grade compacta do perfil pessoal", () => {
    const layoutByKey = Object.fromEntries(personal.questions.map(q => [q.key, q.layout]));
    expect(layoutByKey).toMatchObject({ age: "compact", nationality: "wide", country_of_residence: "half", marital_status: "half", has_children: "third", children_count: "third", children_ages: "third" });
  });
  it("mostra dados do cônjuge somente quando aplicável", () => {
    expect(visibleQuestions(spouse, { marital_status: "Solteiro(a)" })).toHaveLength(0);
    expect(visibleQuestions(spouse, { marital_status: "Casado(a)" }).length).toBeGreaterThan(0);
  });
  it("considera arrays vazios como pendentes", () => {
    const preferences = diagnosticSections[8];
    expect(missingRequiredQuestions(preferences, { life_priorities: [] }).some(q => q.key === "life_priorities")).toBe(true);
  });
});
