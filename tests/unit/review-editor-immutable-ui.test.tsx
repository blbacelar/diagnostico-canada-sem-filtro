// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

const { detailFetch, routerPush } = vi.hoisted(() => ({ detailFetch: vi.fn(), routerPush: vi.fn() }));
vi.mock("../../components/DiagnosticDetail", () => ({ detailFetch }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: routerPush }) }));

import { ReviewEditor } from "../../components/ReviewEditor";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("editor de parecer", () => {
  it("exibe somente leitura apenas quando o caso está em processo de envio ativo", async () => {
    detailFetch.mockResolvedValue({
      case: { id: "case-sending", case_number: "CSF-2026-0001", status: "sending" },
      client: { full_name: "Bruno Bacelar", email_display: "blbacelar@gmail.com" },
    });

    render(<ReviewEditor caseId="case-sending" />);

    expect(await screen.findByText("Este parecer está concluído")).toBeVisible();
    await waitFor(() => expect(detailFetch).toHaveBeenCalledTimes(1));
    expect(detailFetch).not.toHaveBeenCalledWith(expect.stringContaining("/api/diagnostics/reviews"));
  });

  it("permite editar o parecer em casos já enviados", async () => {
    detailFetch
      .mockResolvedValueOnce({
        case: { id: "case-sent", case_number: "CSF-2026-0001", status: "sent" },
        client: { full_name: "Bruno Bacelar", email_display: "blbacelar@gmail.com" },
      })
      .mockResolvedValueOnce({ review: null });

    render(<ReviewEditor caseId="case-sent" />);

    expect(await screen.findByRole("button", { name: "Pronto para aprovação" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Pré-visualizar" })).toHaveAttribute("href", "/dashboard/diagnosticos/case-sent/relatorio");
  });

  it("mantém as ações no cabeçalho fixo do editor", async () => {
    detailFetch
      .mockResolvedValueOnce({
        case: { id: "case-review", case_number: "CSF-2026-0002", status: "in_review" },
        client: { full_name: "Pessoa em análise", email_display: "cliente@example.com" },
      })
      .mockResolvedValueOnce({ review: null });

    const { container } = render(<ReviewEditor caseId="case-review" />);

    expect(await screen.findByRole("button", { name: "Pronto para aprovação" })).toBeVisible();
    expect(container.querySelector(".review-editor-header")).toBeTruthy();
    expect(container.querySelector(".review-editor-header .secondary-button")).toHaveTextContent("Pré-visualizar");
  });

  it("reidrata os campos salvos no formato do banco", async () => {
    detailFetch
      .mockResolvedValueOnce({
        case: { id: "case-review", case_number: "CSF-2026-0002", status: "in_review" },
        client: { full_name: "Pessoa em análise", email_display: "cliente@example.com" },
      })
      .mockResolvedValueOnce({
        review: {
          coherent_path: "Caminho já escrito",
          assumptions_to_review: "Premissas já escritas",
          next_steps: ["Primeiro passo", "Segundo passo", "Terceiro passo"],
          recommended_resources: ["Recurso salvo"],
        },
      });

    render(<ReviewEditor caseId="case-review" />);

    expect(await screen.findByDisplayValue("Caminho já escrito")).toBeVisible();
    expect(screen.getByDisplayValue("Premissas já escritas")).toBeVisible();
    expect(screen.getByDisplayValue("Primeiro passo")).toBeVisible();
    expect(screen.getByDisplayValue("Segundo passo")).toBeVisible();
    expect(screen.getByDisplayValue("Terceiro passo")).toBeVisible();
  });

  it("confirma visualmente o envio para aprovação", async () => {
    detailFetch.mockImplementation(async (path, init) => {
      if (init?.method === "PUT") return { review: { status: "ready_for_approval" } };
      if (path.includes("/api/diagnostics/reviews")) return { review: null };
      return {
        case: { id: "case-review", case_number: "CSF-2026-0002", status: "in_review" },
        client: { full_name: "Pessoa em análise", email_display: "cliente@example.com" },
      };
    });

    render(<ReviewEditor caseId="case-review" />);
    const button = await screen.findByRole("button", { name: "Pronto para aprovação" });
    button.click();

  expect(await screen.findByRole("status")).toHaveTextContent("Parecer salvo e enviado para aprovação.");
  expect(detailFetch).toHaveBeenCalledWith("/api/diagnostics/reviews", expect.objectContaining({ method: "PUT" }));
    expect(routerPush).toHaveBeenCalledWith("/dashboard/diagnosticos/case-review/email");
    expect(screen.queryByText("Referências da análise")).toBeNull();
  });
});
