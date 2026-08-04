import { describe, expect, it } from "vitest";
import { GET as getAudit } from "../../app/api/dashboard/audit/route";
import { GET as getContent } from "../../app/api/dashboard/content/route";
import { GET as getSettings } from "../../app/api/dashboard/settings/route";
import { GET as getTemplates } from "../../app/api/dashboard/templates/route";

const routes = [
  ["conteúdos", getContent, "/api/dashboard/content"],
  ["modelos", getTemplates, "/api/dashboard/templates"],
  ["configurações", getSettings, "/api/dashboard/settings"],
  ["auditoria", getAudit, "/api/dashboard/audit"],
] as const;

describe("APIs dos módulos internos", () => {
  it.each(routes)("protege %s contra acesso sem autenticação", async (_label, handler, path) => {
    const response = await handler(new Request(`http://localhost${path}`));
    const body = await response.json() as { code: string };

    expect(response.status).toBe(401);
    expect(body.code).toBe("AUTH_REQUIRED");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
