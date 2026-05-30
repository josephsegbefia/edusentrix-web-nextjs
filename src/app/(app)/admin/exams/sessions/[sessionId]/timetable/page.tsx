import { ExamTimetableBuilder } from "@/components/admin/exams/ExamTimetableBuilder";

type PageProps = {
  params: Promise<{ sessionId: string }>;
};

export default async function ExamSessionTimetablePage({ params }: PageProps) {
  const { sessionId } = await params;
  return <ExamTimetableBuilder sessionId={sessionId} />;
}
