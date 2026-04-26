import { redirect } from "next/navigation";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import AdminAdmissionCyclePage from "@/app/(app)/admin/admissions/[cycleId]/page";

type Params = Promise<{ cycleId: string }>;

export default async function TeacherAdmissionCyclePage({
  params,
}: {
  params: Params;
}) {
  const ctx = await requireTeacher({ mode: "page" });
  if (!(ctx.subroles ?? []).includes("admissions_officer")) {
    redirect("/teacher");
  }
  return <AdminAdmissionCyclePage params={params} />;
}
