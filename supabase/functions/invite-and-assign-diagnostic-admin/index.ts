import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type RequestBody = { email: string };

type InviteResult = {
  user?: { id?: string } | null;
};

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Use POST" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const email = (body?.email ?? "").trim().toLowerCase();
  if (!email) {
    return new Response(JSON.stringify({ error: "Missing 'email' in body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1) Try to invite the user first.
  // Supabase Auth may reject the invite if the email/domain is not allowed.
  const { data: inviteData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email);

  if (inviteError) {
    // Fall back to an existing Auth user lookup so the consultant row can still be assigned.
    const { data: userData, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) {
      return new Response(
        JSON.stringify({
          error: "Invite failed and user lookup failed",
          inviteMessage: inviteError.message,
          lookupMessage: listError.message,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const user = userData.users.find((entry) => entry.email?.toLowerCase() === email);
    if (!user) {
      return new Response(
        JSON.stringify({
          error: "Invite failed and no auth user exists for this email",
          inviteMessage: inviteError.message,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const { data: upsertData, error: upsertError } = await supabase
      .from("diagnostic_consultants")
      .upsert(
        {
          user_id: user.id,
          role: "admin",
          active: true,
          display_name: "Marina Snyder",
          notification_email: email,
        },
        { onConflict: "user_id" },
      )
      .select("*")
      .single();

    if (upsertError) {
      return new Response(
        JSON.stringify({
          error: "Upsert failed after lookup fallback",
          message: upsertError.message,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ ok: true, inviteData: inviteData as InviteResult, data: upsertData }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const invitedUserId = (inviteData as InviteResult | null | undefined)?.user?.id;
  if (!invitedUserId) {
    return new Response(JSON.stringify({ error: "Invite succeeded but user id was not returned" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { data: upsertData, error: upsertError } = await supabase
    .from("diagnostic_consultants")
    .upsert(
      {
        user_id: invitedUserId,
        role: "admin",
        active: true,
        display_name: "Marina Snyder",
        notification_email: email,
      },
      { onConflict: "user_id" },
    )
    .select("*")
    .single();

  if (upsertError) {
    return new Response(
      JSON.stringify({
        error: "Upsert failed",
        message: upsertError.message,
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  return new Response(JSON.stringify({ ok: true, data: upsertData }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
