import { ReactNode } from "react";
import { requireUser } from "@/lib/auth/get-current-user";
import { assertRole } from "@/lib/auth/guards";
import PlatformSidebar from "@/components/platform/PlatformSidebar";
import { AuthRefreshHandler } from "@/components/auth/auth-refresh-handler";
import { SidebarProvider } from "@/providers/sidebar-provider";
import { AdminMainContent } from "@/components/nav/sidebars/admin-main-content";

export default async function PlatformLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireUser();
  assertRole(user, ["platform_admin"]);
  return (
    <>
      <AuthRefreshHandler />
      <SidebarProvider>
        <div className="flex min-h-[calc(100vh-3.5rem)]">
          <PlatformSidebar />
          <AdminMainContent isBursar={false}>{children}</AdminMainContent>
        </div>
      </SidebarProvider>
    </>
  );
}
