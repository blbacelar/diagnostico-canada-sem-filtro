import { z } from "zod";
import { diagnosticSections, visibleQuestions } from "./questions";
import type { DiagnosticQuestion, DiagnosticSection, FormAnswers } from "./types";

const TEXT_LIMIT = 300;
const LONG_TEXT_LIMIT = 5_000;

function isEmptyAnswer(value: unknown) {
  return value === undefined
    || value === null
    || (typeof value === "string" && value.trim() === "")
    || (Array.isArray(value) && value.length === 0);
}

function numberRangeMessage(question: DiagnosticQuestion) {
  if (question.min !== undefined && question.max !== undefined) {
    return `Informe um número inteiro entre ${question.min} e ${question.max}.`;
  }
  if (question.min !== undefined) return `Informe um número inteiro maior ou igual a ${question.min}.`;
  if (question.max !== undefined) return `Informe um número inteiro menor ou igual a ${question.max}.`;
  return "Informe um número inteiro válido.";
}

function valueSchema(question: DiagnosticQuestion): z.ZodType {
  if (question.format === "currency") {
    return z
      .number({ error: "Informe um valor monetário válido." })
      .finite("Informe um valor monetário válido.")
      .min(question.min ?? 0, `O valor deve ser maior ou igual a ${question.min ?? 0}.`)
      .max(Number.MAX_SAFE_INTEGER, "O valor monetário informado é muito alto.")
      .refine((value) => value === Number(value.toFixed(2)), {
        message: "Use no máximo duas casas decimais.",
      });
  }

  if (question.type === "number") {
    let schema = z
      .number({ error: "Informe somente números." })
      .finite("Informe somente números.")
      .int("Informe um número inteiro.")
      .safe("Informe um número válido.");
    if (question.min !== undefined) schema = schema.min(question.min, numberRangeMessage(question));
    if (question.max !== undefined) schema = schema.max(question.max, numberRangeMessage(question));
    return schema;
  }

  if (question.type === "text" || question.type === "email") {
    const schema = z.string({ error: "Informe um texto válido." }).max(TEXT_LIMIT, `Use no máximo ${TEXT_LIMIT} caracteres.`);
    return question.type === "email" ? schema.email("Informe um e-mail válido.") : schema;
  }

  if (question.type === "textarea") {
    return z.string({ error: "Informe um texto válido." }).max(LONG_TEXT_LIMIT, `Use no máximo ${LONG_TEXT_LIMIT} caracteres.`);
  }

  if (question.type === "select" || question.type === "radio") {
    return z
      .string({ error: "Selecione uma opção válida." })
      .refine((value) => question.options?.includes(value) === true, "Selecione uma opção válida.");
  }

  if (question.type === "multi" || question.type === "checkbox") {
    return z
      .array(z.string(), { error: "Selecione opções válidas." })
      .max(question.options?.length ?? 100, "Selecione opções válidas.")
      .refine((values) => new Set(values).size === values.length, "Não repita a mesma opção.")
      .refine((values) => values.every((value) => question.options?.includes(value)), "Selecione opções válidas.");
  }

  if (question.type === "boolean") return z.boolean({ error: "Marque ou desmarque esta opção." });

  return z.unknown();
}

export function validateQuestionAnswer(question: DiagnosticQuestion, value: unknown, requireAnswer = false) {
  if (isEmptyAnswer(value)) return requireAnswer && question.required ? "Este campo é obrigatório." : null;
  const result = valueSchema(question).safeParse(value);
  return result.success ? null : result.error.issues[0]?.message ?? "Confira o valor informado.";
}

const allQuestions = diagnosticSections.flatMap((section) => section.questions);
const questionsByKey = new Map(allQuestions.map((question) => [question.key, question]));

function diagnosticAnswersSchema(requireComplete: boolean) {
  return z.record(z.string().min(1).max(80), z.unknown()).superRefine((answers, context) => {
    const visibleKeys = requireComplete
      ? new Set(diagnosticSections.flatMap((section) => visibleQuestions(section, answers).map((question) => question.key)))
      : null;
    for (const [key, value] of Object.entries(answers)) {
      const question = questionsByKey.get(key);
      if (!question) {
        context.addIssue({ code: "custom", path: [key], message: "Este campo não pertence ao formulário atual." });
        continue;
      }
      if (visibleKeys && !visibleKeys.has(key)) continue;
      const message = validateQuestionAnswer(question, value);
      if (message) context.addIssue({ code: "custom", path: [key], message });
    }

    if (!requireComplete) return;
    for (const section of diagnosticSections) {
      for (const question of visibleQuestions(section, answers)) {
        const message = validateQuestionAnswer(question, answers[question.key], true);
        if (message && isEmptyAnswer(answers[question.key])) {
          context.addIssue({ code: "custom", path: [question.key], message });
        }
      }
    }
  });
}

export const diagnosticDraftAnswersSchema = diagnosticAnswersSchema(false);
export const diagnosticSubmissionAnswersSchema = diagnosticAnswersSchema(true);

export function validationErrorsForSection(section: DiagnosticSection, answers: FormAnswers) {
  return Object.fromEntries(
    visibleQuestions(section, answers).flatMap((question) => {
      const message = validateQuestionAnswer(question, answers[question.key], true);
      return message ? [[question.key, message]] : [];
    }),
  ) as Record<string, string>;
}

export function validationErrorsForDiagnostic(answers: FormAnswers) {
  const result = diagnosticSubmissionAnswersSchema.safeParse(answers);
  if (result.success) return {};
  return Object.fromEntries(
    result.error.issues.flatMap((issue) => typeof issue.path[0] === "string" ? [[issue.path[0], issue.message]] : []),
  ) as Record<string, string>;
}
