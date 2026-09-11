import { handleApiError, json, requireConsultant } from "../../../../../../lib/api";
import { claimCaseForReview, releaseCaseLock } from "../../../../../../lib/case-lock";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { admin, user } = await requireConsultant(request);
    const diagnosticCase = await claimCaseForReview(admin, id, user.id);
    return json({ case: diagnosticCase });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { admin, user } = await requireConsultant(request);
    const diagnosticCase = await releaseCaseLock(admin, id, user.id);
    return json({ case: diagnosticCase });
  } catch (error) {
    return handleApiError(error);
  }
}
