// src/app/demo/(app)/layout.tsx
// Demo app layout - mirrors the real app layout but uses demo authentication

import { requireDemoUser } from "@/lib/demo/auth";
import { DemoTopbar } from "@/components/demo/DemoTopbar";
import { NetworkStatusBanner } from "@/components/system/NetworkStatusBanner";

export default async function DemoAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireDemoUser();

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground overflow-x-hidden">
      <DemoTopbar user={user} />
      {/* Network status banner - appears below topbar when offline/degraded */}
      <NetworkStatusBanner />
      <main className="flex-1 overflow-x-hidden pt-14">{children}</main>
    </div>
  );
}
