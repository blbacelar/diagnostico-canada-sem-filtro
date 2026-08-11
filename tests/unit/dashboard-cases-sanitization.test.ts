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
    let countQueryCount = 0;
    let dataQueryCount = 0;

    const clientsQuery = {
      select: vi.fn(() => clientsQuery),
      or: vi.fn((value: string) => {
        clientsFilter = value;
        return clientsQuery;
      }),
      limit: vi.fn().mockResolvedValue({ data: [{ id: "client-1" }], error: null }),
    };

    const countResult = { count: 0, error: null };
    const dataResult = { data: [], error: null };
    const casesQuery = {
      select: vi.fn((_: string, options?: { head?: boolean }) => {
        countQueryCount += options?.head ? 1 : 0;
        dataQueryCount += options?.head ? 0 : 1;
        return casesQuery;
      }),
      is: vi.fn(() => casesQuery),
      order: vi.fn(() => casesQuery),
      limit: vi.fn(() => casesQuery),
      range: vi.fn(() => casesQuery),
      eq: vi.fn(() => casesQuery),
      or: vi.fn((value: string) => {
        casesFilter = value;
        return casesQuery;
      }),
      then: (resolve: (value: typeof countResult | typeof dataResult) => unknown) => Promise.resolve(resolve(countQueryCount > dataQueryCount ? countResult : dataResult)),
    };

    const from = vi.fn((table: string) => {
      if (table === "clients") return clientsQuery;
      return casesQuery;
    });

    requireConsultant.mockResolvedValue({ admin: { from }, user: { id: "consultant-1" } });
    decorateCaseLocks.mockResolvedValue([]);

    const response = await GET(new Request(`http://localhost/api/dashboard/cases?search=${encodeURIComponent(unsafeSearch)}`));
    const body = await response.json() as { items: unknown[]; pagination: { total: number; page: number; pageSize: number } };

    expect(response.status).toBe(200);
    expect(body.items).toEqual([]);
    expect(body.pagination).toMatchObject({ total: 0, page: 1, pageSize: 10 });
    expect(clientsFilter).not.toContain("%'");
    expect(clientsFilter).not.toContain(";");
    expect(casesFilter).not.toContain("%'");
    expect(casesFilter).not.toContain(";");
  });
});
