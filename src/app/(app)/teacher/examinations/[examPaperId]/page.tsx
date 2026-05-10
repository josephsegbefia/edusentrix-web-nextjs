import { ExamPaperDetailPage } from "@/components/examinations/ExamPaperDetailPage";

export default async function TeacherExamPaperDetailPage({
  params,
}: {
  params: Promise<{ examPaperId: string }>;
}) {
  const { examPaperId } = await params;
  return <ExamPaperDetailPage role="teacher" examPaperId={examPaperId} />;
}
