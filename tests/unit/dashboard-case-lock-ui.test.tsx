// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

const { authorizedFetch } = vi.hoisted(() => ({ authorizedFetch: vi.fn() }));
vi.mock("../../lib/dashboard-fetch", () => ({ authorizedFetch }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/dashboard/diagnosticos",
}));

import { DiagnosticsListClient } from "../../components/DashboardData";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("bloqueio de diagnóstico na lista", () => {
  it("mostra a responsável e não cria link para outra consultora", async () => {
    authorizedFetch.mockResolvedValue({ items: [{
      id: "case-1",
      case_number: "CSF-2026-0001",
      status: "in_review",
      objective: "Trabalho",
      submitted_at: "2026-08-04T03:00:00Z",
      updated_at: "2026-08-04T03:00:00Z",
      assigned_consultant_id: "consultant-b",
      locked_by_other: true,
      locked_by_name: "Maria Consultora",
      diagnostic_clients: { full_name: "Cliente Teste", email_display: "cliente@example.com" },
      diagnostic_ai_assessments: [],
    }], pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1, hasNextPage: false, hasPreviousPage: false } });

    render(<DiagnosticsListClient />);

    expect(await screen.findByText("Em revisão por Maria Consultora")).toBeVisible();
    expect(screen.queryByRole("link", { name: /Cliente Teste/ })).toBeNull();
    expect(screen.getByText("Cliente Teste").closest("tr")).toHaveAttribute("aria-disabled", "true");
  });

  it("carrega a próxima página quando há mais resultados", async () => {
    authorizedFetch.mockImplementation(async (path: string) => {
      const url = new URL(path, "http://localhost");
      if (url.searchParams.get("page") === "2") {
        return {
          items: [{
            id: "case-2",
            case_number: "CSF-2026-0002",
            status: "in_review",
            objective: "Trabalho",
            submitted_at: "2026-08-04T03:00:00Z",
            updated_at: "2026-08-04T03:00:00Z",
            assigned_consultant_id: "consultant-b",
            locked_by_other: false,
            diagnostic_clients: { full_name: "Cliente Dois", email_display: "cliente2@example.com" },
            diagnostic_ai_assessments: [],
          }],
          pagination: { page: 2, pageSize: 10, total: 11, totalPages: 2, hasNextPage: false, hasPreviousPage: true },
        };
      }

      return {
        items: [{
          id: "case-1",
          case_number: "CSF-2026-0001",
          status: "in_review",
          objective: "Trabalho",
          submitted_at: "2026-08-04T03:00:00Z",
          updated_at: "2026-08-04T03:00:00Z",
          assigned_consultant_id: "consultant-b",
          locked_by_other: true,
          locked_by_name: "Maria Consultora",
          diagnostic_clients: { full_name: "Cliente Teste", email_display: "cliente@example.com" },
          diagnostic_ai_assessments: [],
        }],
        pagination: { page: 1, pageSize: 10, total: 11, totalPages: 2, hasNextPage: true, hasPreviousPage: false },
      };
    });

    render(<DiagnosticsListClient />);

    expect(await screen.findByText("Cliente Teste")).toBeVisible();
    expect(screen.getByRole("button", { name: "Próxima" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));

    expect(await screen.findByText("Cliente Dois")).toBeVisible();
    expect(screen.getByText("Página 2 de 2 · 11 itens")).toBeVisible();
  });
});
