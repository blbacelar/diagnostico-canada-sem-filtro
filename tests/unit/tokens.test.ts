import { beforeAll, describe, expect, it } from "vitest";
import { constantTimeEqual, createFormToken, hashFormToken } from "../../lib/tokens";
beforeAll(() => { process.env.FORM_TOKEN_SECRET = "segredo-de-teste-com-mais-de-trinta-e-dois-caracteres"; });
describe("tokens de formulário", () => {
  it("gera tokens aleatórios e guarda somente hash determinístico", () => { const a=createFormToken(),b=createFormToken();expect(a).not.toBe(b);expect(hashFormToken(a)).toMatch(/^[a-f0-9]{64}$/);expect(hashFormToken(a)).not.toContain(a); });
  it("compara segredos sem atalho por conteúdo", () => { expect(constantTimeEqual("abc","abc")).toBe(true);expect(constantTimeEqual("abc","abd")).toBe(false); });
});
