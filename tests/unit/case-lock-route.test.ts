import { describe, expect, it, vi } from "vitest";

const { requireConsultant, releaseCaseLock } = vi.hoisted(() => ({
  requireConsultant: vi.fn(),
  releaseCaseLock: vi.fn(),
}));

vi.mock("../../lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/api")>()),
  requireConsultant,
}));

vi.mock("../../lib/case-lock", () => ({ releaseCaseLock }));

import { DELETE } from "../../app/api/dashboard/cases/[id]/lock/route";

describe("rota de liberação de reserva do caso", () => {
  it("libera usando a consultora autenticada", async () => {
    const admin = {};
    const diagnosticCase = { id: "case-1", assigned_consultant_id: null };
    requireConsultant.mockResolvedValue({ admin, user: { id: "consultant-1" } });
    releaseCaseLock.mockResolvedValue(diagnosticCase);

    const response = await DELETE(
      new Request("http://localhost/api/dashboard/cases/case-1/lock", { method: "DELETE" }),
      { params: Promise.resolve({ id: "case-1" }) },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ case: diagnosticCase });
    expect(releaseCaseLock).toHaveBeenCalledWith(admin, "case-1", "consultant-1");
  });
});
