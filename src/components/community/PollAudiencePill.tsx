// src/components/community/PollAudiencePill.tsx
"use client";

import * as React from "react";
import { Users, GraduationCap, Building, User, School } from "lucide-react";
import { cn } from "@/lib/utils";
import { AudienceScope } from "@/hooks/admin/useCommunityPolls";

// ============================================================================
// Types
// ============================================================================

interface PollAudiencePillProps {
  scope: AudienceScope | string;
  gradeCount?: number;
  classCount?: number;
  className?: string;
  size?: "sm" | "md";
}

// ============================================================================
// Constants
// ============================================================================

const SCOPE_CONFIG: Record<string, { icon: React.ElementType; label: string; color: string }> = {
  school: {
    icon: School,
    label: "Entire School",
    color: "border-violet-500/30 bg-violet-500/10 text-violet-200",
  },
  parents: {
    icon: Users,
    label: "Parents Only",
    color: "border-blue-500/30 bg-blue-500/10 text-blue-200",
  },
  students: {
    icon: GraduationCap,
    label: "Students Only",
    color: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  },
  staff: {
    icon: Building,
    label: "Staff Only",
    color: "border-amber-500/30 bg-amber-500/10 text-amber-200",
  },
  grade: {
    icon: GraduationCap,
    label: "Specific Grades",
    color: "border-cyan-500/30 bg-cyan-500/10 text-cyan-200",
  },
  class: {
    icon: User,
    label: "Specific Classes",
    color: "border-pink-500/30 bg-pink-500/10 text-pink-200",
  },
};

// ============================================================================
// Main Component
// ============================================================================

export default function PollAudiencePill({
  scope,
  gradeCount,
  classCount,
  className,
  size = "md",
}: PollAudiencePillProps) {
  const config = SCOPE_CONFIG[scope] || {
    icon: Users,
    label: scope,
    color: "border-slate-500/30 bg-slate-500/10 text-slate-200",
  };

  const Icon = config.icon;

  // Build label with counts
  let label = config.label;
  if (scope === "grade" && gradeCount) {
    label = `${gradeCount} Grade${gradeCount > 1 ? "s" : ""}`;
  } else if (scope === "class" && classCount) {
    label = `${classCount} Class${classCount > 1 ? "es" : ""}`;
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium",
        config.color,
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm",
        className
      )}
    >
      <Icon className={cn(size === "sm" ? "h-3 w-3" : "h-4 w-4")} />
      {label}
    </span>
  );
}
