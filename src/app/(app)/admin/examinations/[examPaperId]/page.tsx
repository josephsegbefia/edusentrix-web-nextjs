import { ExamPaperDetailPage } from "@/components/examinations/ExamPaperDetailPage";
import { WorkspaceScope } from "@/components/theme/workspace-scope";

export default async function AdminExamPaperDetailPage({
  params,
}: {
  params: Promise<{ examPaperId: string }>;
}) {
  const { examPaperId } = await params;
  return (
    <WorkspaceScope>
      <ExamPaperDetailPage role="admin" examPaperId={examPaperId} />
    </WorkspaceScope>
  );
}
