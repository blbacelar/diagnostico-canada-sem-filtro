import { describe, expect, it } from "vitest";
import { isReviewImmutable } from "../../lib/case-lifecycle";

describe("ciclo de vida do parecer", () => {
  it.each(["approved", "sending", "sent", "archived"])("protege o status %s contra edição", (status) => {
    expect(isReviewImmutable(status)).toBe(true);
  });

  it.each(["awaiting_triage", "in_review", "awaiting_client", "ready_for_approval"])("permite continuar o status %s", (status) => {
    expect(isReviewImmutable(status)).toBe(false);
  });
});
