import { handleApiError, json, requireConsultant } from "../../../../lib/api";

export async function GET(request: Request) {
  try {
    const { admin } = await requireConsultant(request);
    const { data, error } = await admin
      .from("diagnostic_content_recommendations")
      .select("id,title,description,url,tags,active,created_at,updated_at")
      .order("active", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return json({ items: data ?? [] });
  } catch (error) {
    return handleApiError(error);
  }
}
