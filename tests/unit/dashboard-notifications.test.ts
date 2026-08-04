import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  sendDashboardSubmissionNotification: vi.fn(),
}));

vi.mock("../../lib/email", () => ({
  sendDashboardSubmissionNotification: mocks.sendDashboardSubmissionNotification,
}));

import {
  getActiveDashboardNotificationRecipients,
  notifyDashboardUsersOfSubmission,
} from "../../lib/dashboard-notifications";

type Consultant = { user_id: string; display_name: string; notification_email: string | null };

function adminStub(consultants: Consultant[], authEmails: Record<string, string | undefined> = {}) {
  const insertDeliveries = vi.fn().mockResolvedValue({ error: null });
  const getUserById = vi.fn(async (userId: string) => ({
    data: { user: { email: authEmails[userId] } },
    error: null,
  }));
  const admin = {
    auth: { admin: { getUserById } },
    from: vi.fn((table: string) => {
      if (table === "diagnostic_consultants") {
        return { select: () => ({ eq: vi.fn().mockResolvedValue({ data: consultants, error: null }) }) };
      }
      if (table === "diagnostic_email_deliveries") return { insert: insertDeliveries };
      throw new Error(`Tabela inesperada: ${table}`);
    }),
  };
  return { admin, getUserById, insertDeliveries };
}

describe("notificações do dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sendDashboardSubmissionNotification.mockResolvedValue({ data: { id: "resend-id" }, error: null });
  });

  it("usa o e-mail de notificação e recorre ao e-mail da conta quando necessário", async () => {
    const { admin, getUserById } = adminStub([
      { user_id: "admin-1", display_name: "Administradora", notification_email: "AVISOS@EXAMPLE.COM" },
      { user_id: "consultant-1", display_name: "Consultora", notification_email: null },
    ], { "consultant-1": "consultora@example.com" });

    const recipients = await getActiveDashboardNotificationRecipients(admin as never);

    expect(recipients).toEqual([
      { userId: "admin-1", displayName: "Administradora", email: "avisos@example.com" },
      { userId: "consultant-1", displayName: "Consultora", email: "consultora@example.com" },
    ]);
    expect(getUserById).toHaveBeenCalledTimes(1);
    expect(getUserById).toHaveBeenCalledWith("consultant-1");
  });

  it("envia individualmente, usa idempotência e registra cada entrega", async () => {
    const { admin, insertDeliveries } = adminStub([
      { user_id: "admin-1", display_name: "Administradora", notification_email: "admin@example.com" },
      { user_id: "consultant-1", display_name: "Consultora", notification_email: "consultora@example.com" },
    ]);

    const result = await notifyDashboardUsersOfSubmission(admin as never, {
      caseId: "case-123",
      caseNumber: "CSF-2026-0001",
      clientName: "Cliente Teste",
    });

    expect(result).toEqual({ recipients: 2, sent: 2, failed: 0 });
    expect(mocks.sendDashboardSubmissionNotification).toHaveBeenCalledTimes(2);
    expect(mocks.sendDashboardSubmissionNotification).toHaveBeenNthCalledWith(1, expect.objectContaining({
      to: "admin@example.com",
      idempotencyKey: "diagnostic-submitted-case-123-admin-1",
    }));
    expect(mocks.sendDashboardSubmissionNotification).toHaveBeenNthCalledWith(2, expect.objectContaining({
      to: "consultora@example.com",
      idempotencyKey: "diagnostic-submitted-case-123-consultant-1",
    }));
    expect(insertDeliveries).toHaveBeenCalledWith([
      expect.objectContaining({ recipient: "admin@example.com", status: "sent", provider_id: "resend-id" }),
      expect.objectContaining({ recipient: "consultora@example.com", status: "sent", provider_id: "resend-id" }),
    ]);
  });

  it("registra falha de um destinatário sem impedir os demais envios", async () => {
    const { admin, insertDeliveries } = adminStub([
      { user_id: "admin-1", display_name: "Administradora", notification_email: "admin@example.com" },
      { user_id: "consultant-1", display_name: "Consultora", notification_email: "consultora@example.com" },
    ]);
    mocks.sendDashboardSubmissionNotification
      .mockResolvedValueOnce({ data: null, error: { name: "rate_limit_exceeded" } })
      .mockResolvedValueOnce({ data: { id: "resend-ok" }, error: null });

    const result = await notifyDashboardUsersOfSubmission(admin as never, {
      caseId: "case-123",
      caseNumber: "CSF-2026-0001",
      clientName: "Cliente Teste",
    });

    expect(result).toEqual({ recipients: 2, sent: 1, failed: 1 });
    expect(insertDeliveries).toHaveBeenCalledWith([
      expect.objectContaining({ recipient: "admin@example.com", status: "failed", error_code: "rate_limit_exceeded" }),
      expect.objectContaining({ recipient: "consultora@example.com", status: "sent", provider_id: "resend-ok" }),
    ]);
  });
});
