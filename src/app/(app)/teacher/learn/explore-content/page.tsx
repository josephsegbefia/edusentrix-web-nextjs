import { ExploreContentQaClient } from "@/components/learn/ExploreContentQaClient";

export default function TeacherLearnExploreContentPage() {
  return (
    <ExploreContentQaClient
      apiBase="/api/teacher/learn/explore-content"
      backHref="/teacher/learn"
      backLabel="Back to Learn"
    />
  );
}
