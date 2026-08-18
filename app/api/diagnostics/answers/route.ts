import { answersPayloadSchema } from "../../../../lib/schemas";
import { ApiError, enforceRateLimit, handleApiError, json, parseJson, requireFormCase, writeAudit } from "../../../../lib/api";
import { normalizeDiagnosticAnswers, sectionForQuestion } from "../../../../lib/questions";
export async function PUT(request: Request) {
	try {
		await enforceRateLimit(request, "diagnostic_answers", 180, 15);
		const payload = await parseJson(request, answersPayloadSchema, 120_000);
		const { admin, caseRow } = await requireFormCase(request);
		const sourceMetadata = caseRow.source_metadata && typeof caseRow.source_metadata === "object" ? caseRow.source_metadata as Record<string, unknown> : {};
		const isConsultantManaged = sourceMetadata.source === "consultant_reassessment" || sourceMetadata.consultant_managed === true;
		if (caseRow.status !== "client_draft" && !isConsultantManaged) {
			throw new ApiError(409, "As respostas deste simulador já foram enviadas.", "ANSWERS_LOCKED");
		}

		const normalizedAnswers = normalizeDiagnosticAnswers(payload.answers);
		const entries = Object.entries(normalizedAnswers);

		for (const [key, value] of entries) {
			const section = sectionForQuestion(key);
			if (!section) {
				throw new ApiError(422, "Uma resposta não pertence ao formulário atual.", "UNKNOWN_QUESTION");
			}
			if (JSON.stringify(value).length > 10_000) {
				throw new ApiError(413, "Uma resposta ultrapassa o limite permitido.");
			}
		}

		if (entries.length) {
			const rows = entries.map(([question_key, answer]) => ({
				case_id: caseRow.id,
				section_key: sectionForQuestion(question_key)!.key,
				question_key,
				answer,
				schema_version: payload.schemaVersion,
			}));

			const { error } = await admin
				.from("diagnostic_answers")
				.upsert(rows, { onConflict: "case_id,question_key" });
			if (error) throw error;

			await writeAudit(admin, {
				caseId: caseRow.id,
				actorType: isConsultantManaged ? "consultant" : "client",
				action: "answers.saved",
				metadata: { questionCount: entries.length },
			});
		}

		return json({ savedAt: new Date().toISOString() });
	} catch (error) {
		return handleApiError(error);
	}
}
