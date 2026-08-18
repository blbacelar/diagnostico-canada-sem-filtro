// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

const { authorizedFetch } = vi.hoisted(() => ({ authorizedFetch: vi.fn() }));
vi.mock("../../lib/dashboard-fetch", () => ({ authorizedFetch }));

import { OverviewClient } from "../../components/DashboardData";
import { DashboardConsultantProvider } from "../../components/DashboardShell";

const summary = {
  counts: { new_cases: 0, in_review: 0, ready_to_send: 1, delivered: 1 },
  recent: [], averageHours: null, reviewSlaHours: 48,
};

function renderOverview() {
  return render(
    <DashboardConsultantProvider consultant={{ display_name: "Lopes Bacelar", role: "admin" }}>
      <OverviewClient />
    </DashboardConsultantProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("visão geral do dashboard", () => {
  it("mostra simuladores prontos para envio e já entregues", async () => {
    authorizedFetch.mockResolvedValue(summary);
    renderOverview();

    expect(screen.getByRole("heading", { name: "Bom trabalho, Lopes Bacelar." })).toBeVisible();
    expect(screen.queryByText("Bom trabalho, consultora.")).toBeNull();
    expect(await screen.findByText("Simuladores enviados")).toBeVisible();
    expect(screen.getByText("Prontos para envio")).toBeVisible();
    expect(screen.getAllByText("01")).toHaveLength(2);
    expect(screen.queryByText("Atenção técnica")).toBeNull();
  });

  it("atualiza os indicadores quando a pessoa volta para a aba", async () => {
    authorizedFetch.mockResolvedValue(summary);
    renderOverview();
    await screen.findByText("Simuladores enviados");

    window.dispatchEvent(new Event("focus"));

    await waitFor(() => expect(authorizedFetch).toHaveBeenCalledTimes(2));
  });
});
