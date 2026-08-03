import { describe, expect, it } from "vitest";
import { hasDatabaseErrorCode } from "../../lib/api";

describe("database error classification", () => {
  it("recognizes PostgreSQL unique violations", () => {
    expect(hasDatabaseErrorCode({ code: "23505", message: "duplicate key" }, "23505")).toBe(true);
  });

  it.each([null, undefined, new Error("duplicate key"), { code: "23503" }, "23505"])(
    "does not misclassify %o",
    (error) => expect(hasDatabaseErrorCode(error, "23505")).toBe(false),
  );
});
