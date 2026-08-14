import { describe, expect, it } from "vitest";
import { GET as getAudit } from "../../app/api/dashboard/audit/route";
import { GET as getAuditDetail } from "../../app/api/dashboard/audit/[id]/route";
import { GET as getContent } from "../../app/api/dashboard/content/route";
import { GET as getSettings, PATCH as patchSettings } from "../../app/api/dashboard/settings/route";
import { GET as getTemplates } from "../../app/api/dashboard/templates/route";

const routes = [
  ["conteúdos", getContent, "/api/dashboard/content"],
  ["modelos", getTemplates, "/api/dashboard/templates"],
  ["configurações", getSettings, "/api/dashboard/settings"],
  ["auditoria", getAudit, "/api/dashboard/audit"],
  ["detalhe da auditoria", (request: Request) => getAuditDetail(request, { params: Promise.resolve({ id: "audit-1" }) }), "/api/dashboard/audit/audit-1"],
] as const;

describe("APIs dos módulos internos", () => {
  it.each(routes)("protege %s contra acesso sem autenticação", async (_label, handler, path) => {
    const response = await handler(new Request(`http://localhost${path}`));
    const body = await response.json() as { code: string };

    expect(response.status).toBe(401);
    expect(body.code).toBe("AUTH_REQUIRED");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("protege a atualização dos parâmetros antes mesmo de validar o corpo", async () => {
    const response = await patchSettings(new Request("http://localhost/api/dashboard/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ form_link_days: 0 }),
    }));
    const body = await response.json() as { code: string };

    expect(response.status).toBe(401);
    expect(body.code).toBe("AUTH_REQUIRED");
  });
});
