import { randomUUID } from "node:crypto";

import { json, writeAudit } from "../../../../lib/api";
import { caseClient } from "../../../../lib/cases";
import { sendFinalDiagnosticWithPdf } from "../../../../lib/email";
import { generateReportPdf, getReportData } from "../../../../lib/report";
import { getOperationalConfig } from "../../../../lib/operational-config.server";
import { getPurchaseWindowForEmail } from "../../../../lib/purchase-window";
import { getAdminSupabase } from "../../../../lib/supabase";
import { constantTimeEqual, createFormToken, hashFormToken } from "../../../../lib/tokens";

const AUTO_DELIVERY_BATCH_SIZE = 20;
const AUTO_DELIVERY_METHOD = "pdf";
const defaultSubject = "O resultado do seu Simulador Canadá Sem Filtro está pronto";
const defaultBody = "Olá!\n\nConcluímos a revisão profissional do seu simulador. No relatório, você encontrará uma leitura contextualizada do seu momento, os pontos que pedem atenção e três próximos passos prioritários.\n\nLeia com calma e lembre-se dos limites educacionais apresentados no documento.\n\nCom carinho,\nEquipe Canadá Sem Filtro\n\nImportante: O Simulador Canadá Sem Filtro não é uma consulta de imigração. É um conteúdo educativo para ajudar você a conhecer a realidade de viver no Canadá — incluindo desafios, custos, oportunidades e aspectos que nem sempre aparecem nas redes sociais.\n\nPara uma análise individual do seu perfil imigratório, é necessário agendar uma consulta profissional.";

type FinalDeliveryTemplate = {
  subject: string;
  body: string;
  version: number;
};

function isAuthorizedCronRequest(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  return Boolean(secret && authorization && constantTimeEqual(authorization, `Bearer ${secret}`));
}

function personalizeTemplate(value: string, clientName: string, caseNumber: string) {
  return value
    .replaceAll("{{nome}}", clientName)
    .replaceAll("{{diagnostico}}", caseNumber);
}

function errorCode(error: unknown) {
  return error instanceof Error && error.name ? error.name.slice(0, 80) : "AUTO_DELIVERY_EXCEPTION";
}

function errorMessage(error: unknown) {
  return error instanceof Error && error.message
    ? error.message.slice(0, 500)
    : "Erro desconhecido no envio automático.";
}

async function activeFinalDeliveryTemplate() {
  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from("diagnostic_email_templates")
    .select("subject,body,version")
    .eq("template_key", "final_delivery")
    .eq("active", true)
    .maybeSingle();

  if (error) throw error;
  return (data ?? { subject: defaultSubject, body: defaultBody, version: 0 }) as FinalDeliveryTemplate;
}

async function deliverCase(caseId: string, template: FinalDeliveryTemplate) {
  const admin = getAdminSupabase();
  const [target, config] = await Promise.all([
    caseClient(admin, caseId),
    getOperationalConfig(admin),
  ]);
  const purchaseWindow = await getPurchaseWindowForEmail(admin, target.client.email_normalized);
  if (!purchaseWindow.eligibleToSend) return { outcome: "skipped" as const, reason: "purchase_window" };

  const { data: review, error: reviewError } = await admin
    .from("diagnostic_reviews")
    .select("id")
    .eq("case_id", caseId)
    .eq("status", "approved")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (reviewError) throw reviewError;
  if (!review) return { outcome: "skipped" as const, reason: "review_not_approved" };

  // This conditional update is the delivery reservation: a simultaneous human
  // action or a duplicate cron invocation can reserve the case only once.
  const { data: reservedCase, error: reserveError } = await admin
    .from("diagnostic_cases")
    .update({ status: "sending" })
    .eq("id", caseId)
    .eq("status", "approved")
    .select("id,case_number")
    .maybeSingle();
  if (reserveError) throw reserveError;
  if (!reservedCase) return { outcome: "skipped" as const, reason: "already_reserved" };

  const subject = personalizeTemplate(template.subject, target.client.full_name, target.case.case_number);
  const body = personalizeTemplate(template.body, target.client.full_name, target.case.case_number);
  const idempotencyKey = randomUUID();
  let deliveryId: string | null = null;
  let providerAccepted = false;

  try {
    const reportToken = createFormToken();
    const { error: tokenError } = await admin.from("diagnostic_report_tokens").insert({
      case_id: caseId,
      review_id: review.id,
      token_hash: hashFormToken(reportToken),
      expires_at: new Date(Date.now() + config.reportLinkDays * 24 * 60 * 60 * 1000).toISOString(),
    });
    if (tokenError) throw tokenError;

    const reportUrl = `${process.env.APP_URL ?? "http://localhost:3000"}/relatorio/${encodeURIComponent(reportToken)}`;
    const { data: delivery, error: deliveryCreateError } = await admin
      .from("diagnostic_email_deliveries")
      .insert({
        case_id: caseId,
        delivery_type: "final_diagnostic",
        recipient: target.client.email_normalized,
        subject,
        body_snapshot: body,
        status: "sending",
        sent_by: null,
        idempotency_key: idempotencyKey,
        metadata: {
          automated: true,
          deliveryMethod: AUTO_DELIVERY_METHOD,
          reportLinkDays: config.reportLinkDays,
          templateVersion: template.version,
        },
      })
      .select("id")
      .single();
    if (deliveryCreateError) throw deliveryCreateError;
    deliveryId = delivery.id;

    const pdf = await generateReportPdf(await getReportData(admin, caseId));
    const result = await sendFinalDiagnosticWithPdf({
      to: target.client.email_normalized,
      subject,
      body,
      reportUrl,
      pdf,
      caseNumber: target.case.case_number,
    });
    if (result.error) throw result.error;
    providerAccepted = true;

    const { error: deliveryError } = await admin.from("diagnostic_email_deliveries").update({
      status: "sent",
      provider_id: result.data?.id ?? null,
      sent_at: new Date().toISOString(),
    }).eq("id", deliveryId);
    if (deliveryError) throw deliveryError;

    const { error: sentStatusError } = await admin
      .from("diagnostic_cases")
      .update({ status: "sent" })
      .eq("id", caseId)
      .eq("status", "sending");
    if (sentStatusError) throw sentStatusError;

    const logging = await Promise.allSettled([
      admin.from("diagnostic_status_history").insert({
        case_id: caseId,
        from_status: "sending",
        to_status: "sent",
        actor_type: "system",
        note: "Resultado final do simulador enviado automaticamente.",
      }),
      writeAudit(admin, {
        caseId,
        actorType: "system",
        action: "diagnostic.delivery_automated",
        metadata: {
          deliveryMethod: AUTO_DELIVERY_METHOD,
          templateVersion: template.version,
        },
      }),
    ]);
    if (logging.some((result) => result.status === "rejected")) {
      console.error("automatic_final_delivery_audit_failed", { caseId });
    }

    return { outcome: "sent" as const };
  } catch (error) {
    console.error("automatic_final_delivery_failed", { caseId, errorCode: errorCode(error) });
    // If the provider accepted the email but persisting the final state failed,
    // leave the case in `sending`. Retrying automatically could duplicate a
    // delivery that the client has already received.
    if (providerAccepted) {
      if (deliveryId) {
        await admin.from("diagnostic_email_deliveries").update({
          error_code: errorCode(error),
          metadata: {
            automated: true,
            deliveryMethod: AUTO_DELIVERY_METHOD,
            templateVersion: template.version,
            errorMessage: errorMessage(error),
            providerAccepted: true,
          },
        }).eq("id", deliveryId);
      }
      return { outcome: "failed" as const, reason: "provider_accepted_manual_reconciliation" };
    }
    await admin
      .from("diagnostic_cases")
      .update({ status: "approved" })
      .eq("id", caseId)
      .eq("status", "sending");
    if (deliveryId) {
      await admin.from("diagnostic_email_deliveries").update({
        status: "failed",
        error_code: errorCode(error),
        metadata: {
          automated: true,
          deliveryMethod: AUTO_DELIVERY_METHOD,
          templateVersion: template.version,
          errorMessage: errorMessage(error),
        },
      }).eq("id", deliveryId);
    }
    const logging = await Promise.allSettled([
      admin.from("diagnostic_status_history").insert({
        case_id: caseId,
        from_status: "sending",
        to_status: "approved",
        actor_type: "system",
        note: "Falha no envio automático; parecer aprovado preservado para nova tentativa.",
      }),
      writeAudit(admin, {
        caseId,
        actorType: "system",
        action: "diagnostic.delivery_automated_failed",
        metadata: {
          deliveryMethod: AUTO_DELIVERY_METHOD,
          errorCode: errorCode(error),
        },
      }),
    ]);
    if (logging.some((result) => result.status === "rejected")) {
      console.error("automatic_final_delivery_failure_audit_failed", { caseId });
    }
    return { outcome: "failed" as const, reason: errorCode(error) };
  }
}

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const admin = getAdminSupabase();
    const { data: cases, error } = await admin
      .from("diagnostic_cases")
      .select("id")
      .eq("status", "approved")
      .is("archived_at", null)
      .order("updated_at", { ascending: true })
      .limit(AUTO_DELIVERY_BATCH_SIZE);
    if (error) throw error;

    const template = await activeFinalDeliveryTemplate();
    const results = await Promise.all((cases ?? []).map(({ id }) => deliverCase(id, template)));
    const sent = results.filter((result) => result.outcome === "sent").length;
    const failed = results.filter((result) => result.outcome === "failed").length;

    return json({ processed: results.length, sent, failed, skipped: results.length - sent - failed });
  } catch (error) {
    console.error("automatic_final_delivery_cron_failed", { errorCode: errorCode(error) });
    return json({ error: "Não foi possível concluir os envios automáticos." }, { status: 500 });
  }
}
