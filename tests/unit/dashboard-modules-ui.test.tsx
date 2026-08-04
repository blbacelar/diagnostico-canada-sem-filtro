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
  "/api/dashboard/settings": { account: { display_name: "Consultora Real", email: "consultora@example.com", role: "admin" }, editable: true, operation: { policy_version: "2026-08-03", methodology_version: "1.0.0", prompt_version: "2026-08-03", model: "openai/gpt-5.6-terra", form_link_days: 14, report_link_days: 30, review_sla_hours: 48, revision: 7, updated_at: "2026-08-03T10:00:00Z", app_url: "https://example.com" }, integrations: [{ key: "database", label: "Banco de dados", provider: "Supabase", configured: true, detail: "project.supabase.co" }], counts: { active_templates: 2, active_content: 2, open_cases: 1 } },
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

  it("mostra conta, integrações e parâmetros operacionais editáveis", async () => {
    mockDashboardFetch();
    render(<SettingsClient />);
    expect(await screen.findByText("Consultora Real")).toBeVisible();
    expect(screen.getByText("Supabase · project.supabase.co")).toBeVisible();
    expect(screen.getByRole("textbox", { name: /Modelo de análise/ })).toHaveValue("openai/gpt-5.6-terra");
    expect(screen.getByRole("spinbutton", { name: /Validade do relatório/ })).toHaveValue(30);
    expect(screen.getByRole("button", { name: "Salvar alterações" })).toBeDisabled();
    expect(screen.queryByText("Pronto para dados reais")).toBeNull();
  });

  it("valida e salva parâmetros com autenticação e revisão otimista", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/dashboard/settings" && init?.method === "PATCH") {
        return new Response(JSON.stringify({ operation: { ...(responses["/api/dashboard/settings"] as { operation: Record<string, unknown> }).operation, report_link_days: 45, revision: 8, updated_at: "2026-08-03T11:00:00Z", app_url: undefined } }), { status: 200 });
      }
      return new Response(JSON.stringify(responses[String(input)]), { status: responses[String(input)] ? 200 : 404 });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<SettingsClient />);

    const reportDays = await screen.findByRole("spinbutton", { name: /Validade do relatório/ });
    fireEvent.change(reportDays, { target: { value: "45" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
    expect(await screen.findByText(/Parâmetros atualizados/)).toBeVisible();
    expect(reportDays).toHaveValue(45);
    expect(screen.getByText(/Revisão 8/)).toBeVisible();

    const patchCall = fetchMock.mock.calls.find(([, init]) => init?.method === "PATCH");
    expect(patchCall).toBeDefined();
    expect(patchCall?.[1]?.headers).toMatchObject({ Authorization: "Bearer test-access-token", "Content-Type": "application/json" });
    expect(JSON.parse(String(patchCall?.[1]?.body))).toMatchObject({ report_link_days: 45, revision: 7 });
  });

  it("mostra erros de limite sem chamar a API de atualização", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      void init;
      return new Response(JSON.stringify(responses[String(input)]), { status: responses[String(input)] ? 200 : 404 });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<SettingsClient />);
    const formDays = await screen.findByRole("spinbutton", { name: /Validade do formulário/ });
    fireEvent.change(formDays, { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
    expect(await screen.findByText("O mínimo é 1 dia.")).toBeVisible();
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "PATCH")).toHaveLength(0);
  });

  it("mantém parâmetros somente leitura para consultoras sem papel administrativo", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ...(responses["/api/dashboard/settings"] as SettingsResponse), editable: false, account: { display_name: "Consultora", email: "consultora@example.com", role: "consultant" } }), { status: 200 })));
    render(<SettingsClient />);
    expect(await screen.findByText("Somente administradoras podem alterar parâmetros globais.")).toBeVisible();
    expect(screen.getByRole("textbox", { name: /Modelo de análise/ })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Salvar alterações" })).toBeNull();
  });
});

type SettingsResponse = {
  account: { display_name: string; email: string; role: string };
  editable: boolean;
  operation: Record<string, unknown>;
  integrations: unknown[];
  counts: Record<string, number>;
};
