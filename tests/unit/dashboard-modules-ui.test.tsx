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
  "/api/dashboard/templates": { items: [{ id: "template-1", template_key: "final_delivery", name: "Entrega final", subject: "O resultado do seu simulador está pronto", body: "Olá, {{nome}}.", active: true, version: 2, created_at: "2026-08-01T10:00:00Z", updated_at: "2026-08-02T10:00:00Z" }] },
  "/api/dashboard/audit": { items: [
    { id: "audit-2", case_id: "case-1", case_number: "CSF-2026-ABC123", actor_type: "consultant", action: "diagnostic.viewed", created_at: "2026-08-02T10:05:00Z" },
    { id: "audit-1", case_id: "case-1", case_number: "CSF-2026-ABC123", actor_type: "consultant", action: "diagnostic.claimed", created_at: "2026-08-02T10:00:00Z" },
  ] },
  "/api/dashboard/audit/audit-2": {
    audit: { id: "audit-2", case_id: "case-1", case_number: "CSF-2026-ABC123", actor_type: "consultant", action: "diagnostic.viewed", created_at: "2026-08-02T10:05:00Z", metadata: {} },
    events: { items: [
        { id: "audit-2", case_id: "case-1", case_number: "CSF-2026-ABC123", actor_type: "consultant", action: "diagnostic.viewed", created_at: "2026-08-02T10:05:00Z", metadata: {} },
        { id: "audit-1", case_id: "case-1", case_number: "CSF-2026-ABC123", actor_type: "consultant", action: "diagnostic.claimed", created_at: "2026-08-02T10:00:00Z", metadata: {} },
      ], total: 3, offset: 0, limit: 10, has_more: true, next_offset: 2 },
    case: { id: "case-1", case_number: "CSF-2026-ABC123", status: "in_review", objective: "Trabalhar", submitted_at: "2026-08-01T10:00:00Z", updated_at: "2026-08-02T10:00:00Z" },
    client: { id: "client-1", name: "Cliente Real", email: "cliente@example.com", phone: "+55 11 99999-0000", document: null, country: "Brasil", zip_code: "01000-000", city: "São Paulo", state: "SP", address: "Rua Teste", district: "Centro", number: "123", complement: null, status_journey: "diagnostico_enviado", created_at: "2026-08-01T09:00:00Z", updated_at: "2026-08-02T10:00:00Z" },
    purchases: [{ id: "purchase-1", transaction_code: "HP123", product_name: "Diagnóstico", price_gross: 197, price_net: 169.22, status_hotmart: "PURCHASE_APPROVED", purchase_date: "2026-08-01T09:30:00Z", created_at: "2026-08-01T09:31:00Z" }],
  },
  "/api/dashboard/audit/audit-2?eventsOffset=2&eventsLimit=10": {
    audit: { id: "audit-2", case_id: "case-1", case_number: "CSF-2026-ABC123", actor_type: "consultant", action: "diagnostic.viewed", created_at: "2026-08-02T10:05:00Z", metadata: {} },
    events: { items: [
        { id: "audit-3", case_id: "case-1", case_number: "CSF-2026-ABC123", actor_type: "system", action: "ai_assessment.completed", created_at: "2026-08-02T09:55:00Z", metadata: {} },
      ], total: 3, offset: 2, limit: 10, has_more: false, next_offset: 3 },
    case: { id: "case-1", case_number: "CSF-2026-ABC123", status: "in_review", objective: "Trabalhar", submitted_at: "2026-08-01T10:00:00Z", updated_at: "2026-08-02T10:00:00Z" },
    client: { id: "client-1", name: "Cliente Real", email: "cliente@example.com", phone: "+55 11 99999-0000", document: null, country: "Brasil", zip_code: "01000-000", city: "São Paulo", state: "SP", address: "Rua Teste", district: "Centro", number: "123", complement: null, status_journey: "diagnostico_enviado", created_at: "2026-08-01T09:00:00Z", updated_at: "2026-08-02T10:00:00Z" },
    purchases: [{ id: "purchase-1", transaction_code: "HP123", product_name: "Diagnóstico", price_gross: 197, price_net: 169.22, status_hotmart: "PURCHASE_APPROVED", purchase_date: "2026-08-01T09:30:00Z", created_at: "2026-08-01T09:31:00Z" }],
  },
  "/api/dashboard/audit/audit-1": {
    audit: { id: "audit-1", case_id: "case-1", case_number: "CSF-2026-ABC123", actor_type: "consultant", action: "diagnostic.claimed", created_at: "2026-08-02T10:00:00Z", metadata: {} },
    events: { items: [{ id: "audit-1", case_id: "case-1", case_number: "CSF-2026-ABC123", actor_type: "consultant", action: "diagnostic.claimed", created_at: "2026-08-02T10:00:00Z", metadata: {} }], total: 1, offset: 0, limit: 10, has_more: false, next_offset: 1 },
    case: { id: "case-1", case_number: "CSF-2026-ABC123", status: "in_review", objective: "Trabalhar", submitted_at: "2026-08-01T10:00:00Z", updated_at: "2026-08-02T10:00:00Z" },
    client: { id: "client-1", name: "Cliente Real", email: "cliente@example.com", phone: "+55 11 99999-0000", document: null, country: "Brasil", zip_code: "01000-000", city: "São Paulo", state: "SP", address: "Rua Teste", district: "Centro", number: "123", complement: null, status_journey: "diagnostico_enviado", created_at: "2026-08-01T09:00:00Z", updated_at: "2026-08-02T10:00:00Z" },
    purchases: [{ id: "purchase-1", transaction_code: "HP123", product_name: "Diagnóstico", price_gross: 197, price_net: 169.22, status_hotmart: "PURCHASE_APPROVED", purchase_date: "2026-08-01T09:30:00Z", created_at: "2026-08-01T09:31:00Z" }],
  },
  "/api/dashboard/settings": { account: { display_name: "Consultora Real", email: "consultora@example.com", role: "admin" }, editable: true, operation: { policy_version: "2026-08-03", methodology_version: "1.0.0", prompt_version: "2026-08-03", model: "openai/gpt-5.6-terra", form_link_days: 14, report_link_days: 30, review_sla_hours: 48, revision: 7, updated_at: "2026-08-03T10:00:00Z", app_url: "https://example.com" }, integrations: [{ key: "database", label: "Banco de dados", provider: "Supabase", configured: true, detail: "project.supabase.co" }], counts: { active_templates: 2, active_content: 2, open_cases: 1 } },
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function mockDashboardFetch() {
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    const path = String(input);
    const response = responses[path] ?? responses[path.replace("?eventsLimit=10", "")];
    return new Response(JSON.stringify(response), { status: response ? 200 : 404 });
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
    expect(screen.getByText("O resultado do seu simulador está pronto")).toBeVisible();
    expect(screen.getByText("Olá, {{nome}}.")).toBeVisible();
    expect(screen.getByText("Versão 2")).toBeVisible();
  });

  it("mostra a auditoria em português e abre detalhes do cliente com transações", async () => {
    mockDashboardFetch();
    render(<AuditLogClient />);
    const auditButton = await screen.findByRole("button", { name: "Abrir detalhes: CSF-2026-ABC123" });
    expect(screen.queryByText("diagnostic · claimed")).toBeNull();
    expect(screen.getByText("CSF-2026-ABC123")).toBeVisible();
    expect(screen.getByText("2 eventos registrados")).toBeVisible();
    expect(screen.getAllByText("Simulador visualizado")).toHaveLength(1);

    fireEvent.click(auditButton);

    expect(await screen.findByText("Cliente Real")).toBeVisible();
    expect(screen.getByText("cliente@example.com")).toBeVisible();
    expect(screen.getByText("Passos registrados neste caso")).toBeVisible();
    expect(screen.getByText("2 de 3 registros carregados")).toBeVisible();
    expect(screen.getByText("Simulador assumido para revisão")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Carregar mais registros" }));
    expect(await screen.findByText("Análise estruturada concluída")).toBeVisible();
    expect(screen.getByText("3 de 3 registros carregados")).toBeVisible();
    expect(screen.getByText("Compra aprovada")).toBeVisible();
    expect(screen.getByText("HP123")).toBeVisible();
    expect(screen.getByRole("link", { name: "Abrir simulador" })).toHaveAttribute("href", "/dashboard/diagnosticos/case-1");
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
