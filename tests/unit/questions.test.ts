import { describe, expect, it } from "vitest";
import { diagnosticSections, layoutQuestionRows, missingRequiredQuestions, pruneHiddenAnswers, visibleQuestions } from "../../lib/questions";

const allConditionalAnswers = {
  has_children: true,
  marital_status: "Casado(a)",
  canadian_work_experience: "Sim",
  english_test: "IELTS",
  french_test: "TEF",
  has_refusal: "Sim",
};

const expectedLayoutRows: Record<string, string[][]> = {
  personal_profile: [
    ["age", "marital_status"],
    ["nationality", "country_of_residence"],
    ["has_second_nationality"],
    ["has_children", "children_count", "children_ages"],
    ["spouse_summary"],
  ],
  main_objective: [["main_objective"], ["objective_context"]],
  education: [["education_level", "education_field"], ["has_second_education"], ["graduation_year", "education_outside_canada"], ["education_institution"]],
  work_experience: [["current_profession", "experience_years"], ["interest_in_other_area"], ["leadership_experience", "regulated_profession"], ["canadian_work_experience", "canadian_role", "canadian_work_duration"]],
  languages: [["english_level", "english_test"], ["english_test_details"], ["french_level", "french_test"], ["french_test_details"], ["french_investment"]],
  finances: [["available_funds", "funds_currency"], ["funds_scope"], ["sell_assets", "financial_support"], ["financial_context"]],
  spouse: [["spouse_age", "spouse_education"], ["spouse_profession", "spouse_experience"], ["spouse_english", "spouse_french"], ["spouse_interest"], ["spouse_context"]],
  immigration_history: [["canadian_authorization", "lived_in_canada"], ["has_refusal", "overstay"], ["refusal_details"], ["family_in_canada"], ["admissibility_issue"], ["immigration_context"]],
  life_preferences: [["life_priorities"], ["city_size", "outside_major_cities"], ["location_preference"], ["family_must_haves"]],
  timeline: [["project_timeline", "willing_to_delay"], ["career_change", "smaller_regions"]],
  obstacles: [["biggest_challenge"], ["difficulty_factors"], ["main_question"], ["anything_else"]],
};

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
  it("agrupa status pessoal, residência e filhos em linhas semanticamente relacionadas", () => {
    expect(layoutQuestionRows(personal, allConditionalAnswers).map(row => row.questions.map(question => question.key))).toEqual(expectedLayoutRows.personal_profile);
  });
  it("mostra dados do cônjuge somente quando aplicável", () => {
    expect(visibleQuestions(spouse, { marital_status: "Solteiro(a)" })).toHaveLength(0);
    expect(visibleQuestions(spouse, { marital_status: "Casado(a)" }).length).toBeGreaterThan(0);
  });
  it("considera arrays vazios como pendentes", () => {
    const preferences = diagnosticSections[8];
    expect(missingRequiredQuestions(preferences, { life_priorities: [] }).some(q => q.key === "life_priorities")).toBe(true);
  });
  it("remove dados condicionais antigos quando a situação muda", () => {
    const answers = pruneHiddenAnswers({
      marital_status: "Solteiro(a)",
      spouse_summary: "Resumo antigo",
      spouse_age: 40,
      spouse_profession: "Fisioterapeuta",
      has_children: false,
      children_count: 2,
      children_ages: "4 e 9 anos",
      english_test: "Não",
      english_test_details: "IELTS antigo",
      has_refusal: "Não",
      refusal_details: "Recusa antiga",
    });

    expect(answers).not.toHaveProperty("spouse_summary");
    expect(answers).not.toHaveProperty("spouse_age");
    expect(answers).not.toHaveProperty("spouse_profession");
    expect(answers).not.toHaveProperty("children_count");
    expect(answers).not.toHaveProperty("children_ages");
    expect(answers).not.toHaveProperty("english_test_details");
    expect(answers).not.toHaveProperty("refusal_details");
  });
});

describe("contrato de layout das 11 seções", () => {
  const gridSpan = { third: 4, half: 6, "two-thirds": 8, full: 12 } as const;

  it.each(diagnosticSections.map(section => [section.key, section] as const))("mantém grupos coerentes em %s", (sectionKey, section) => {
    const rows = layoutQuestionRows(section, allConditionalAnswers);
    expect(rows.map(row => row.questions.map(question => question.key))).toEqual(expectedLayoutRows[sectionKey]);
    for (const row of rows) {
      expect(row.questions.every(question => question.layout && question.layoutRow)).toBe(true);
      expect(row.questions.reduce((total, question) => total + gridSpan[question.layout!], 0)).toBe(12);
    }
  });

  it("não mistura o resumo do parceiro na linha de filhos quando a resposta é negativa", () => {
    const rows = layoutQuestionRows(diagnosticSections[0], { has_children: false, marital_status: "Casado(a)" });
    expect(rows.map(row => row.questions.map(question => question.key))).toEqual([
      ["age", "marital_status"],
      ["nationality", "country_of_residence"],
      ["has_second_nationality"],
      ["has_children"],
      ["spouse_summary"],
    ]);
  });

  it("marca o valor disponível como entrada monetária", () => {
    const availableFunds = diagnosticSections[5].questions.find(question => question.key === "available_funds");
    expect(availableFunds?.format).toBe("currency");
  });
});
