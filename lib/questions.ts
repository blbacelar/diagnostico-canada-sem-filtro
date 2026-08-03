import type { DiagnosticSection, FormAnswers } from "./types";

const yesNo = ["Sim", "Não"];
const spouseApplies = (answers: FormAnswers) =>
  ["Casado(a)", "União estável"].includes(String(answers.marital_status ?? ""));
const hasChildren = (answers: FormAnswers) => answers.has_children === true || answers.has_children === "Sim";
const hasCanadianWork = (answers: FormAnswers) => answers.canadian_work_experience === "Sim";
const hasEnglishTest = (answers: FormAnswers) => ![undefined, "", "Não"].includes(answers.english_test as string);
const hasFrenchTest = (answers: FormAnswers) => ![undefined, "", "Não"].includes(answers.french_test as string);
const hasRefusal = (answers: FormAnswers) => answers.has_refusal === "Sim";

export const diagnosticSections: DiagnosticSection[] = [
  {
    key: "personal_profile",
    number: "01",
    title: "Perfil pessoal",
    intro: "O ponto de partida para entender sua realidade familiar e o contexto atual.",
    questions: [
      { key: "age", label: "Qual é a sua idade?", type: "number", min: 16, max: 100, required: true, layout: "third", layoutRow: "personal-status" },
      { key: "marital_status", label: "Qual é o seu estado civil?", type: "select", required: true, layout: "two-thirds", layoutRow: "personal-status", options: ["Solteiro(a)", "Casado(a)", "União estável", "Separado(a)", "Divorciado(a)", "Viúvo(a)"] },
      { key: "nationality", label: "Qual é a sua nacionalidade?", type: "text", required: true, layout: "half", layoutRow: "residence" },
      { key: "country_of_residence", label: "Em qual país você mora atualmente?", type: "text", required: true, layout: "half", layoutRow: "residence" },
      { key: "has_children", label: "Filhos", type: "boolean", optionalLabel: "Marque se aplicável", layout: "third", layoutRow: "children" },
      { key: "children_count", label: "Quantos filhos?", type: "number", min: 1, max: 20, required: true, layout: "third", layoutRow: "children", showWhen: hasChildren },
      { key: "children_ages", label: "Idade dos filhos", type: "text", placeholder: "Ex.: 4 e 9 anos", required: true, layout: "third", layoutRow: "children", showWhen: hasChildren },
      { key: "spouse_summary", label: "Conte brevemente sobre seu cônjuge ou parceiro", type: "textarea", optionalLabel: "Detalhes serão aprofundados na seção 7", layout: "full", layoutRow: "partner-context", showWhen: spouseApplies },
    ],
  },
  {
    key: "main_objective",
    number: "02",
    title: "Objetivo principal",
    intro: "Não existe resposta certa: queremos entender o que realmente está guiando o seu projeto.",
    questions: [
      { key: "main_objective", label: "Qual é o principal objetivo no Canadá?", type: "radio", required: true, layout: "full", layoutRow: "objective", options: ["Estudar", "Trabalhar", "Imigrar permanentemente", "Abrir um negócio", "Ainda não sei"] },
      { key: "objective_context", label: "O que você espera que esse projeto transforme na sua vida?", type: "textarea", optionalLabel: "Opcional", layout: "full", layoutRow: "objective-context" },
    ],
  },
  {
    key: "education",
    number: "03",
    title: "Formação acadêmica",
    intro: "Sua formação ajuda a dimensionar caminhos de estudo, trabalho e qualificação.",
    questions: [
      { key: "education_level", label: "Qual é o seu maior nível de escolaridade?", type: "select", required: true, layout: "half", layoutRow: "education-background", options: ["Ensino médio", "Técnico", "Graduação", "Pós-graduação", "Mestrado", "Doutorado"] },
      { key: "education_field", label: "Qual é a sua área de formação?", type: "text", required: true, layout: "half", layoutRow: "education-background" },
      { key: "graduation_year", label: "Ano de conclusão da formação", type: "number", min: 1950, max: 2030, required: true, layout: "third", layoutRow: "education-credentials" },
      { key: "education_outside_canada", label: "A formação foi concluída fora do Canadá?", type: "radio", required: true, layout: "two-thirds", layoutRow: "education-credentials", options: yesNo },
      { key: "education_institution", label: "Instituição e país da formação", type: "text", optionalLabel: "Opcional", layout: "full", layoutRow: "education-institution" },
    ],
  },
  {
    key: "work_experience",
    number: "04",
    title: "Experiência profissional",
    intro: "Vamos observar senioridade, transferibilidade e possíveis exigências da sua profissão.",
    questions: [
      { key: "current_profession", label: "Qual é a sua profissão atual?", type: "text", required: true, layout: "two-thirds", layoutRow: "career-summary" },
      { key: "experience_years", label: "Anos de experiência na área", type: "number", min: 0, max: 60, required: true, layout: "third", layoutRow: "career-summary" },
      { key: "leadership_experience", label: "Possui experiência em liderança ou gestão?", type: "radio", required: true, layout: "half", layoutRow: "career-profile", options: yesNo },
      { key: "regulated_profession", label: "Seu trabalho exige formação específica, certificação ou licença?", type: "radio", required: true, layout: "half", layoutRow: "career-profile", options: ["Sim", "Não", "Não sei"] },
      { key: "canadian_work_experience", label: "Experiência de trabalho no Canadá?", type: "radio", required: true, layout: "third", layoutRow: "canadian-experience", options: yesNo },
      { key: "canadian_role", label: "Função exercida no Canadá", type: "text", required: true, layout: "third", layoutRow: "canadian-experience", showWhen: hasCanadianWork },
      { key: "canadian_work_duration", label: "Tempo de trabalho no Canadá", type: "text", required: true, layout: "third", layoutRow: "canadian-experience", showWhen: hasCanadianWork },
    ],
  },
  {
    key: "languages",
    number: "05",
    title: "Inglês e francês",
    intro: "Idioma é um eixo de preparação. Registre seu momento atual com honestidade.",
    questions: [
      { key: "english_level", label: "Qual é o seu nível de inglês?", type: "select", required: true, layout: "half", layoutRow: "english", options: ["Nenhum", "Básico", "Intermediário", "Avançado", "Fluente"] },
      { key: "english_test", label: "Possui prova oficial de inglês?", type: "select", required: true, layout: "half", layoutRow: "english", options: ["IELTS", "CELPIP", "PTE Core", "Outra", "Não"] },
      { key: "english_test_details", label: "Informe modalidade, data e notas", type: "textarea", required: true, layout: "full", layoutRow: "english-details", showWhen: hasEnglishTest },
      { key: "french_level", label: "Qual é o seu nível de francês?", type: "select", required: true, layout: "half", layoutRow: "french", options: ["Nenhum", "Básico", "Intermediário", "Avançado", "Fluente"] },
      { key: "french_test", label: "Possui prova oficial de francês?", type: "select", required: true, layout: "half", layoutRow: "french", options: ["TEF", "TCF", "Outra", "Não"] },
      { key: "french_test_details", label: "Informe data e notas", type: "textarea", required: true, layout: "full", layoutRow: "french-details", showWhen: hasFrenchTest },
      { key: "french_investment", label: "Estaria disposto a investir no aprendizado de francês?", type: "radio", required: true, layout: "full", layoutRow: "language-investment", options: ["Sim", "Talvez", "Não"] },
    ],
  },
  {
    key: "finances",
    number: "06",
    title: "Recursos financeiros",
    intro: "Esses dados são sensíveis e servem apenas para calibrar um plano responsável.",
    sensitive: true,
    questions: [
      { key: "available_funds", label: "Quanto possui disponível para investir no projeto Canadá?", type: "number", min: 0, required: true, sensitive: true, format: "currency", layout: "two-thirds", layoutRow: "available-funds" },
      { key: "funds_currency", label: "Em qual moeda?", type: "select", required: true, layout: "third", layoutRow: "available-funds", options: ["CAD", "BRL", "USD", "EUR", "Outra"] },
      { key: "funds_scope", label: "Esse valor inclui passagens, taxas, estudos, moradia e reserva de emergência?", type: "radio", required: true, layout: "full", layoutRow: "funds-scope", options: ["Sim", "Parcialmente", "Não"] },
      { key: "sell_assets", label: "Pretende vender patrimônio para financiar o projeto?", type: "radio", required: true, layout: "half", layoutRow: "funding-options", options: yesNo },
      { key: "financial_support", label: "Possui apoio financeiro formal e comprovável?", type: "radio", required: true, layout: "half", layoutRow: "funding-options", options: yesNo },
      { key: "financial_context", label: "Explique sua situação financeira, se achar importante", type: "textarea", optionalLabel: "Opcional", sensitive: true, layout: "full", layoutRow: "financial-context" },
    ],
  },
  {
    key: "spouse",
    number: "07",
    title: "Cônjuge ou parceiro",
    intro: "Quando o projeto é familiar, o perfil e o compromisso do casal importam.",
    questions: [
      { key: "spouse_age", label: "Idade do cônjuge ou parceiro", type: "number", min: 16, max: 100, required: true, layout: "third", layoutRow: "spouse-background", showWhen: spouseApplies },
      { key: "spouse_education", label: "Maior nível de escolaridade", type: "select", required: true, layout: "two-thirds", layoutRow: "spouse-background", options: ["Ensino médio", "Técnico", "Graduação", "Pós-graduação", "Mestrado", "Doutorado"], showWhen: spouseApplies },
      { key: "spouse_profession", label: "Profissão", type: "text", required: true, layout: "two-thirds", layoutRow: "spouse-career", showWhen: spouseApplies },
      { key: "spouse_experience", label: "Anos de experiência", type: "number", min: 0, max: 60, required: true, layout: "third", layoutRow: "spouse-career", showWhen: spouseApplies },
      { key: "spouse_english", label: "Nível de inglês", type: "select", required: true, layout: "half", layoutRow: "spouse-languages", options: ["Nenhum", "Básico", "Intermediário", "Avançado", "Fluente"], showWhen: spouseApplies },
      { key: "spouse_french", label: "Nível de francês", type: "select", required: true, layout: "half", layoutRow: "spouse-languages", options: ["Nenhum", "Básico", "Intermediário", "Avançado", "Fluente"], showWhen: spouseApplies },
      { key: "spouse_interest", label: "Qual é o interesse real em participar do projeto?", type: "select", required: true, layout: "full", layoutRow: "spouse-commitment", options: ["Totalmente comprometido(a)", "Aberto(a), com dúvidas", "Pouco interessado(a)", "Ainda não conversamos"], showWhen: spouseApplies },
      { key: "spouse_context", label: "Contexto adicional", type: "textarea", optionalLabel: "Opcional", layout: "full", layoutRow: "spouse-context", showWhen: spouseApplies },
    ],
  },
  {
    key: "immigration_history",
    number: "08",
    title: "Histórico migratório",
    intro: "Uma seção técnica e confidencial. Alertas aqui sempre exigem validação profissional.",
    sensitive: true,
    questions: [
      { key: "canadian_authorization", label: "Já teve visto ou autorização canadense?", type: "radio", required: true, layout: "half", layoutRow: "canada-history", options: yesNo },
      { key: "lived_in_canada", label: "Já morou, estudou ou trabalhou no Canadá?", type: "radio", required: true, layout: "half", layoutRow: "canada-history", options: yesNo },
      { key: "has_refusal", label: "Já teve visto, permissão ou pedido de imigração recusado pelo Canadá ou por outro país?", type: "radio", required: true, layout: "half", layoutRow: "compliance-history", options: yesNo },
      { key: "overstay", label: "Já permaneceu em algum país além do período autorizado?", type: "radio", required: true, sensitive: true, layout: "half", layoutRow: "compliance-history", options: yesNo },
      { key: "refusal_details", label: "Informe país, tipo de pedido, ano e contexto", type: "textarea", required: true, sensitive: true, layout: "full", layoutRow: "refusal-details", showWhen: hasRefusal },
      { key: "family_in_canada", label: "Possui familiares próximos no Canadá? Onde vivem?", type: "textarea", required: true, layout: "full", layoutRow: "canada-family" },
      { key: "admissibility_issue", label: "Existe questão médica, criminal ou migratória relevante?", type: "radio", required: true, sensitive: true, layout: "full", layoutRow: "admissibility", options: ["Sim", "Não", "Prefiro explicar no campo abaixo"] },
      { key: "immigration_context", label: "Use este campo seguro para explicar algo importante", type: "textarea", optionalLabel: "Opcional", sensitive: true, layout: "full", layoutRow: "immigration-context" },
    ],
  },
  {
    key: "life_preferences",
    number: "09",
    title: "Preferências de vida",
    intro: "Um projeto coerente também precisa combinar com a vida que você quer levar.",
    questions: [
      { key: "life_priorities", label: "Quais são suas prioridades?", type: "multi", required: true, layout: "full", layoutRow: "life-priorities", options: ["Residência permanente", "Melhor salário", "Menor custo de vida", "Segurança", "Qualidade de vida", "Empregabilidade"] },
      { key: "city_size", label: "Prefere cidade grande, média ou pequena?", type: "radio", required: true, layout: "half", layoutRow: "location-fit", options: ["Grande", "Média", "Pequena", "Sem preferência"] },
      { key: "outside_major_cities", label: "Estaria disposto a morar fora de Toronto, Vancouver ou Montréal?", type: "radio", required: true, layout: "half", layoutRow: "location-fit", options: ["Sim", "Talvez", "Não"] },
      { key: "location_preference", label: "Possui preferência por alguma província ou cidade? Por quê?", type: "textarea", required: true, layout: "full", layoutRow: "location-preference" },
      { key: "family_must_haves", label: "Quais fatores são indispensáveis para sua família?", type: "textarea", required: true, layout: "full", layoutRow: "family-needs" },
    ],
  },
  {
    key: "timeline",
    number: "10",
    title: "Prazo e flexibilidade",
    intro: "Prazo sem flexibilidade costuma gerar decisões caras. Vamos medir os dois.",
    questions: [
      { key: "project_timeline", label: "Qual é o prazo para iniciar o projeto?", type: "select", required: true, layout: "half", layoutRow: "timeline-flexibility", options: ["Menos de 6 meses", "De 6 a 12 meses", "De 1 a 2 anos", "Mais de 2 anos"] },
      { key: "willing_to_delay", label: "Adiaria o projeto para melhorar idioma, finanças ou qualificação?", type: "radio", required: true, layout: "half", layoutRow: "timeline-flexibility", options: ["Sim", "Talvez", "Não"] },
      { key: "career_change", label: "Mudaria de profissão ou faria formação complementar?", type: "radio", required: true, layout: "half", layoutRow: "project-adaptations", options: ["Sim", "Talvez", "Não"] },
      { key: "smaller_regions", label: "Consideraria cidades menores ou regiões menos populares?", type: "radio", required: true, layout: "half", layoutRow: "project-adaptations", options: ["Sim", "Talvez", "Não"] },
    ],
  },
  {
    key: "obstacles",
    number: "11",
    title: "Obstáculos e dúvidas",
    intro: "Fechamos com o que mais pesa hoje e com a pergunta que precisa de uma resposta clara.",
    questions: [
      { key: "biggest_challenge", label: "Qual acredita ser o maior desafio do projeto Canadá?", type: "textarea", required: true, layout: "full", layoutRow: "biggest-challenge" },
      { key: "difficulty_factors", label: "Quais fatores podem dificultar o plano?", type: "multi", required: true, layout: "full", layoutRow: "difficulty-factors", options: ["Idade", "Filhos", "Recursos financeiros", "Idioma", "Profissão", "Histórico migratório", "Outro"] },
      { key: "main_question", label: "Qual é a maior dúvida que gostaria que o diagnóstico respondesse?", type: "textarea", required: true, layout: "full", layoutRow: "main-question" },
      { key: "anything_else", label: "Existe algo importante que não foi perguntado?", type: "textarea", optionalLabel: "Opcional", layout: "full", layoutRow: "anything-else" },
    ],
  },
];

export function visibleQuestions(section: DiagnosticSection, answers: FormAnswers) {
  return section.questions.filter((question) => !question.showWhen || question.showWhen(answers));
}

export function layoutQuestionRows(section: DiagnosticSection, answers: FormAnswers) {
  return visibleQuestions(section, answers).reduce<Array<{ key: string; questions: DiagnosticSection["questions"] }>>((rows, question) => {
    const key = question.layoutRow ?? question.key;
    const currentRow = rows.at(-1);
    if (currentRow?.key === key) currentRow.questions.push(question);
    else rows.push({ key, questions: [question] });
    return rows;
  }, []);
}

export function missingRequiredQuestions(section: DiagnosticSection, answers: FormAnswers) {
  return visibleQuestions(section, answers).filter((question) => {
    if (!question.required) return false;
    const value = answers[question.key];
    return value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);
  });
}

export function sectionForQuestion(questionKey: string) {
  return diagnosticSections.find((section) => section.questions.some((question) => question.key === questionKey));
}
