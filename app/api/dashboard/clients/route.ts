import { handleApiError, json, requireConsultant } from "../../../../lib/api";
import { buildClientList, type ClientCaseRecord, type ClientRecord } from "../../../../lib/clients";

const clientColumns = "id,full_name,email_display,source,created_at,updated_at";

export async function GET(request: Request) {
  try {
    const { admin } = await requireConsultant(request);
    const search = new URL(request.url).searchParams.get("search")?.trim().slice(0, 120) ?? "";
    let clients: ClientRecord[] = [];

    if (search) {
      const pattern = `%${search}%`;
      const [nameResult, emailResult] = await Promise.all([
        admin.from("diagnostic_clients").select(clientColumns).ilike("full_name", pattern).order("updated_at", { ascending: false }).limit(100),
        admin.from("diagnostic_clients").select(clientColumns).ilike("email_normalized", pattern.toLowerCase()).order("updated_at", { ascending: false }).limit(100),
      ]);
      if (nameResult.error) throw nameResult.error;
      if (emailResult.error) throw emailResult.error;
      clients = [...new Map([...(nameResult.data ?? []), ...(emailResult.data ?? [])].map((client) => [client.id, client])).values()].slice(0, 100) as ClientRecord[];
    } else {
      const result = await admin.from("diagnostic_clients").select(clientColumns).order("updated_at", { ascending: false }).limit(100);
      if (result.error) throw result.error;
      clients = (result.data ?? []) as ClientRecord[];
    }

    if (!clients.length) return json({ items: [] });

    const { data: cases, error: casesError } = await admin
      .from("diagnostic_cases")
      .select("id,client_id,case_number,status,objective,submitted_at,updated_at,archived_at")
      .in("client_id", clients.map((client) => client.id))
      .is("archived_at", null)
      .order("updated_at", { ascending: false })
      .limit(500);
    if (casesError) throw casesError;

    return json({ items: buildClientList(clients, (cases ?? []) as ClientCaseRecord[]) });
  } catch (error) {
    return handleApiError(error);
  }
}
