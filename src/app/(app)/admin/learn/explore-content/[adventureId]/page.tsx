import { ExploreContentQaDetailClient } from "@/components/learn/ExploreContentQaDetailClient";
import { WorkspaceScope } from "@/components/theme/workspace-scope";

export default async function AdminLearnExploreContentDetailPage({
  params,
}: {
  params: Promise<{ adventureId: string }>;
}) {
  const { adventureId } = await params;

  return (
    <WorkspaceScope>
      <ExploreContentQaDetailClient
        adventureId={adventureId}
        apiBase="/api/admin/learn/explore-content"
        listHref="/admin/learn/explore-content"
        listLabel="Back to Explore list"
      />
    </WorkspaceScope>
  );
}
