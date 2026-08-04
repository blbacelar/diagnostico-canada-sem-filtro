// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

const { authorizedFetch } = vi.hoisted(() => ({ authorizedFetch: vi.fn() }));
vi.mock("../../lib/dashboard-fetch", () => ({ authorizedFetch }));

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
    }] });

    render(<DiagnosticsListClient />);

    expect(await screen.findByText("Em revisão por Maria Consultora")).toBeVisible();
    expect(screen.queryByRole("link", { name: /Cliente Teste/ })).toBeNull();
    expect(screen.getByText("Cliente Teste").closest(".case-line")).toHaveAttribute("aria-disabled", "true");
  });
});
