import { ApiError, handleApiError, json, requireConsultant, writeAudit } from "../../../../../lib/api";
import { claimCaseForReview } from "../../../../../lib/case-lock";
import { getCaseDeliveryWindow } from "../../../../../lib/case-delivery";
import { getCentralClientById } from "../../../../../lib/central-client";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { admin, user } = await requireConsultant(request);
    const readOnly = new URL(request.url).searchParams.get("readOnly") === "1";
    const { data: readOnlyCase, error: readOnlyCaseError } = readOnly
      ? await admin
        .from("diagnostic_cases")
        .select("id,case_number,status,objective,submitted_at,updated_at,assigned_consultant_id,client_id,mentorship_consultation_scheduled_at")
        .eq("id", id)
        .maybeSingle()
      : { data: null, error: null };
    if (readOnlyCaseError) throw readOnlyCaseError;
    const diagnosticCase = readOnlyCase ?? await claimCaseForReview(admin, id, user.id);
    if (!diagnosticCase) throw new ApiError(404, "Simulador não encontrado.");

    const [client, { data: submission }, { data: assessment }, { data: review }, { data: history }] =
      await Promise.all([
        getCentralClientById(admin, diagnosticCase.client_id),
        admin
          .from("diagnostic_submissions")
          .select("answers_snapshot")
          .eq("case_id", id)
          .order("submitted_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        admin
          .from("diagnostic_ai_assessments")
          .select("id,version,structured_result,created_at")
          .eq("case_id", id)
          .eq("status", "completed")
          .order("version", { ascending: false })
          .limit(1)
          .maybeSingle(),
        admin
          .from("diagnostic_reviews")
          .select("id,version,status,updated_at")
          .eq("case_id", id)
          .order("version", { ascending: false })
          .limit(1)
          .maybeSingle(),
        admin
          .from("diagnostic_status_history")
          .select("id,from_status,to_status,note,created_at")
          .eq("case_id", id)
          .order("created_at", { ascending: false })
          .limit(30),
      ]);

    let answers = submission?.answers_snapshot ?? {};
    if (!submission) {
      const { data: rows } = await admin
        .from("diagnostic_answers")
        .select("question_key,answer")
        .eq("case_id", id);
      answers = Object.fromEntries((rows ?? []).map((row) => [row.question_key, row.answer]));
    }

    const deliveryData = client?.email
      ? await getCaseDeliveryWindow(admin, {
          client: { id: diagnosticCase.client_id, email: client.email },
          submittedAt: diagnosticCase.submitted_at,
          mentorshipConsultationScheduledAt: diagnosticCase.mentorship_consultation_scheduled_at,
        })
      : null;
    const deliveryWindow = deliveryData?.deliveryWindow ?? null;
    const purchaseWindow = deliveryData?.purchaseWindow ?? null;

    await writeAudit(admin, {
      caseId: id,
      actorUserId: user.id,
      actorType: "consultant",
      action: "diagnostic.viewed",
    });

    return json({
      case: diagnosticCase,
      client: {
        full_name: client?.name ?? "Cliente",
        email_display: client?.email ?? "",
      },
      answers,
      assessment: assessment ?? null,
      review: review ?? null,
      history: history ?? [],
      delivery_window: {
        purchase_date: purchaseWindow?.purchaseDate ?? null,
        purchase_event: purchaseWindow?.purchaseEvent ?? null,
        submitted_at: deliveryWindow?.submittedAt ?? null,
        delivery_release_at: deliveryWindow?.deliveryReleaseAt ?? null,
        delivery_rule: deliveryWindow?.deliveryRule ?? "standard",
        mentorship_consultation_scheduled_at: deliveryWindow?.mentorshipConsultationScheduledAt ?? null,
        eligible_to_send: deliveryWindow?.eligibleToSend ?? false,
        can_override_wait_period: deliveryWindow?.canOverrideWaitPeriod ?? false,
        message: deliveryWindow?.message ?? "A entrega só é liberada após compra aprovada.",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
