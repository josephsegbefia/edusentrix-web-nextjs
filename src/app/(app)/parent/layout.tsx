// src/app/(app)/parent/layout.tsx
import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireUser } from "@/lib/auth/get-current-user";
import { assertRole } from "@/lib/auth/guards";
import { School } from "@/models/School";
import ParentSidebar from "@/components/nav/sidebars/parent-sidebar";
import { AuthRefreshHandler } from "@/components/auth/auth-refresh-handler";
import { getSchoolSubscriptionSnapshot } from "@/lib/billing/entitlements";
import TrialBanner from "@/components/billing/TrialBanner";
import SuspendedOverlay from "@/components/billing/SuspendedOverlay";
import { SidebarProvider } from "@/providers/sidebar-provider";
import { AdminMainContent } from "@/components/nav/sidebars/admin-main-content";

export default async function ParentLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireUser();
  assertRole(user, ["parent", "school_admin"]);
  if (user.role !== "platform_admin" && user.schoolId) {
    await connectToDatabase();
    const schoolDoc = await School.findById(user.schoolId).select("status").lean<{
      status?: string;
    } | null>();
    if (schoolDoc?.status === "deactivated") {
      redirect("/sign-in?error=school_disabled");
    }
  }
  const snapshot = user.schoolId
    ? await getSchoolSubscriptionSnapshot(user.schoolId)
    : null;

  if (
    snapshot &&
    (snapshot.subscription.status === "suspended" ||
      snapshot.subscription.status === "cancelled")
  ) {
    return <SuspendedOverlay status={snapshot.subscription.status} />;
  }

  return (
    <>
      <AuthRefreshHandler />
      {snapshot?.subscription.status === "trial" ? (
        <TrialBanner endsAt={snapshot.subscription.pilotEndsAt || null} />
      ) : null}
      <SidebarProvider>
        <div className="flex min-h-[calc(100vh-3.5rem)]">
          <ParentSidebar />
          <AdminMainContent isBursar={false}>
            {children}
          </AdminMainContent>
        </div>
      </SidebarProvider>
    </>
  );
}
