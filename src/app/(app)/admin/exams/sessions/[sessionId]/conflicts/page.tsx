import { ExamConflictReview } from "@/components/admin/exams/ExamConflictReview";
import { WorkspaceScope } from "@/components/theme/workspace-scope";

type PageProps = {
  params: Promise<{ sessionId: string }>;
};

export default async function ExamSessionConflictsPage({ params }: PageProps) {
  const { sessionId } = await params;
  return (
    <WorkspaceScope>
      <ExamConflictReview sessionId={sessionId} />
    </WorkspaceScope>
  );
}
