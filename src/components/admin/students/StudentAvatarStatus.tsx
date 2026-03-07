"use client";

import * as React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { StudentStatus } from "@/types/admin/student";

type StudentAvatarStatusProps = {
  fullName: string;
  photoUrl?: string | null;
  status: StudentStatus;
  size?: "sm" | "md";
};

const sizeClasses: Record<
  NonNullable<StudentAvatarStatusProps["size"]>,
  string
> = {
  sm: "h-10 w-10",
  md: "h-12 w-12",
};

const statusClasses: Record<StudentStatus, string> = {
  active: "bg-emerald-400",
  inactive: "bg-slate-400",
  withdrawn: "bg-red-400",
  graduated: "bg-sky-400",
};

export function StudentAvatarStatus({
  fullName,
  photoUrl,
  status,
  size = "md",
}: StudentAvatarStatusProps) {
  const initials = React.useMemo(() => {
    if (!fullName) return "ST";
    const parts = fullName.trim().split(/\s+/);
    const first = parts[0]?.[0].toUpperCase() ?? "";
    const second = parts[1]?.[0].toUpperCase() ?? "";
    return first + second;
  }, [fullName]);

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
