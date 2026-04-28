import { redirect } from "next/navigation";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { AdmissionsWorkspace } from "@/components/admissions/AdmissionsWorkspace";
import { hasAdmissionsAccess } from "@/lib/admissions/access";

export default async function TeacherAdmissionsPage() {
  const ctx = await requireTeacher({ mode: "page" });
  const allowed = await hasAdmissionsAccess({
    schoolId: ctx.schoolId,
    userId: ctx.userId,
  });
  if (!allowed) {
    redirect("/teacher");
  }
  return <AdmissionsWorkspace isAdmin={false} />;
}
