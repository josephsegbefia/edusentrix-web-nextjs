// src/app/(app)/teacher/layout.tsx
import { ReactNode } from "react";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import TeacherSidebar from "@/components/teacher/TeacherSidebar";
import { getSchoolSubscriptionSnapshot } from "@/lib/billing/entitlements";
import TrialBanner from "@/components/billing/TrialBanner";
import SuspendedOverlay from "@/components/billing/SuspendedOverlay";

export default async function TeacherLayout({
  children,
}: {
  children: ReactNode;
}) {
  const context = await requireTeacher({ mode: "page" });
  const snapshot = await getSchoolSubscriptionSnapshot(context.schoolId);

  if (
    snapshot &&
    (snapshot.subscription.status === "suspended" ||
      snapshot.subscription.status === "cancelled")
  ) {
    return <SuspendedOverlay status={snapshot.subscription.status} />;
  }

  return (
    <>
      {snapshot?.subscription.status === "trial" ? (
        <TrialBanner endsAt={snapshot.subscription.pilotEndsAt || null} />
      ) : null}
      <div className="flex min-h-[calc(100vh-3.5rem)]">
        <TeacherSidebar />
        <main className="flex-1 p-4 pt-16 md:pt-4 md:ml-64">{children}</main>
      </div>
    </>
  );
}
