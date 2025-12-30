// src/components/admin/teachers/TeachersQuickStatsSection.tsx
"use client";
import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Users, UserCheck, UserX, Home } from "lucide-react";
import { useTeacherStats } from "@/hooks/admin/useTeacherStats";

function StatCard({
  label,
  value,
  icon,
  tone = "neutral",
  loading,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone?: "neutral" | "info" | "success" | "danger" | "warning";
  loading?: boolean;
}) {
  const toneBorder: Record<string, string> = {
    neutral: "border-white/10",
    info: "border-blue-400/30",
    success: "border-emerald-400/30",
    danger: "border-red-400/30",
    warning: "border-amber-400/30",
  };
  const toneBg: Record<string, string> = {
    neutral: "from-white/5 via-white/0 to-transparent",
    info: "from-blue-500/5 via-blue-500/5 to-transparent",
    success: "from-emerald-500/12 via-emerald-500/5 to-transparent",
    danger: "from-red-500/12 via-red-500/5 to-transparent",
    warning: "from-amber-500/12 via-amber-500/5 to-transparent",
  };

  return (
    <Card
      className={cn(
        "relative overflow-hidden border bg-linear-to-br shadow-lg shadow-black/20 backdrop-blur",
        toneBorder[tone],
        toneBg[tone]
      )}
    >
      <CardContent className="flex items-center justify-between gap-4 p-5">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground/80">
            {label}
          </p>
          <p className="text-2xl font-bold">{loading ? "..." : value}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-muted-foreground">
          {icon}
        </div>
      </CardContent>
    </Card>
  );
}

export function TeachersQuickStatsSection() {
  const { data, isLoading } = useTeacherStats();
  const stats = data?.data;

  return (
    <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label="Total Teachers"
        value={stats ? stats.total.toLocaleString() : "0"}
        icon={<Users className="h-5 w-5" />}
        tone="info"
        loading={isLoading}
      />
      <StatCard
        label="Active Teachers"
        value={stats ? stats.active.toLocaleString() : "0"}
        icon={<UserCheck className="h-5 w-5" />}
        tone="success"
        loading={isLoading}
      />
      <StatCard
        label="Inactive"
        value={stats ? stats.inactive.toLocaleString() : "0"}
        icon={<UserX className="h-5 w-5" />}
        tone="danger"
        loading={isLoading}
      />
      <StatCard
        label="Homeroom"
        value={stats ? stats.homeroom.toLocaleString() : "0"}
        icon={<Home className="h-5 w-5" />}
        tone="warning"
        loading={isLoading}
      />
    </section>
  );
}
