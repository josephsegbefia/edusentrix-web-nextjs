import { requireTeacher } from "@/lib/auth/requireTeacher";
import { TeacherLearnStudentClient } from "@/components/learn/TeacherLearnStudentClient";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ studentId: string }>;
};

export default async function TeacherLearnStudentPage({ params }: PageProps) {
  await requireTeacher({ mode: "page" });
  const { studentId } = await params;
  return <TeacherLearnStudentClient studentId={studentId} />;
}
