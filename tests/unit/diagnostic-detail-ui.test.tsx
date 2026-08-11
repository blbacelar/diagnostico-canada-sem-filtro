// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

const { getSession } = vi.hoisted(() => ({
  getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: "test-token" } } }),
}));

vi.mock("../../lib/supabase", () => ({
  getBrowserSupabase: () => ({ auth: { getSession } }),
}));

import { DiagnosticDetailClient } from "../../components/DiagnosticDetail";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("detalhe de diagnóstico enviado", () => {
  it("abre o relatório existente e separa a criação de um novo diagnóstico", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      case: { id: "case-sent", case_number: "CSF-2026-0001", status: "sent", objective: "Trabalhar", submitted_at: "2026-08-03T10:00:00Z", updated_at: "2026-08-03T12:00:00Z", assigned_consultant_id: "consultant-1" },
      client: { full_name: "Bruno Bacelar", email_display: "blbacelar@gmail.com" },
      answers: { age: 43 },
      assessment: null,
      review: { id: "review-1", version: 1, status: "approved", updated_at: "2026-08-03T11:00:00Z" },
      history: [],
    }), { status: 200 })));

    render(<DiagnosticDetailClient caseId="case-sent" />);

    expect(await screen.findByText("Diagnóstico enviado")).toBeVisible();
    expect(screen.getByRole("button", { name: "Novo diagnóstico" })).toBeEnabled();
    expect(screen.getAllByRole("link", { name: /Ver diagnóstico enviado/ })[0]).toHaveAttribute("href", "/dashboard/diagnosticos/case-sent/relatorio");
    expect(screen.queryByRole("link", { name: /Continuar parecer/ })).toBeNull();
    expect(screen.queryByRole("link", { name: /Pedir informações/ })).toBeNull();
  });

  it("libera a reserva do caso ao sair da tela de detalhes", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      case: { id: "case-review", case_number: "CSF-2026-0002", status: "in_review", objective: "Trabalhar", submitted_at: "2026-08-03T10:00:00Z", updated_at: "2026-08-03T12:00:00Z", assigned_consultant_id: "consultant-1" },
      client: { full_name: "Bruno Bacelar", email_display: "blbacelar@gmail.com" },
      answers: { age: 43 },
      assessment: null,
      review: null,
      history: [],
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    render(<DiagnosticDetailClient caseId="case-review" />);

    expect(await screen.findByText("Caso em análise")).toBeVisible();
    cleanup();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/dashboard/cases/case-review/lock",
        expect.objectContaining({
          method: "DELETE",
          keepalive: true,
          headers: { Authorization: "Bearer test-token" },
        }),
      );
    });
  });
});
