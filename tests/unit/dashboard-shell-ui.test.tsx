// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/dashboard",
}));

vi.mock("../../lib/supabase", () => ({
  getBrowserSupabase: () => ({ auth: { getSession: () => new Promise(() => undefined) } }),
}));

import { DashboardShell } from "../../components/DashboardShell";

afterEach(() => cleanup());

describe("tema do dashboard", () => {
  it("mantém o tema do dashboard durante a confirmação de acesso", () => {
    render(<DashboardShell><p>Conteúdo do dashboard</p></DashboardShell>);

    expect(screen.getByText("Confirmando acesso profissional…").closest(".dashboard-theme")).toBeInTheDocument();
  });
});
