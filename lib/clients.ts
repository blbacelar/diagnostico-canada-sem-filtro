export type ClientRecord = {
  id: string;
  full_name: string;
  email_display: string;
  source: string;
  created_at: string;
  updated_at: string;
};

export type ClientCaseRecord = {
  id: string;
  client_id: string;
  case_number: string;
  status: string;
  objective: string | null;
  submitted_at: string | null;
  updated_at: string;
  archived_at: string | null;
};

export type ClientListItem = {
  id: string;
  full_name: string;
  email_display: string;
  source: string;
  created_at: string;
  last_activity_at: string;
  case_count: number;
  latest_case: Omit<ClientCaseRecord, "client_id" | "archived_at"> | null;
};

export function buildClientList(clients: ClientRecord[], cases: ClientCaseRecord[]): ClientListItem[] {
  const casesByClient = new Map<string, ClientCaseRecord[]>();

  for (const diagnosticCase of cases) {
    if (diagnosticCase.archived_at) continue;
    const existing = casesByClient.get(diagnosticCase.client_id) ?? [];
    existing.push(diagnosticCase);
    casesByClient.set(diagnosticCase.client_id, existing);
  }

  return clients
    .map((client) => {
      const clientCases = [...(casesByClient.get(client.id) ?? [])].sort(
        (left, right) => new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime(),
      );
      const latest = clientCases[0] ?? null;
      return {
        id: client.id,
        full_name: client.full_name,
        email_display: client.email_display,
        source: client.source,
        created_at: client.created_at,
        last_activity_at:
          latest && new Date(latest.updated_at) > new Date(client.updated_at)
            ? latest.updated_at
            : client.updated_at,
        case_count: clientCases.length,
        latest_case: latest
          ? {
              id: latest.id,
              case_number: latest.case_number,
              status: latest.status,
              objective: latest.objective,
              submitted_at: latest.submitted_at,
              updated_at: latest.updated_at,
            }
          : null,
      };
    })
    .sort((left, right) => new Date(right.last_activity_at).getTime() - new Date(left.last_activity_at).getTime());
}
