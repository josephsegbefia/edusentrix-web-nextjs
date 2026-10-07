"use client";

import { cn } from "@/lib/utils";
import { useSidebar } from "@/providers/sidebar-provider";

export function AdminMainContent({
  children,
  isBursar,
}: {
  children: React.ReactNode;
  isBursar: boolean;
}) {
  const { collapsed } = useSidebar();

  return (
    <main
      className={cn(
        "dark min-w-0 max-w-full flex-1 bg-background p-4 pt-16 text-foreground transition-[margin-left] duration-200 ease-in-out md:pt-4",
        isBursar ? "md:ml-72" : collapsed ? "md:ml-16" : "md:ml-72"
      )}
    >
      {children}
    </main>
  );
}
