"use client";
import { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { PageLoader } from "../loading/page-loader";
import type { AppRole } from "@/lib/roles";

export function RoleGate({
  allow,
  children,
  redirect = "/",
}: {
  allow: AppRole[];
  children: ReactNode;
  redirect?: string;
}) {
  const { loading, isAuthenticated, me } = useAuth();
  const router = useRouter();

  // Normalize role for comparison
  const normalizeRole = (role: string | undefined): string => {
    if (!role) return "";
    return role;
  };

  useEffect(() => {
    if (!loading) {
      if (!isAuthenticated) router.replace(redirect);
      else if (me) {
        const normalizedUserRole = normalizeRole(me.role);
        const normalizedAllowedRoles = allow.map(normalizeRole);
        if (!normalizedUserRole || !normalizedAllowedRoles.includes(normalizedUserRole)) {
          router.replace(redirect);
        } else if (
          me.schoolStatus === "suspended" &&
          normalizedUserRole !== "platform_admin"
        ) {
          router.replace("/suspended");
        }
      }
    }
  }, [loading, isAuthenticated, me, router, allow, redirect]);

  if (loading || !isAuthenticated || !me) return <PageLoader />;

  // Check role with normalization
  const normalizedUserRole = normalizeRole(me.role);
  const normalizedAllowedRoles = allow.map(normalizeRole);
  if (!normalizedUserRole || !normalizedAllowedRoles.includes(normalizedUserRole))
    return <PageLoader />;

  return <>{children}</>;
}
