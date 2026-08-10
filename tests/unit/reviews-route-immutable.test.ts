import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireConsultant, claimCaseForReview } = vi.hoisted(() => ({
  requireConsultant: vi.fn(),
  claimCaseForReview: vi.fn(),
}));

vi.mock("../../lib/api", async (importOriginal) => ({
  ...await importOriginal<typeof import("../../lib/api")>(),
  requireConsultant,
}));
vi.mock("../../lib/case-lock", () => ({ claimCaseForReview }));

import { PUT } from "../../app/api/diagnostics/reviews/route";

const payload = {
  caseId: "00000000-0000-4000-8000-000000000001",
  coherentPath: "Caminho",
  assumptionsToReview: "Premissas",
  likelyMistakes: "Erros",
  immediateFocus: "Foco",
  studyStrategy: "Estratégia",
  validationRisks: "Riscos",
  nextSteps: ["Passo 1", "Passo 2", "Passo 3"],
  additionalNotes: "",
  recommendedResources: [],
  status: "draft",
};

beforeEach(() => {
  vi.clearAllMocks();
  requireConsultant.mockResolvedValue({ admin: {}, user: { id: "consultant-1" } });
});

describe("API de parecer concluído", () => {
  it.each(["sending", "archived"])("recusa alterações quando o caso está %s", async (status) => {
    claimCaseForReview.mockResolvedValue({ id: payload.caseId, status });
    const response = await PUT(new Request("http://localhost/api/diagnostics/reviews", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }));
    const body = await response.json() as { code: string };

    expect(response.status).toBe(409);
    expect(body.code).toBe("REVIEW_IMMUTABLE");
  });
});
