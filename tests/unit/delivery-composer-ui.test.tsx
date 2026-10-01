// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

const { detailFetch } = vi.hoisted(() => ({
  detailFetch: vi.fn(async (path: string) => {
    if (path.startsWith("/api/dashboard/cases/")) {
      return {
        case: { id: "case-1", case_number: "DCF-001", status: "approved" },
        client: { full_name: "Ana Silva", email_display: "ana@example.com" },
      };
    }
    if (path.startsWith("/api/diagnostics/reviews")) {
      return { review: { id: "review-1", status: "approved" } };
    }
    if (path === "/api/diagnostics/send") {
      return { delivery: { status: "sent" } };
    }
    throw new Error(`Rota inesperada: ${path}`);
  }),
}));

vi.mock("../../components/DiagnosticDetail", () => ({ detailFetch }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import { DeliveryComposer } from "../../components/DeliveryComposer";

afterEach(() => {
  cleanup();
  detailFetch.mockClear();
});

describe("entrega do diagnóstico", () => {
  it("confirma o envio integralmente em português", async () => {
    render(<DeliveryComposer caseId="case-1" />);

    fireEvent.click(await screen.findByRole("button", { name: "Confirmar e enviar" }));

    expect(await screen.findByText("Entrega enviada. O histórico foi atualizado.")).toBeVisible();
    expect(screen.queryByText(/Entrega sent/i)).toBeNull();
  });

  it("exige confirmação explícita para liberar uma entrega antecipada", async () => {
    detailFetch.mockImplementation(async (path: string) => {
      if (path.startsWith("/api/dashboard/cases/")) {
        return {
          case: { id: "case-1", case_number: "DCF-001", status: "approved" },
          client: { full_name: "Ana Silva", email_display: "ana@example.com" },
          delivery_window: {
            purchase_date: "2026-09-30T12:00:00.000Z",
            purchase_event: "PURCHASE_APPROVED",
            days_since_purchase: 1,
            days_remaining: 7,
            eligible_to_send: false,
            can_override_wait_period: true,
            message: "Envio liberado em 7 dia(s), após mais de 7 dias da compra.",
          },
        };
      }
      if (path.startsWith("/api/diagnostics/reviews")) {
        return { review: { id: "review-1", status: "approved" } };
      }
      if (path === "/api/diagnostics/send") {
        return { delivery: { status: "sent" } };
      }
      throw new Error(`Rota inesperada: ${path}`);
    });

    render(<DeliveryComposer caseId="case-1" />);

    const sendButton = await screen.findByRole("button", { name: "Confirmar e enviar" });
    expect(sendButton).toBeDisabled();

    fireEvent.click(screen.getByRole("checkbox", { name: "Liberar envio antes do prazo" }));
    expect(sendButton).toBeEnabled();

    fireEvent.click(sendButton);
    expect(await screen.findByText("Entrega enviada. O histórico foi atualizado.")).toBeVisible();
    expect(detailFetch).toHaveBeenCalledWith(
      "/api/diagnostics/send",
      expect.objectContaining({
        body: expect.stringContaining('"overrideDeliveryWait":true'),
      }),
    );
  });
});
