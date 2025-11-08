// src/app/(app)/layout.tsx
import { ReactNode } from "react";
import { requireUser } from "@/lib/auth/get-current-user";
import AppTopbar from "@/components/app/AppTopbar";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser(); // SSR login gate (any role)
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Authenticated topbar (shared across app areas) */}
      <AppTopbar user={user} />
      <main className="flex-1">{children}</main>
    </div>
  );
}
