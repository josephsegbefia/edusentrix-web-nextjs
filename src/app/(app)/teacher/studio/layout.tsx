import { ReactNode } from "react";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { can } from "@/lib/auth/can";
import { getTeacherStudioEnabledForSchool } from "@/lib/features/teacherStudio";
import { PERMISSIONS } from "@/lib/rbac";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function TeacherStudioLayout({
  children,
}: {
  children: ReactNode;
}) {
  const context = await requireTeacher({ mode: "page" });
  const studioEnabled = await getTeacherStudioEnabledForSchool(context.schoolId);
  const canView = can(context.permissions, PERMISSIONS.assignmentsView);

  if (!studioEnabled || !canView) {
    const title = !studioEnabled ? "Teacher Studio Disabled" : "Access Restricted";
    const description = !studioEnabled
      ? "Teacher Studio is disabled for this school. An admin can enable it in School Settings."
      : "You do not have permission to access Teacher Studio.";
    return (
      <div className="p-4">
        <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-lg text-white">{title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-white/70">
            <p>{description}</p>
            <Button asChild className="bg-indigo-500/20 text-indigo-100 hover:bg-indigo-500/30">
              <Link href="/teacher">Back to Teacher Dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
