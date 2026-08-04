import { handleApiError, json, requireConsultant } from "../../../../lib/api";

export async function GET(request: Request) {
  try {
    const { admin } = await requireConsultant(request);
    const { data, error } = await admin
      .from("diagnostic_email_templates")
      .select("id,template_key,name,subject,body,active,version,created_at,updated_at")
      .order("active", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return json({ items: data ?? [] });
  } catch (error) {
    return handleApiError(error);
  }
}
