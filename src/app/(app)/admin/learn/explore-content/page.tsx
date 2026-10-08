import { ExploreContentQaClient } from "@/components/learn/ExploreContentQaClient";
import { WorkspaceScope } from "@/components/theme/workspace-scope";

export default function AdminLearnExploreContentPage() {
  return (
    <WorkspaceScope>
      <ExploreContentQaClient
        apiBase="/api/admin/learn/explore-content"
        backHref="/admin/learn"
        backLabel="Back to Learn"
      />
    </WorkspaceScope>
  );
}
