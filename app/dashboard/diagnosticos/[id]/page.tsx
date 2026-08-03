import { DiagnosticDetailClient } from "../../../../components/DiagnosticDetail";
export default async function DiagnosticPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <DiagnosticDetailClient caseId={id} />; }
