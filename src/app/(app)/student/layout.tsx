// src/app/(app)/student/layout.tsx
import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireUser } from "@/lib/auth/get-current-user";
import { assertRole } from "@/lib/auth/guards";
import { School } from "@/models/School";
import { AuthRefreshHandler } from "@/components/auth/auth-refresh-handler";
import StudentSidebar from "@/components/nav/sidebars/student-sidebar";
import { InternalTestSchoolBadge } from "@/components/internal-test/InternalTestSchoolBadge";

export default async function StudentLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireUser();
  assertRole(user, ["student"]);
  if (user.schoolId) {
    await connectToDatabase();
    const schoolDoc = await School.findById(user.schoolId).select("status").lean<{
      status?: string;
    } | null>();
    if (schoolDoc?.status === "deactivated") {
      redirect("/sign-in?error=school_disabled");
    }
  }
  return (
    <>
      <AuthRefreshHandler />
      <div className="flex min-h-[calc(100vh-3.5rem)]">
        <StudentSidebar />
        <main className="flex-1 p-4 pt-16 md:pt-4 md:ml-72">
          {user.schoolId ? (
            <div className="mb-3">
              <InternalTestSchoolBadge schoolId={String(user.schoolId)} />
            </div>
          ) : null}
          {children}
        </main>
      </div>
    </>
  );
}
