import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ classGroupId: string; subjectId: string }>;
};

/** Legacy gradebook detail — redirects to Marks & Reports workspace (Slice 23). */
export default async function TeacherGradebookDetailPage({ params }: PageProps) {
  const { classGroupId, subjectId } = await params;
  redirect(`/teacher/marks/${classGroupId}/${subjectId}`);
}
