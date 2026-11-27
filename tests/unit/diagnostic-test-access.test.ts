import { describe, expect, it, vi } from "vitest";
import { hasDiagnosticFormAccessForEmail, isAllowedEmailAccessActive } from "../../lib/purchase-window";

describe("acesso de teste ao simulador", () => {
  it("libera somente um e-mail de teste ativo, sem tratá-lo como compra", async () => {
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn(() => query),
      limit: vi.fn(() => query),
      maybeSingle: vi.fn().mockResolvedValue({ data: { email: "marina@iamgoingtocanada.ca" }, error: null }),
    };
    const admin = { from: vi.fn(() => query) };

    await expect(hasDiagnosticFormAccessForEmail(admin as never, " MARINA@IAMGOINGTOCANADA.CA ")).resolves.toBe(true);
    expect(admin.from).toHaveBeenCalledWith("allowed_emails");
    expect(query.eq).toHaveBeenCalledWith("email", "marina@iamgoingtocanada.ca");
    expect(query.eq).toHaveBeenCalledWith("source", "test_access");
  });

  it("não considera o registro de teste como compra para entrega", () => {
    expect(isAllowedEmailAccessActive({
      active: true,
      source: "test_access",
      last_event: null,
      notes: null,
      access_product_id: null,
      access_expires_at: null,
    })).toBe(false);
  });
});
