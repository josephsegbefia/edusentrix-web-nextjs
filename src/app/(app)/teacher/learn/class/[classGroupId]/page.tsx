import { requireTeacher } from "@/lib/auth/requireTeacher";
import { TeacherLearnClassClient } from "@/components/learn/TeacherLearnClassClient";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ classGroupId: string }>;
};

export default async function TeacherLearnClassPage({ params }: PageProps) {
  await requireTeacher({ mode: "page" });
  const { classGroupId } = await params;
  return <TeacherLearnClassClient classGroupId={classGroupId} />;
}
