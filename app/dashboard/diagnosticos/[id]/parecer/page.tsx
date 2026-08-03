import { ReviewEditor } from "../../../../../components/ReviewEditor";
export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <ReviewEditor caseId={id} />; }
