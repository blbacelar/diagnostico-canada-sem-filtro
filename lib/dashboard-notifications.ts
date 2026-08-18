import { z } from "zod";
import { sendDashboardSubmissionNotification } from "./email";
import { getAdminSupabase } from "./supabase";

type AdminClient = ReturnType<typeof getAdminSupabase>;

type DashboardRecipient = {
  userId: string;
  displayName: string;
  email: string;
};

type NotificationResult = {
  recipients: number;
  sent: number;
  failed: number;
};

const emailSchema = z.string().trim().toLowerCase().pipe(z.email());

function errorName(error: unknown) {
  if (error && typeof error === "object" && "name" in error && typeof error.name === "string") return error.name;
  if (error instanceof Error) return error.name;
  return "UNKNOWN_ERROR";
}

export async function getActiveDashboardNotificationRecipients(admin: AdminClient): Promise<DashboardRecipient[]> {
  const { data: consultants, error } = await admin
    .from("diagnostic_consultants")
    .select("user_id,display_name,notification_email")
    .eq("active", true);
  if (error) throw error;

  const recipients = await Promise.all((consultants ?? []).map(async (consultant) => {
    let candidate = consultant.notification_email;
    if (!candidate) {
      const { data, error: authError } = await admin.auth.admin.getUserById(consultant.user_id);
      if (authError) {
        console.error("dashboard_notification_recipient_lookup_failed", { userId: consultant.user_id, error: authError.name });
        return null;
      }
      candidate = data.user?.email ?? null;
    }

    const parsedEmail = emailSchema.safeParse(candidate);
    if (!parsedEmail.success) {
      console.error("dashboard_notification_recipient_invalid", { userId: consultant.user_id });
      return null;
    }

    return {
      userId: consultant.user_id,
      displayName: consultant.display_name,
      email: parsedEmail.data,
    };
  }));

  const uniqueRecipients = new Map<string, DashboardRecipient>();
  for (const recipient of recipients) {
    if (recipient && !uniqueRecipients.has(recipient.email)) uniqueRecipients.set(recipient.email, recipient);
  }
  return [...uniqueRecipients.values()];
}

export async function notifyDashboardUsersOfSubmission(
  admin: AdminClient,
  input: { caseId: string; caseNumber: string; clientName: string },
): Promise<NotificationResult> {
  const recipients = await getActiveDashboardNotificationRecipients(admin);
  const subject = `Novo simulador recebido — ${input.caseNumber}`;
  const deliveries = await Promise.all(recipients.map(async (recipient) => {
    try {
      const result = await sendDashboardSubmissionNotification({
        to: recipient.email,
        displayName: recipient.displayName,
        clientName: input.clientName,
        caseId: input.caseId,
        caseNumber: input.caseNumber,
        idempotencyKey: `diagnostic-submitted-${input.caseId}-${recipient.userId}`,
      });
      return {
        case_id: input.caseId,
        delivery_type: "dashboard_submission_notification",
        recipient: recipient.email,
        subject,
        status: result.error ? "failed" : "sent",
        provider_id: result.data?.id ?? null,
        error_code: result.error?.name ?? null,
        sent_at: result.error ? null : new Date().toISOString(),
        metadata: { recipientUserId: recipient.userId },
      };
    } catch (error) {
      return {
        case_id: input.caseId,
        delivery_type: "dashboard_submission_notification",
        recipient: recipient.email,
        subject,
        status: "failed",
        provider_id: null,
        error_code: errorName(error),
        sent_at: null,
        metadata: { recipientUserId: recipient.userId },
      };
    }
  }));

  if (deliveries.length > 0) {
    const { error } = await admin.from("diagnostic_email_deliveries").insert(deliveries);
    if (error) throw error;
  }

  const sent = deliveries.filter((delivery) => delivery.status === "sent").length;
  return { recipients: recipients.length, sent, failed: recipients.length - sent };
}
