import { redirect } from "next/navigation";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import AdminAdmissionCyclePage from "@/app/(app)/admin/admissions/[cycleId]/page";
import { hasAdmissionsAccess } from "@/lib/admissions/access";

type Params = Promise<{ cycleId: string }>;

export default async function TeacherAdmissionCyclePage({
  params,
}: {
  params: Params;
}) {
  const ctx = await requireTeacher({ mode: "page" });
  const allowed = await hasAdmissionsAccess({
    schoolId: ctx.schoolId,
    userId: ctx.userId,
  });
  if (!allowed) {
    redirect("/teacher");
  }
  return <AdminAdmissionCyclePage params={params} />;
}
