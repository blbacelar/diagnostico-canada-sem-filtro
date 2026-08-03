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
      { key: "age", label: "Qual é a sua idade?", type: "number", min: 16, max: 100, required: true, layout: "compact" },
      { key: "nationality", label: "Qual é a sua nacionalidade?", type: "text", required: true, layout: "wide" },
      { key: "country_of_residence", label: "Em qual país você mora atualmente?", type: "text", required: true, layout: "half" },
      { key: "marital_status", label: "Qual é o seu estado civil?", type: "select", required: true, layout: "half", options: ["Solteiro(a)", "Casado(a)", "União estável", "Separado(a)", "Divorciado(a)", "Viúvo(a)"] },
      { key: "has_children", label: "Filhos", type: "boolean", optionalLabel: "Marque se aplicável", layout: "third" },
      { key: "children_count", label: "Quantos filhos?", type: "number", min: 1, max: 20, required: true, layout: "third", showWhen: hasChildren },
      { key: "children_ages", label: "Idade dos filhos", type: "text", placeholder: "Ex.: 4 e 9 anos", required: true, layout: "third", showWhen: hasChildren },
      { key: "spouse_summary", label: "Conte brevemente sobre seu cônjuge ou parceiro", type: "textarea", optionalLabel: "Detalhes serão aprofundados na seção 7", showWhen: spouseApplies },
    ],
  },
  {
    key: "main_objective",
    number: "02",
    title: "Objetivo principal",
    intro: "Não existe resposta certa: queremos entender o que realmente está guiando o seu projeto.",
    questions: [
      { key: "main_objective", label: "Qual é o principal objetivo no Canadá?", type: "radio", required: true, options: ["Estudar", "Trabalhar", "Imigrar permanentemente", "Abrir um negócio", "Ainda não sei"] },
      { key: "objective_context", label: "O que você espera que esse projeto transforme na sua vida?", type: "textarea", optionalLabel: "Opcional" },
    ],
  },
  {
    key: "education",
    number: "03",
    title: "Formação acadêmica",
    intro: "Sua formação ajuda a dimensionar caminhos de estudo, trabalho e qualificação.",
    questions: [
      { key: "education_level", label: "Qual é o seu maior nível de escolaridade?", type: "select", required: true, options: ["Ensino médio", "Técnico", "Graduação", "Pós-graduação", "Mestrado", "Doutorado"] },
      { key: "education_field", label: "Qual é a sua área de formação?", type: "text", required: true },
      { key: "graduation_year", label: "Em que ano concluiu sua formação principal?", type: "number", min: 1950, max: 2030, required: true },
      { key: "education_outside_canada", label: "A formação foi concluída fora do Canadá?", type: "radio", required: true, options: yesNo },
      { key: "education_institution", label: "Instituição e país da formação", type: "text", optionalLabel: "Opcional" },
    ],
  },
  {
    key: "work_experience",
    number: "04",
    title: "Experiência profissional",
    intro: "Vamos observar senioridade, transferibilidade e possíveis exigências da sua profissão.",
    questions: [
      { key: "current_profession", label: "Qual é a sua profissão atual?", type: "text", required: true },
      { key: "experience_years", label: "Quantos anos de experiência possui nessa área?", type: "number", min: 0, max: 60, required: true },
      { key: "leadership_experience", label: "Possui experiência em liderança ou gestão?", type: "radio", required: true, options: yesNo },
      { key: "regulated_profession", label: "Seu trabalho exige formação específica, certificação ou licença?", type: "radio", required: true, options: ["Sim", "Não", "Não sei"] },
      { key: "canadian_work_experience", label: "Possui experiência de trabalho no Canadá?", type: "radio", required: true, options: yesNo },
      { key: "canadian_role", label: "Em qual função trabalhou no Canadá?", type: "text", required: true, showWhen: hasCanadianWork },
      { key: "canadian_work_duration", label: "Por quanto tempo trabalhou no Canadá?", type: "text", required: true, showWhen: hasCanadianWork },
    ],
  },
  {
    key: "languages",
    number: "05",
    title: "Inglês e francês",
    intro: "Idioma é um eixo de preparação. Registre seu momento atual com honestidade.",
    questions: [
      { key: "english_level", label: "Qual é o seu nível de inglês?", type: "select", required: true, options: ["Nenhum", "Básico", "Intermediário", "Avançado", "Fluente"] },
      { key: "english_test", label: "Possui prova oficial de inglês?", type: "select", required: true, options: ["IELTS", "CELPIP", "PTE Core", "Outra", "Não"] },
      { key: "english_test_details", label: "Informe modalidade, data e notas", type: "textarea", required: true, showWhen: hasEnglishTest },
      { key: "french_level", label: "Qual é o seu nível de francês?", type: "select", required: true, options: ["Nenhum", "Básico", "Intermediário", "Avançado", "Fluente"] },
      { key: "french_test", label: "Possui prova oficial de francês?", type: "select", required: true, options: ["TEF", "TCF", "Outra", "Não"] },
      { key: "french_test_details", label: "Informe data e notas", type: "textarea", required: true, showWhen: hasFrenchTest },
      { key: "french_investment", label: "Estaria disposto a investir no aprendizado de francês?", type: "radio", required: true, options: ["Sim", "Talvez", "Não"] },
    ],
  },
  {
    key: "finances",
    number: "06",
    title: "Recursos financeiros",
    intro: "Esses dados são sensíveis e servem apenas para calibrar um plano responsável.",
    sensitive: true,
    questions: [
      { key: "available_funds", label: "Quanto possui disponível para investir no projeto Canadá?", type: "number", min: 0, required: true, sensitive: true },
      { key: "funds_currency", label: "Em qual moeda?", type: "select", required: true, options: ["CAD", "BRL", "USD", "EUR", "Outra"] },
      { key: "funds_scope", label: "Esse valor inclui passagens, taxas, estudos, moradia e reserva de emergência?", type: "radio", required: true, options: ["Sim", "Parcialmente", "Não"] },
      { key: "sell_assets", label: "Pretende vender patrimônio para financiar o projeto?", type: "radio", required: true, options: yesNo },
      { key: "financial_support", label: "Possui apoio financeiro formal e comprovável?", type: "radio", required: true, options: yesNo },
      { key: "financial_context", label: "Explique sua situação financeira, se achar importante", type: "textarea", optionalLabel: "Opcional", sensitive: true },
    ],
  },
  {
    key: "spouse",
    number: "07",
    title: "Cônjuge ou parceiro",
    intro: "Quando o projeto é familiar, o perfil e o compromisso do casal importam.",
    questions: [
      { key: "spouse_age", label: "Idade do cônjuge ou parceiro", type: "number", min: 16, max: 100, required: true, showWhen: spouseApplies },
      { key: "spouse_education", label: "Maior nível de escolaridade", type: "select", required: true, options: ["Ensino médio", "Técnico", "Graduação", "Pós-graduação", "Mestrado", "Doutorado"], showWhen: spouseApplies },
      { key: "spouse_profession", label: "Profissão", type: "text", required: true, showWhen: spouseApplies },
      { key: "spouse_experience", label: "Anos de experiência", type: "number", min: 0, max: 60, required: true, showWhen: spouseApplies },
      { key: "spouse_english", label: "Nível de inglês", type: "select", required: true, options: ["Nenhum", "Básico", "Intermediário", "Avançado", "Fluente"], showWhen: spouseApplies },
      { key: "spouse_french", label: "Nível de francês", type: "select", required: true, options: ["Nenhum", "Básico", "Intermediário", "Avançado", "Fluente"], showWhen: spouseApplies },
      { key: "spouse_interest", label: "Qual é o interesse real em participar do projeto?", type: "select", required: true, options: ["Totalmente comprometido(a)", "Aberto(a), com dúvidas", "Pouco interessado(a)", "Ainda não conversamos"], showWhen: spouseApplies },
      { key: "spouse_context", label: "Contexto adicional", type: "textarea", optionalLabel: "Opcional", showWhen: spouseApplies },
    ],
  },
  {
    key: "immigration_history",
    number: "08",
    title: "Histórico migratório",
    intro: "Uma seção técnica e confidencial. Alertas aqui sempre exigem validação profissional.",
    sensitive: true,
    questions: [
      { key: "canadian_authorization", label: "Já teve visto ou autorização canadense?", type: "radio", required: true, options: yesNo },
      { key: "has_refusal", label: "Já teve visto, permissão ou pedido de imigração recusado pelo Canadá ou por outro país?", type: "radio", required: true, options: yesNo },
      { key: "refusal_details", label: "Informe país, tipo de pedido, ano e contexto", type: "textarea", required: true, sensitive: true, showWhen: hasRefusal },
      { key: "lived_in_canada", label: "Já morou, estudou ou trabalhou no Canadá?", type: "radio", required: true, options: yesNo },
      { key: "family_in_canada", label: "Possui familiares próximos no Canadá? Onde vivem?", type: "textarea", required: true },
      { key: "overstay", label: "Já permaneceu em algum país além do período autorizado?", type: "radio", required: true, options: yesNo, sensitive: true },
      { key: "admissibility_issue", label: "Existe questão médica, criminal ou migratória relevante?", type: "radio", required: true, options: ["Sim", "Não", "Prefiro explicar no campo abaixo"], sensitive: true },
      { key: "immigration_context", label: "Use este campo seguro para explicar algo importante", type: "textarea", optionalLabel: "Opcional", sensitive: true },
    ],
  },
  {
    key: "life_preferences",
    number: "09",
    title: "Preferências de vida",
    intro: "Um projeto coerente também precisa combinar com a vida que você quer levar.",
    questions: [
      { key: "life_priorities", label: "Quais são suas prioridades?", type: "multi", required: true, options: ["Residência permanente", "Melhor salário", "Menor custo de vida", "Segurança", "Qualidade de vida", "Empregabilidade"] },
      { key: "city_size", label: "Prefere cidade grande, média ou pequena?", type: "radio", required: true, options: ["Grande", "Média", "Pequena", "Sem preferência"] },
      { key: "location_preference", label: "Possui preferência por alguma província ou cidade? Por quê?", type: "textarea", required: true },
      { key: "outside_major_cities", label: "Estaria disposto a morar fora de Toronto, Vancouver ou Montréal?", type: "radio", required: true, options: ["Sim", "Talvez", "Não"] },
      { key: "family_must_haves", label: "Quais fatores são indispensáveis para sua família?", type: "textarea", required: true },
    ],
  },
  {
    key: "timeline",
    number: "10",
    title: "Prazo e flexibilidade",
    intro: "Prazo sem flexibilidade costuma gerar decisões caras. Vamos medir os dois.",
    questions: [
      { key: "project_timeline", label: "Qual é o prazo para iniciar o projeto?", type: "select", required: true, options: ["Menos de 6 meses", "De 6 a 12 meses", "De 1 a 2 anos", "Mais de 2 anos"] },
      { key: "willing_to_delay", label: "Adiaria o projeto para melhorar idioma, finanças ou qualificação?", type: "radio", required: true, options: ["Sim", "Talvez", "Não"] },
      { key: "career_change", label: "Mudaria de profissão ou faria formação complementar?", type: "radio", required: true, options: ["Sim", "Talvez", "Não"] },
      { key: "smaller_regions", label: "Consideraria cidades menores ou regiões menos populares?", type: "radio", required: true, options: ["Sim", "Talvez", "Não"] },
    ],
  },
  {
    key: "obstacles",
    number: "11",
    title: "Obstáculos e dúvidas",
    intro: "Fechamos com o que mais pesa hoje e com a pergunta que precisa de uma resposta clara.",
    questions: [
      { key: "biggest_challenge", label: "Qual acredita ser o maior desafio do projeto Canadá?", type: "textarea", required: true },
      { key: "difficulty_factors", label: "Quais fatores podem dificultar o plano?", type: "multi", required: true, options: ["Idade", "Filhos", "Recursos financeiros", "Idioma", "Profissão", "Histórico migratório", "Outro"] },
      { key: "main_question", label: "Qual é a maior dúvida que gostaria que o diagnóstico respondesse?", type: "textarea", required: true },
      { key: "anything_else", label: "Existe algo importante que não foi perguntado?", type: "textarea", optionalLabel: "Opcional" },
    ],
  },
];

export function visibleQuestions(section: DiagnosticSection, answers: FormAnswers) {
  return section.questions.filter((question) => !question.showWhen || question.showWhen(answers));
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
