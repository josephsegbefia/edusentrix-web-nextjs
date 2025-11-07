"use client";
import { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { PageLoader } from "../loading/page-loader";

export function RoleGate({
  allow,
  children,
  redirect = "/",
}: {
  allow: Array<
    | "platform_admin"
    | "school_admin"
    | "school_admin"
    | "bursar"
    | "teacher"
    | "parent"
    | "student"
  >;
  children: ReactNode;
  redirect?: string;
}) {
  const { loading, isAuthenticated, me } = useAuth();
  const router = useRouter();

  // Normalize role for comparison (handle both school_admin and school_admin)
  const normalizeRole = (role: string) => {
    if (role === "school_admin") return "school_admin";
    return role;
  };

  useEffect(() => {
    if (!loading) {
      if (!isAuthenticated) router.replace(redirect);
      else if (me) {
        const normalizedUserRole = normalizeRole(me.role);
        const normalizedAllowedRoles = allow.map(normalizeRole);
        if (!normalizedAllowedRoles.includes(normalizedUserRole)) {
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
  if (!normalizedAllowedRoles.includes(normalizedUserRole))
    return <PageLoader />;

  return <>{children}</>;
}
