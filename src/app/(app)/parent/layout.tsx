// src/app/(app)/parent/layout.tsx
import { ReactNode } from "react";
import { requireParent } from "@/lib/auth/requireParent";
import ParentSidebar from "@/components/nav/sidebars/parent-sidebar";
import { AuthRefreshHandler } from "@/components/auth/auth-refresh-handler";
import { SidebarProvider } from "@/providers/sidebar-provider";
import { AdminMainContent } from "@/components/nav/sidebars/admin-main-content";

export default async function ParentLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireParent({ mode: "page" });

  return (
    <>
      <AuthRefreshHandler />
      <SidebarProvider>
        <div className="flex min-h-[calc(100vh-3.5rem)]">
          <ParentSidebar />
          <AdminMainContent isBursar={false}>{children}</AdminMainContent>
        </div>
      </SidebarProvider>
    </>
  );
}
