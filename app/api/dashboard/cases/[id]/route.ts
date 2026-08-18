import { ApiError, handleApiError, json, requireConsultant, writeAudit } from "../../../../../lib/api";
import { claimCaseForReview } from "../../../../../lib/case-lock";
import { getPurchaseWindowForEmail } from "../../../../../lib/purchase-window";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { admin, user } = await requireConsultant(request);
    const diagnosticCase = await claimCaseForReview(admin, id, user.id);
    if (!diagnosticCase) throw new ApiError(404, "Simulador não encontrado.");

    const [{ data: client }, { data: submission }, { data: assessment }, { data: review }, { data: history }] =
      await Promise.all([
        admin
          .from("clients")
          .select("name,email")
          .eq("id", diagnosticCase.client_id)
          .single(),
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

    const purchaseWindow = client?.email
      ? await getPurchaseWindowForEmail(admin, client.email)
      : {
          purchaseDate: null,
          purchaseEvent: null,
          daysSincePurchase: null,
          daysRemaining: null,
          eligibleToSend: false,
          message: "A entrega só é liberada após compra aprovada.",
        };

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
        purchase_date: purchaseWindow.purchaseDate,
        purchase_event: purchaseWindow.purchaseEvent,
        days_since_purchase: purchaseWindow.daysSincePurchase,
        days_remaining: purchaseWindow.daysRemaining,
        eligible_to_send: purchaseWindow.eligibleToSend,
        message: purchaseWindow.message,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
