import { describe, expect, it, vi } from "vitest";

const { requireConsultant, decorateCaseLocks } = vi.hoisted(() => ({
  requireConsultant: vi.fn(),
  decorateCaseLocks: vi.fn(),
}));

vi.mock("../../lib/api", async (importOriginal) => ({
  ...await importOriginal<typeof import("../../lib/api")>(),
  requireConsultant,
}));
vi.mock("../../lib/case-lock", () => ({ decorateCaseLocks }));

import { GET } from "../../app/api/dashboard/cases/route";

describe("sanitização da busca de casos", () => {
  it("remove caracteres de controle antes de montar filtros", async () => {
    const unsafeSearch = "abc%') , client_id.in.(bad) --";
    let clientsFilter = "";
    let casesFilter = "";

    const clientsQuery = {
      select: vi.fn(() => clientsQuery),
      or: vi.fn((value: string) => {
        clientsFilter = value;
        return clientsQuery;
      }),
      limit: vi.fn().mockResolvedValue({ data: [{ id: "client-1" }], error: null }),
    };

    const casesResult = { data: [], error: null };
    const casesQuery = {
      select: vi.fn(() => casesQuery),
      is: vi.fn(() => casesQuery),
      order: vi.fn(() => casesQuery),
      limit: vi.fn(() => casesQuery),
      eq: vi.fn(() => casesQuery),
      or: vi.fn((value: string) => {
        casesFilter = value;
        return casesQuery;
      }),
      then: (resolve: (value: typeof casesResult) => unknown) => Promise.resolve(resolve(casesResult)),
    };

    const from = vi.fn((table: string) => {
      if (table === "diagnostic_clients") return clientsQuery;
      return casesQuery;
    });

    requireConsultant.mockResolvedValue({ admin: { from }, user: { id: "consultant-1" } });
    decorateCaseLocks.mockResolvedValue([]);

    const response = await GET(new Request(`http://localhost/api/dashboard/cases?search=${encodeURIComponent(unsafeSearch)}`));
    const body = await response.json() as { items: unknown[] };

    expect(response.status).toBe(200);
    expect(body.items).toEqual([]);
    expect(clientsFilter).not.toContain("%'");
    expect(clientsFilter).not.toContain(";");
    expect(casesFilter).not.toContain("%'");
    expect(casesFilter).not.toContain(";");
  });
});
