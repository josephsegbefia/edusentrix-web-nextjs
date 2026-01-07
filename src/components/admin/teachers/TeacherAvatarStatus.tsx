"use client";

import * as React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { TeacherStatus } from "@/types/admin/teacher";

type TeacherAvatarStatusProps = {
  fullName: string;
  firstName: string;
  lastName: string;
  photoUrl?: string | null;
  status: TeacherStatus;
  size?: "sm" | "md";
};

const sizeClasses: Record<
  NonNullable<TeacherAvatarStatusProps["size"]>,
  string
> = {
  sm: "h-10 w-10",
  md: "h-12 w-12",
};

const statusClasses: Record<TeacherStatus, string> = {
  active: "bg-emerald-400",
  inactive: "bg-slate-400",
  on_leave: "bg-amber-400",
  terminated: "bg-red-400",
};

export function TeacherAvatarStatus({
  fullName,
  firstName,
  lastName,
  photoUrl,
  status,
  size = "md",
}: TeacherAvatarStatusProps) {
  const initials = React.useMemo(() => {
    const first = firstName?.charAt(0)?.toUpperCase() ?? "";
    const last = lastName?.charAt(0)?.toUpperCase() ?? "";
    return first + last || "T";
  }, [firstName, lastName]);

  return (
    <div className="relative inline-flex">
      <Avatar
        className={cn(
          sizeClasses[size],
          "border border-white/20 bg-slate-800/80 text-xs font-semibold text-slate-100 shadow-md shadow-black/40"
        )}
      >
        {photoUrl ? (
          <AvatarImage src={photoUrl} alt={fullName} />
        ) : (
          <AvatarFallback className="bg-linear-to-br from-slate-700 to-slate-900 text-[11px]">
            {initials}
          </AvatarFallback>
        )}
      </Avatar>
      <span
        className={cn(
          "absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-slate-900",
          statusClasses[status]
        )}
      />
    </div>
  );
}
