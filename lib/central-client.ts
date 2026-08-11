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
        ...(input.source ? { source: input.source } : {}),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "email" },
    )
    .select("id,name,email,source,created_at,updated_at")
    .single();
  if (error) throw error;
  return data as CentralClient;
}
