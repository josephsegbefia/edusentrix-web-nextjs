import { ExploreContentQaClient } from "@/components/learn/ExploreContentQaClient";

export default async function TeacherStudentExploreQaPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;

  return (
    <ExploreContentQaClient
      apiBase="/api/teacher/learn/explore-content"
      backHref={`/teacher/learn/student/${studentId}`}
      backLabel="Back to student"
      studentId={studentId}
    />
  );
}
