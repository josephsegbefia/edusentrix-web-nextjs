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
    | "schoolAdmin"
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

  useEffect(() => {
    if (!loading) {
      if (!isAuthenticated) router.replace(redirect);
      else if (me && !allow.includes(me.role)) router.replace(redirect);
      else if (me?.schoolStatus === "suspended" && me.role !== "platform_admin")
        router.replace("/suspended");
    }
  }, [loading, isAuthenticated, me, router, allow, redirect]);

  if (loading || !isAuthenticated || !me) return <PageLoader />;
  if (!allow.includes(me.role)) return <PageLoader />;

  return <>{children}</>;
}
