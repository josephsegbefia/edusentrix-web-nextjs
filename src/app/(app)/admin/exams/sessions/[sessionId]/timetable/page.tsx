import { ExamTimetableBuilder } from "@/components/admin/exams/ExamTimetableBuilder";
import { WorkspaceScope } from "@/components/theme/workspace-scope";

type PageProps = {
  params: Promise<{ sessionId: string }>;
};

export default async function ExamSessionTimetablePage({ params }: PageProps) {
  const { sessionId } = await params;
  return (
    <WorkspaceScope>
      <ExamTimetableBuilder sessionId={sessionId} />
    </WorkspaceScope>
  );
}
