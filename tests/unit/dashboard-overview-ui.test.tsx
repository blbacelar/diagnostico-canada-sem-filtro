// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

const { authorizedFetch } = vi.hoisted(() => ({ authorizedFetch: vi.fn() }));
vi.mock("../../lib/dashboard-fetch", () => ({ authorizedFetch }));

import { OverviewClient } from "../../components/DashboardData";

const summary = {
  counts: { new_cases: 0, in_review: 0, ready_to_send: 1, delivered: 1 },
  recent: [], averageHours: null, reviewSlaHours: 48,
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("visão geral do dashboard", () => {
  it("mostra diagnósticos prontos para envio e já entregues", async () => {
    authorizedFetch.mockResolvedValue(summary);
    render(<OverviewClient />);

    expect(await screen.findByText("Diagnósticos enviados")).toBeVisible();
    expect(screen.getByText("Prontos para envio")).toBeVisible();
    expect(screen.getAllByText("01")).toHaveLength(2);
    expect(screen.queryByText("Atenção técnica")).toBeNull();
  });

  it("atualiza os indicadores quando a pessoa volta para a aba", async () => {
    authorizedFetch.mockResolvedValue(summary);
    render(<OverviewClient />);
    await screen.findByText("Diagnósticos enviados");

    window.dispatchEvent(new Event("focus"));

    await waitFor(() => expect(authorizedFetch).toHaveBeenCalledTimes(2));
  });
});
