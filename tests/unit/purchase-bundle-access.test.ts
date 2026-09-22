import { describe, expect, it } from "vitest";
import { getPurchaseWindowForEmail, hasPurchasedAccessForEmail } from "../../lib/purchase-window";

type Purchase = {
  transaction_code: string;
  client_id: string;
  product_id: number;
  product_name: string;
  status_hotmart: string;
  purchase_date: string;
  access_expires_at: string | null;
};

function mockAdmin(purchase: Purchase) {
  const allowed = {
    email: "cliente@example.com",
    active: true,
    source: "hotmart",
    notes: null,
    last_event: "PURCHASE_APPROVED",
    last_event_at: purchase.purchase_date,
    purchase_date: purchase.purchase_date,
    external_reference: purchase.transaction_code,
    access_product_id: 8575181,
    access_expires_at: purchase.access_expires_at,
  };
  const admin = {
    from(table: string) {
      const filters: Record<string, unknown> = {};
      const query = {
        select() { return query; },
        eq(column: string, value: unknown) { filters[column] = value; return query; },
        in(column: string, values: unknown[]) { filters[column] = values; return query; },
        order() { return query; },
        limit() { return query; },
        maybeSingle() {
          return Promise.resolve({ data: table === "allowed_emails" ? allowed : { id: purchase.client_id }, error: null });
        },
        then(resolve: (value: unknown) => void) {
          const data = table === "allowed_emails"
            ? [allowed]
            : table === "purchases" && (
              (Array.isArray(filters.transaction_code)
                ? filters.transaction_code.includes(purchase.transaction_code)
                : filters.transaction_code === purchase.transaction_code) ||
              filters.client_id === purchase.client_id
            ) ? [purchase] : [];
          resolve({ data, error: null });
        },
      };
      return query;
    },
  };
  return admin as unknown as Parameters<typeof hasPurchasedAccessForEmail>[0];
}

const approvedBundle: Purchase = {
  transaction_code: "HP-BUNDLE-TEST",
  client_id: "client-test",
  product_id: 8575181,
  product_name: "Simulador + Diário de Bordo",
  status_hotmart: "PURCHASE_APPROVED",
  purchase_date: "2026-09-01T12:00:00.000Z",
  access_expires_at: "2099-09-01T12:00:00.000Z",
};

describe("acesso do simulador pelo bundle Hotmart", () => {
  it("libera início e janela de entrega com compra válida", async () => {
    const admin = mockAdmin(approvedBundle);
    expect(await hasPurchasedAccessForEmail(admin, "CLIENTE@example.com ")).toBe(true);
    expect((await getPurchaseWindowForEmail(admin, "cliente@example.com", new Date("2026-09-10T12:00:00.000Z"))).eligibleToSend).toBe(true);
  });

  it("bloqueia compra anual vencida mesmo com allowed_emails ativo", async () => {
    const admin = mockAdmin({ ...approvedBundle, access_expires_at: "2020-09-01T12:00:00.000Z" });
    expect(await hasPurchasedAccessForEmail(admin, "cliente@example.com")).toBe(false);
    expect((await getPurchaseWindowForEmail(admin, "cliente@example.com", new Date("2026-09-10T12:00:00.000Z"))).eligibleToSend).toBe(false);
  });

  it("bloqueia estorno mesmo que o registro antigo de e-mail ainda esteja ativo", async () => {
    const admin = mockAdmin({ ...approvedBundle, status_hotmart: "PURCHASE_REFUNDED", access_expires_at: null });
    expect(await hasPurchasedAccessForEmail(admin, "cliente@example.com")).toBe(false);
    expect((await getPurchaseWindowForEmail(admin, "cliente@example.com", new Date("2026-09-10T12:00:00.000Z"))).eligibleToSend).toBe(false);
  });

  it("não libera outro produto apenas por ter allowed_emails ativo", async () => {
    const admin = mockAdmin({ ...approvedBundle, product_id: 1234567, product_name: "Diário de Bordo" });
    expect(await hasPurchasedAccessForEmail(admin, "cliente@example.com")).toBe(false);
    expect((await getPurchaseWindowForEmail(admin, "cliente@example.com", new Date("2026-09-10T12:00:00.000Z"))).eligibleToSend).toBe(false);
  });
});
