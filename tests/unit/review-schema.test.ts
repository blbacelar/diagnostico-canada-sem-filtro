import { describe, expect, it } from "vitest";
import { reviewSchema } from "../../lib/schemas";

const base = {
  caseId: "00000000-0000-4000-8000-000000000001",
  coherentPath: "Caminho",
  assumptionsToReview: "",
  likelyMistakes: "",
  immediateFocus: "",
  studyStrategy: "",
  validationRisks: "",
  additionalNotes: "",
  recommendedResources: [],
};

describe("validação do parecer", () => {
  it("aceita rascunho incompleto para que o autosave não perca o trabalho", () => {
    expect(reviewSchema.safeParse({ ...base, nextSteps: ["", "", ""], status: "draft" }).success).toBe(true);
  });

  it("exige os três próximos passos ao enviar para aprovação", () => {
    expect(reviewSchema.safeParse({ ...base, nextSteps: ["Primeiro", "", "Terceiro"], status: "ready_for_approval" }).success).toBe(false);
  });
});
