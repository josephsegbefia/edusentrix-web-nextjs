import { ExamConflictReview } from "@/components/admin/exams/ExamConflictReview";

type PageProps = {
  params: Promise<{ sessionId: string }>;
};

export default async function ExamSessionConflictsPage({ params }: PageProps) {
  const { sessionId } = await params;
  return <ExamConflictReview sessionId={sessionId} />;
}
