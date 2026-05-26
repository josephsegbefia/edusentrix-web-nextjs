import { requireTeacher } from "@/lib/auth/requireTeacher";
import { TeacherLearnOverviewClient } from "@/components/learn/TeacherLearnOverviewClient";

export default async function TeacherLearnPage() {
  await requireTeacher({ mode: "page" });

  return <TeacherLearnOverviewClient />;
}
