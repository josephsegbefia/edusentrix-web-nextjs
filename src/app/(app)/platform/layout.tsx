import { ReactNode } from "react";
import { requireUser } from "@/lib/auth/get-current-user";
import { assertRole } from "@/lib/auth/guards";
import PlatformSidebar from "@/components/platform/PlatformSidebar";

export default async function PlatformLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireUser();
  assertRole(user, ["platform_admin"]);
  return (
    <div className="flex min-h-[calc(100vh-3.5rem)]">
      <PlatformSidebar />
      <main className="flex-1 p-4">{children}</main>
    </div>
  );
}
