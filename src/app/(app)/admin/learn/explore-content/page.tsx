import { ExploreContentQaClient } from "@/components/learn/ExploreContentQaClient";

export default function AdminLearnExploreContentPage() {
  return (
    <ExploreContentQaClient
      apiBase="/api/admin/learn/explore-content"
      backHref="/admin/learn"
      backLabel="Back to Learn"
    />
  );
}
