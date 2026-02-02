// src/app/(app)/parent/layout.tsx
import { ReactNode } from "react";
import { requireUser } from "@/lib/auth/get-current-user";
import { assertRole } from "@/lib/auth/guards";
import ParentSidebar from "@/components/nav/sidebars/parent-sidebar";
import { AuthRefreshHandler } from "@/components/auth/auth-refresh-handler";

export default async function ParentLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireUser();
  // Allow both parent and school_admin (for testing/impersonation)
  assertRole(user, ["parent", "school_admin"]);

  return (
    <>
      <AuthRefreshHandler />
      <div className="flex min-h-[calc(100vh-3.5rem)]">
        <ParentSidebar />
        <main className="flex-1 p-4 pt-16 md:pt-4 md:ml-64">{children}</main>
      </div>
    </>
  );
}
