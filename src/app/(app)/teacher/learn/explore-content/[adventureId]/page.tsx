import { ExploreContentQaDetailClient } from "@/components/learn/ExploreContentQaDetailClient";

export default async function TeacherLearnExploreContentDetailPage({
  params,
}: {
  params: Promise<{ adventureId: string }>;
}) {
  const { adventureId } = await params;

  return (
    <ExploreContentQaDetailClient
      adventureId={adventureId}
      apiBase="/api/teacher/learn/explore-content"
      listHref="/teacher/learn/explore-content"
      listLabel="Back to Explore list"
    />
  );
}
