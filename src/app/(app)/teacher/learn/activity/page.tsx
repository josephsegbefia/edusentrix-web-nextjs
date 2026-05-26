import { requireTeacher } from "@/lib/auth/requireTeacher";
import { TeacherLearnOverviewClient } from "@/components/learn/TeacherLearnOverviewClient";

export const dynamic = "force-dynamic";

export default async function TeacherLearnActivityPage() {
  await requireTeacher({ mode: "page" });
  return <TeacherLearnOverviewClient />;
}
