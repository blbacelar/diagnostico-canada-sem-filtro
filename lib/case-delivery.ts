import { buildDeliveryWindow } from "./delivery-window";
import { getPurchaseWindowForClient, isMentorshipClient, type PurchaseWindowClient } from "./purchase-window";
import { getAdminSupabase } from "./supabase";

type CaseDeliveryInput = {
  client: PurchaseWindowClient;
  submittedAt: string | null | undefined;
  mentorshipConsultationScheduledAt: string | null | undefined;
};

/**
 * Resolves the one delivery rule used by the manual action, detail page and
 * scheduled sender. Mentoria never uses the standard waiting-period override.
 */
export async function getCaseDeliveryWindow(
  admin: ReturnType<typeof getAdminSupabase>,
  input: CaseDeliveryInput,
  now = new Date(),
) {
  const [purchaseWindow, isMentorship] = await Promise.all([
    getPurchaseWindowForClient(admin, input.client, now),
    isMentorshipClient(admin, input.client.id),
  ]);

  return {
    purchaseWindow,
    deliveryWindow: buildDeliveryWindow(purchaseWindow, input.submittedAt, now, {
      deliveryRule: isMentorship ? "mentorship_consultation" : "standard",
      mentorshipConsultationScheduledAt: input.mentorshipConsultationScheduledAt,
    }),
  };
}
