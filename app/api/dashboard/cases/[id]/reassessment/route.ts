import { z } from "zod";
import { ApiError, handleApiError, hasDatabaseErrorCode, json, requireConsultant } from "../../../../../../lib/api";
import { newCaseNumber } from "../../../../../../lib/cases";
import { getOperationalConfig } from "../../../../../../lib/operational-config.server";
import { createFormToken, hashFormToken } from "../../../../../../lib/tokens";

const caseIdSchema = z.string().uuid();

type ReassessmentRow = { id: string; case_number: string };

type SourceCase = {
  id: string;
  case_number: string;
  client_id: string;
  objective: string | null;
  status: string;
};

type SourceAnswer = {
  section_key: string;
  question_key: string;
  answer: unknown;
  schema_version: number;
};

type ConsultantContext = Awaited<ReturnType<typeof requireConsultant>>;

async function createReassessmentFallback(
  admin: ConsultantContext["admin"],
  sourceCase: SourceCase,
  consultantId: string,
  token: string,
  expiresAt: string,
) {
  const { data: sourceAnswers, error: answersError } = await admin
    .from("diagnostic_answers")
    .select("section_key,question_key,answer,schema_version")
    .eq("case_id", sourceCase.id);
  if (answersError) throw answersError;

  if (!sourceAnswers || sourceAnswers.length === 0) {
    throw new ApiError(
      409,
      "O diagnóstico enviado não possui respostas para reutilizar.",
      "SOURCE_ANSWERS_UNAVAILABLE",
    );
  }

  const objectiveAnswer = sourceAnswers.find(
    (item) => item.question_key === "main_objective",
  )?.answer;
  const copiedObjective =
    typeof objectiveAnswer === "string"
      ? objectiveAnswer
      : objectiveAnswer && typeof objectiveAnswer === "object"
        ? JSON.stringify(objectiveAnswer)
        : null;

  const sourceMetadata = {
    source: "consultant_reassessment",
    copied_from_case_id: sourceCase.id,
    created_by_consultant_id: consultantId,
  };

  const { data: createdCase, error: createCaseError } = await admin
    .from("diagnostic_cases")
    .insert({
      case_number: newCaseNumber(),
      client_id: sourceCase.client_id,
      status: "client_draft",
      objective:
        sourceCase.objective?.trim() ||
        (typeof copiedObjective === "string" ? copiedObjective : null),
      source_metadata: sourceMetadata,
    })
    .select("id,case_number")
    .single();
  if (createCaseError) {
    if (hasDatabaseErrorCode(createCaseError, "23505")) {
      throw new ApiError(
        409,
        "Já existe um diagnóstico em andamento para este cliente.",
        "ACTIVE_DIAGNOSTIC_EXISTS",
      );
    }
    throw createCaseError;
  }

  const answersToCopy = (sourceAnswers as SourceAnswer[]).map((item) => ({
    case_id: createdCase.id,
    section_key: item.section_key,
    question_key: item.question_key,
    answer: item.answer,
    schema_version: item.schema_version,
  }));

  const { error: insertAnswersError } = await admin
    .from("diagnostic_answers")
    .insert(answersToCopy);
  if (insertAnswersError) throw insertAnswersError;

  const { error: tokenError } = await admin.from("diagnostic_access_tokens").insert({
    case_id: createdCase.id,
    token_hash: hashFormToken(token),
    expires_at: expiresAt,
  });
  if (tokenError) throw tokenError;

  const { error: historyError } = await admin.from("diagnostic_status_history").insert({
    case_id: createdCase.id,
    from_status: null,
    to_status: "client_draft",
    actor_type: "consultant",
    actor_user_id: consultantId,
    note: `Novo diagnóstico criado a partir de ${sourceCase.case_number} com respostas editáveis.`,
  });
  if (historyError) throw historyError;

  await admin.from("diagnostic_audit_logs").insert({
    case_id: createdCase.id,
    actor_user_id: consultantId,
    actor_type: "consultant",
    action: "diagnostic.reassessment_created",
    metadata: { sourceCaseId: sourceCase.id, sourceCaseNumber: sourceCase.case_number },
  });

  return createdCase;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: rawCaseId } = await params;
    const caseId = caseIdSchema.parse(rawCaseId);
    const { admin, user } = await requireConsultant(request);
    const { data: sourceCase, error: sourceError } = await admin
      .from("diagnostic_cases")
      .select("id,case_number,client_id,objective,status")
      .eq("id", caseId)
      .is("archived_at", null)
      .maybeSingle();
    if (sourceError) throw sourceError;
    if (!sourceCase) throw new ApiError(404, "Diagnóstico não encontrado.", "CASE_NOT_FOUND");
    if (sourceCase.status !== "sent") {
      throw new ApiError(409, "O novo diagnóstico só pode ser criado depois que a entrega anterior foi enviada.", "CASE_NOT_DELIVERED");
    }

    const config = await getOperationalConfig(admin);
    const token = createFormToken();
    const expiresAt = new Date(Date.now() + config.formLinkDays * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await admin.rpc("create_diagnostic_reassessment", {
      p_source_case_id: caseId,
      p_consultant_id: user.id,
      p_case_number: newCaseNumber(),
      p_token_hash: hashFormToken(token),
      p_token_expires_at: expiresAt,
    });
    if (error && hasDatabaseErrorCode(error, "42501")) {
      const created = await createReassessmentFallback(
        admin,
        sourceCase as SourceCase,
        user.id,
        token,
        expiresAt,
      );
      return json({
        caseId: created.id,
        caseNumber: created.case_number,
        editUrl: `/formulario?token=${encodeURIComponent(token)}&origem=dashboard`,
      }, { status: 201 });
    }
    if (error) {
      if (hasDatabaseErrorCode(error, "23505")) {
        throw new ApiError(409, "Já existe um diagnóstico em andamento para este cliente.", "ACTIVE_DIAGNOSTIC_EXISTS");
      }
      if (hasDatabaseErrorCode(error, "P0001")) {
        throw new ApiError(
          409,
          "O novo diagnóstico só pode ser criado depois que a entrega anterior foi enviada.",
          "CASE_NOT_DELIVERED",
        );
      }
      if (hasDatabaseErrorCode(error, "P0002")) {
        throw new ApiError(409, error.message, "SOURCE_ANSWERS_UNAVAILABLE");
      }
      throw error;
    }
    const created = (data as ReassessmentRow[] | null)?.[0];
    if (!created) throw new ApiError(500, "O novo diagnóstico não pôde ser aberto.", "REASSESSMENT_NOT_CREATED");

    return json({
      caseId: created.id,
      caseNumber: created.case_number,
      editUrl: `/formulario?token=${encodeURIComponent(token)}&origem=dashboard`,
    }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
