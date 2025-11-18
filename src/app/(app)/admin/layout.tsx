// src/app/(app)/admin/layout.tsx
import { ReactNode } from "react";
import { requireUser } from "@/lib/auth/get-current-user";
import { assertRole } from "@/lib/auth/guards";
import { AuthRefreshHandler } from "@/components/auth/auth-refresh-handler";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireUser();
  assertRole(user, ["school_admin"]);
  return (
    <>
      <AuthRefreshHandler />
      <div className="p-4">{children}</div>
    </>
  );
}
