import { describe, expect, it } from "vitest";
import { diagnosticSections, missingRequiredQuestions, visibleQuestions } from "../../lib/questions";

describe("perguntas condicionais", () => {
  const personal = diagnosticSections[0]; const spouse = diagnosticSections[6];
  it("não pede idades de filhos quando não há filhos", () => expect(visibleQuestions(personal, { has_children: "Não" }).some(q => q.key === "children_ages")).toBe(false));
  it("mostra dados do cônjuge somente quando aplicável", () => {
    expect(visibleQuestions(spouse, { marital_status: "Solteiro(a)" })).toHaveLength(0);
    expect(visibleQuestions(spouse, { marital_status: "Casado(a)" }).length).toBeGreaterThan(0);
  });
  it("considera arrays vazios como pendentes", () => {
    const preferences = diagnosticSections[8];
    expect(missingRequiredQuestions(preferences, { life_priorities: [] }).some(q => q.key === "life_priorities")).toBe(true);
  });
});
