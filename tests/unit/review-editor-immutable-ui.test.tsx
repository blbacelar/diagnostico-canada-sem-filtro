// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

const { detailFetch } = vi.hoisted(() => ({ detailFetch: vi.fn() }));
vi.mock("../../components/DiagnosticDetail", () => ({ detailFetch }));

import { ReviewEditor } from "../../components/ReviewEditor";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("parecer concluído", () => {
  it("não carrega nem salva um novo rascunho para diagnóstico enviado", async () => {
    detailFetch.mockResolvedValue({
      case: { id: "case-sent", case_number: "CSF-2026-0001", status: "sent" },
      client: { full_name: "Bruno Bacelar", email_display: "blbacelar@gmail.com" },
    });

    render(<ReviewEditor caseId="case-sent" />);

    expect(await screen.findByText("Este parecer está concluído")).toBeVisible();
    expect(screen.getByRole("link", { name: "Ver relatório" })).toHaveAttribute("href", "/dashboard/diagnosticos/case-sent/relatorio");
    expect(screen.queryByRole("button", { name: "Pronto para aprovação" })).toBeNull();
    await waitFor(() => expect(detailFetch).toHaveBeenCalledTimes(1));
    expect(detailFetch).not.toHaveBeenCalledWith(expect.stringContaining("/api/diagnostics/reviews"));
  });
});
