// src/app/(app)/parent/layout.tsx
import { ReactNode } from "react";
import { requireUser } from "@/lib/auth/get-current-user";
import { assertRole } from "@/lib/auth/guards";
import ParentSidebar from "@/components/nav/sidebars/parent-sidebar";
import { AuthRefreshHandler } from "@/components/auth/auth-refresh-handler";
import { getSchoolSubscriptionSnapshot } from "@/lib/billing/entitlements";
import TrialBanner from "@/components/billing/TrialBanner";
import SuspendedOverlay from "@/components/billing/SuspendedOverlay";

export default async function ParentLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireUser();
  // Allow both parent and school_admin (for testing/impersonation)
  assertRole(user, ["parent", "school_admin"]);
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
      <div className="flex min-h-[calc(100vh-3.5rem)]">
        <ParentSidebar />
        <main className="flex-1 p-4 pt-16 md:pt-4 md:ml-64">{children}</main>
      </div>
    </>
  );
}
