import { ExamPaperDetailPage } from "@/components/examinations/ExamPaperDetailPage";

export default async function AdminExamPaperDetailPage({
  params,
}: {
  params: Promise<{ examPaperId: string }>;
}) {
  const { examPaperId } = await params;
  return <ExamPaperDetailPage role="admin" examPaperId={examPaperId} />;
}
