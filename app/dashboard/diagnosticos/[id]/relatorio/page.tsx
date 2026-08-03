import { ReportPreviewClient } from "../../../../../components/ReportPreviewClient";

export default async function ReportPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ReportPreviewClient caseId={id} />;
}
