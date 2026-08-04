// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

vi.mock("../../lib/supabase", () => ({
  getBrowserSupabase: () => ({ auth: { getSession: async () => ({ data: { session: { access_token: "test-access-token" } } }) } }),
}));

import { AuditLogClient, ContentLibraryClient, EmailTemplatesClient, SettingsClient } from "../../components/DashboardModules";

const responses: Record<string, unknown> = {
  "/api/dashboard/content": { items: [{ id: "content-1", title: "Mapa de Cidades", description: "Compare cidades canadenses.", url: "https://example.com/mapa", tags: ["cidades", "regiões"], active: true, created_at: "2026-08-01T10:00:00Z", updated_at: "2026-08-02T10:00:00Z" }] },
  "/api/dashboard/templates": { items: [{ id: "template-1", template_key: "final_delivery", name: "Entrega final", subject: "Seu diagnóstico está pronto", body: "Olá, {{nome}}.", active: true, version: 2, created_at: "2026-08-01T10:00:00Z", updated_at: "2026-08-02T10:00:00Z" }] },
  "/api/dashboard/audit": { items: [{ id: "audit-1", case_id: "case-1", case_number: "CSF-2026-ABC123", actor_type: "consultant", action: "diagnostic.viewed", created_at: "2026-08-02T10:00:00Z" }] },
  "/api/dashboard/settings": { account: { display_name: "Consultora Real", email: "consultora@example.com", role: "admin" }, operation: { policy_version: "2026-08-03", methodology_version: "1.0.0", model: "openai/gpt-5.6-terra", form_link_days: 14, report_link_days: 30, review_sla_hours: 48, app_url: "https://example.com" }, integrations: [{ key: "database", label: "Banco de dados", provider: "Supabase", configured: true, detail: "project.supabase.co" }], counts: { active_templates: 2, active_content: 2, open_cases: 1 } },
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function mockDashboardFetch() {
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    const path = String(input);
    return new Response(JSON.stringify(responses[path]), { status: responses[path] ? 200 : 404 });
  }));
}

describe("módulos reais do menu", () => {
  it("mostra e filtra os conteúdos cadastrados", async () => {
    mockDashboardFetch();
    render(<ContentLibraryClient />);
    expect(await screen.findByText("Mapa de Cidades")).toBeVisible();
    expect(screen.getByRole("link", { name: "Abrir conteúdo" })).toHaveAttribute("href", "https://example.com/mapa");

    fireEvent.change(screen.getByRole("textbox", { name: "Buscar conteúdos" }), { target: { value: "inexistente" } });
    expect(screen.getByText("Nenhum conteúdo corresponde à busca.")).toBeVisible();
  });

  it("mostra assunto, corpo e versão dos modelos reais", async () => {
    mockDashboardFetch();
    render(<EmailTemplatesClient />);
    expect(await screen.findByText("Entrega final")).toBeVisible();
    expect(screen.getByText("Seu diagnóstico está pronto")).toBeVisible();
    expect(screen.getByText("Olá, {{nome}}.")).toBeVisible();
    expect(screen.getByText("Versão 2")).toBeVisible();
  });

  it("mostra a auditoria com ação legível e link para o caso", async () => {
    mockDashboardFetch();
    render(<AuditLogClient />);
    expect(await screen.findByText("Diagnóstico visualizado")).toBeVisible();
    expect(screen.getByRole("link", { name: "CSF-2026-ABC123" })).toHaveAttribute("href", "/dashboard/diagnosticos/case-1");
  });

  it("mostra conta, integrações e parâmetros operacionais reais", async () => {
    mockDashboardFetch();
    render(<SettingsClient />);
    expect(await screen.findByText("Consultora Real")).toBeVisible();
    expect(screen.getByText("Supabase · project.supabase.co")).toBeVisible();
    expect(screen.getByText("openai/gpt-5.6-terra")).toBeVisible();
    expect(screen.getByText("30 dias")).toBeVisible();
    expect(screen.queryByText("Pronto para dados reais")).toBeNull();
  });
});
