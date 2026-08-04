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
});
