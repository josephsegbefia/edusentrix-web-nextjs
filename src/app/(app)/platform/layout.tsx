import { ReactNode } from "react";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/get-current-user";
import { connectToDatabase } from "@/db/connectToDatabase";
import { User } from "@/models/User";
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
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect("/sign-in");
  await connectToDatabase();
  const actorRaw = await User.findOne({ clerkUserId: clerkId }).select("role").lean();
  const actor = Array.isArray(actorRaw) ? actorRaw[0] : actorRaw;
  if (actor?.role !== "platform_admin") {
    redirect("/dashboard");
  }
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
