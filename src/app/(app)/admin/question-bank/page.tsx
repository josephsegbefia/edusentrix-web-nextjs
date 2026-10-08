import { ExaminationCenterPage } from "@/components/examinations/ExaminationCenterPage";
import { WorkspaceScope } from "@/components/theme/workspace-scope";

export default function AdminQuestionBankPage() {
  return (
    <WorkspaceScope>
      <ExaminationCenterPage role="admin" />
    </WorkspaceScope>
  );
}
