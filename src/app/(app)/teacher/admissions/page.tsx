import { redirect } from "next/navigation";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { AdmissionsWorkspace } from "@/components/admissions/AdmissionsWorkspace";

export default async function TeacherAdmissionsPage() {
  const ctx = await requireTeacher({ mode: "page" });
  const isAdmissionsOfficer = (ctx.subroles ?? []).includes(
    "admissions_officer"
  );
  if (!isAdmissionsOfficer) {
    redirect("/teacher");
  }
  return <AdmissionsWorkspace isAdmin={false} />;
}
