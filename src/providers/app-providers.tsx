"use client";
import { AuthProvider } from "./auth-provider";
import { BusyProvider } from "./busy-provider";
import { QueryProvider } from "./query-provider";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <BusyProvider>
        <AuthProvider>{children}</AuthProvider>
      </BusyProvider>
    </QueryProvider>
  );
}
