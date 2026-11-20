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

describe("detalhe de simulador enviado", () => {
  it("abre o relatório existente e separa a criação de um novo simulador", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      case: { id: "case-sent", case_number: "CSF-2026-0001", status: "sent", objective: "Trabalhar", submitted_at: "2026-08-03T10:00:00Z", updated_at: "2026-08-03T12:00:00Z", assigned_consultant_id: "consultant-1" },
      client: { full_name: "Bruno Bacelar", email_display: "blbacelar@gmail.com" },
      answers: { age: 43 },
      assessment: null,
      review: { id: "review-1", version: 1, status: "approved", updated_at: "2026-08-03T11:00:00Z" },
      history: [],
    }), { status: 200 })));

    render(<DiagnosticDetailClient caseId="case-sent" />);

    expect(await screen.findByText("Simulador enviado")).toBeVisible();
    expect(screen.getByRole("button", { name: "Novo simulador" })).toBeEnabled();
    expect(screen.getAllByRole("link", { name: /Ver resultado enviado/ })[0]).toHaveAttribute("href", "/dashboard/diagnosticos/case-sent/relatorio");
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

  it("abre em modo de consulta quando outra consultora está editando", async () => {
    const caseDetail = {
      case: { id: "case-locked", case_number: "CSF-2026-0003", status: "approved", objective: "Trabalhar", submitted_at: "2026-08-03T10:00:00Z", updated_at: "2026-08-03T12:00:00Z", assigned_consultant_id: "consultant-2" },
      client: { full_name: "Carla Milazzo", email_display: "carla@example.com" },
      answers: { age: 43 },
      assessment: null,
      review: { id: "review-locked", version: 2, status: "approved", updated_at: "2026-08-03T11:00:00Z" },
      history: [],
    };
    const fetchMock = vi.fn().mockImplementation((path: string) => {
      if (!path.includes("readOnly=1")) {
        return Promise.resolve(new Response(JSON.stringify({ error: "Este simulador já está em revisão por outra consultora." }), { status: 423 }));
      }
      return Promise.resolve(new Response(JSON.stringify(caseDetail), { status: 200 }));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<DiagnosticDetailClient caseId="case-locked" />);

    expect(await screen.findByText(/está em edição por outra consultora/)).toBeVisible();
    expect(screen.getByRole("link", { name: "Ver parecer atual" })).toHaveAttribute("href", "/dashboard/diagnosticos/case-locked/relatorio");
    expect(screen.queryByRole("link", { name: "Editar parecer" })).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/dashboard/cases/case-locked?readOnly=1",
      expect.objectContaining({ headers: { Authorization: "Bearer test-token" } }),
    );
  });
});
