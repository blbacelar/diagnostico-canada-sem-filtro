// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

vi.mock("../../lib/supabase", () => ({
  getBrowserSupabase: () => ({ auth: { getSession: async () => ({ data: { session: { access_token: "test-access-token" } } }) } }),
}));

import { ClientsListClient } from "../../components/DashboardData";

const client = {
  id: "client-1",
  full_name: "Cliente Real",
  email_display: "cliente@example.com",
  source: "hotmart",
  created_at: "2026-07-01T10:00:00Z",
  last_activity_at: "2026-08-01T10:00:00Z",
  case_count: 2,
  latest_case: { id: "case-1", case_number: "DCF-2026-001", status: "in_review", objective: "Trabalho", submitted_at: "2026-07-31T10:00:00Z", updated_at: "2026-08-01T10:00:00Z" },
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("tela de clientes", () => {
  it("mostra os dados reais e o destino do diagnóstico mais recente", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ items: [client] }), { status: 200 })));

    render(<ClientsListClient />);

    expect(await screen.findByText("Cliente Real")).toBeTruthy();
    expect(screen.getByText("cliente@example.com")).toBeTruthy();
    expect(screen.getByText("DCF-2026-001")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Cliente Real/ })).toHaveAttribute("href", "/dashboard/diagnosticos/case-1");
    expect(screen.queryByText("Pronto para dados reais")).toBeNull();
  });

  it("busca com debounce e apresenta um estado vazio específico", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ items: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<ClientsListClient />);

    fireEvent.change(screen.getByRole("textbox", { name: "Buscar clientes" }), { target: { value: "ninguém" } });

    expect(await screen.findByText("Nenhum cliente corresponde à busca.")).toBeTruthy();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/dashboard/clients?search=ningu%C3%A9m", expect.objectContaining({ signal: expect.any(AbortSignal) })));
  });
});
