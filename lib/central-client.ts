import { getAdminSupabase } from "./supabase";

type AdminClient = ReturnType<typeof getAdminSupabase>;

export type CentralClient = {
  id: string;
  name: string;
  email: string;
  source?: string | null;
  created_at?: string;
  updated_at?: string;
};

export function legacyClientShape(client: CentralClient | null | undefined) {
  if (!client) return null;
  return {
    id: client.id,
    full_name: client.name,
    email_normalized: client.email,
    email_display: client.email,
    source: client.source ?? "diagnostic",
    created_at: client.created_at ?? "",
    updated_at: client.updated_at ?? "",
  };
}

export function isMissingCentralClientsTable(error: { code?: string; message?: string } | null | undefined) {
  return Boolean(
    error &&
      (error.code === "PGRST205" ||
        /public\.clients|table 'public\.clients'|schema cache/i.test(error.message ?? "")),
  );
}

function fromLegacyClient(row: {
  id: string;
  full_name: string;
  email_normalized: string;
  email_display?: string | null;
  source?: string | null;
  created_at?: string;
  updated_at?: string;
}): CentralClient {
  return {
    id: row.id,
    name: row.full_name,
    email: row.email_normalized,
    source: row.source ?? "diagnostic",
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function upsertCentralClient(
  admin: AdminClient,
  input: {
    name: string;
    email: string;
    phone?: string | null;
    statusJourney?: string;
    source?: string;
  },
) {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const { data, error } = await admin
    .from("clients")
    .upsert(
      {
        name,
        email,
        ...(input.phone ? { phone: input.phone.trim() } : {}),
        ...(input.statusJourney ? { status_journey: input.statusJourney } : {}),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "email" },
    )
    .select("id,name,email,created_at,updated_at")
    .single();
  if (error && !isMissingCentralClientsTable(error)) throw error;
  if (!error) return data as CentralClient;

  const { data: legacyData, error: legacyError } = await admin
    .from("diagnostic_clients")
    .upsert(
      {
        full_name: name,
        email_normalized: email,
        email_display: email,
        source: input.source ?? "diagnostic",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "email_normalized" },
    )
    .select("id,full_name,email_normalized,email_display,source,created_at,updated_at")
    .single();
  if (legacyError) throw legacyError;
  return fromLegacyClient(legacyData);
}

export async function getCentralClientByEmail(admin: AdminClient, emailInput: string) {
  const email = emailInput.trim().toLowerCase();
  const { data, error } = await admin
    .from("clients")
    .select("id,name,email,created_at,updated_at")
    .eq("email", email)
    .limit(1)
    .maybeSingle();
  if (error && !isMissingCentralClientsTable(error)) throw error;
  if (!error) return (data as CentralClient | null) ?? null;

  const { data: legacyData, error: legacyError } = await admin
    .from("diagnostic_clients")
    .select("id,full_name,email_normalized,email_display,source,created_at,updated_at")
    .eq("email_normalized", email)
    .limit(1)
    .maybeSingle();
  if (legacyError) throw legacyError;
  return legacyData ? fromLegacyClient(legacyData) : null;
}

export async function getCentralClientById(admin: AdminClient, id: string) {
  const { data, error } = await admin
    .from("clients")
    .select("id,name,email,created_at,updated_at")
    .eq("id", id)
    .limit(1)
    .maybeSingle();
  if (error && !isMissingCentralClientsTable(error)) throw error;
  if (!error) return (data as CentralClient | null) ?? null;

  const { data: legacyData, error: legacyError } = await admin
    .from("diagnostic_clients")
    .select("id,full_name,email_normalized,email_display,source,created_at,updated_at")
    .eq("id", id)
    .limit(1)
    .maybeSingle();
  if (legacyError) throw legacyError;
  return legacyData ? fromLegacyClient(legacyData) : null;
}
