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
        "min-w-0 flex-1 max-w-full p-4 pt-16 md:pt-4 transition-[margin-left] duration-200 ease-in-out",
        isBursar ? "md:ml-72" : collapsed ? "md:ml-16" : "md:ml-72"
      )}
    >
      {children}
    </main>
  );
}
