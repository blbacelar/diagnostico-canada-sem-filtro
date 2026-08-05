import { describe, expect, it } from "vitest";
import { buildClientList, type ClientCaseRecord, type ClientRecord } from "../../lib/clients";

const clients: ClientRecord[] = [
  { id: "client-1", full_name: "Ana Silva", email_normalized: "ana@example.com", email_display: "ana@example.com", source: "hotmart", created_at: "2026-07-01T10:00:00Z", updated_at: "2026-07-02T10:00:00Z" },
  { id: "client-2", full_name: "Bruno Souza", email_normalized: "bruno@example.com", email_display: "bruno@example.com", source: "hotmart", created_at: "2026-07-03T10:00:00Z", updated_at: "2026-07-03T10:00:00Z" },
];

const cases: ClientCaseRecord[] = [
  { id: "case-old", client_id: "client-1", case_number: "DCF-001", status: "sent", objective: "Estudo", submitted_at: "2026-07-04T10:00:00Z", updated_at: "2026-07-05T10:00:00Z", archived_at: null },
  { id: "case-latest", client_id: "client-1", case_number: "DCF-002", status: "in_review", objective: "Trabalho", submitted_at: "2026-07-07T10:00:00Z", updated_at: "2026-07-08T10:00:00Z", archived_at: null },
  { id: "case-archived", client_id: "client-1", case_number: "DCF-000", status: "archived", objective: null, submitted_at: null, updated_at: "2026-07-09T10:00:00Z", archived_at: "2026-07-09T10:00:00Z" },
];

describe("lista de clientes", () => {
  it("agrupa diagnósticos, ignora arquivados e escolhe o caso mais recente", () => {
    const result = buildClientList(clients, cases);
    const ana = result.find((item) => item.id === "client-1");

    expect(ana?.case_count).toBe(2);
    expect(ana?.latest_case).toMatchObject({ id: "case-latest", case_number: "DCF-002", status: "in_review" });
    expect(ana?.last_activity_at).toBe("2026-07-08T10:00:00Z");
  });

  it("mantém clientes sem diagnóstico e ordena pela última atividade", () => {
    const result = buildClientList(clients, cases);

    expect(result.map((item) => item.id)).toEqual(["client-1", "client-2"]);
    expect(result[1]).toMatchObject({ case_count: 0, latest_case: null, last_activity_at: "2026-07-03T10:00:00Z" });
  });

  it("não altera as coleções recebidas", () => {
    const originalCases = structuredClone(cases);
    buildClientList(clients, cases);
    expect(cases).toEqual(originalCases);
  });
});
