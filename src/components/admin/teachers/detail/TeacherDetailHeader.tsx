"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import {
  Users,
  PhoneCall,
  Mail,
  Home,
  BookOpen,
  Calendar,
  MapPin,
  Sparkles,
} from "lucide-react";

type TeacherDetailHeaderProps = {
  teacher: {
    id: string;
    fullName: string;
    firstName: string;
    lastName: string;
    email?: string | null;
    phone?: string | null;
    photoUrl?: string | null;
    status: string;
    homeroom?: { id: string; name: string } | null;
    subjects?: Array<{ id: string; name: string }>;
    hireDate?: string | null;
    department?: string | null;
  };
};

function initialsFromName(firstName?: string, lastName?: string): string {
  const first = firstName?.charAt(0)?.toUpperCase() || "";
  const last = lastName?.charAt(0)?.toUpperCase() || "";
  return first + last || "?";
}

const statusConfig: Record<
  string,
  { bg: string; border: string; text: string; dot: string }
> = {
  active: {
    bg: "bg-emerald-500/15",
    border: "border-emerald-500/40",
    text: "text-emerald-300",
    dot: "bg-emerald-500",
  },
  inactive: {
    bg: "bg-slate-500/15",
    border: "border-slate-500/40",
    text: "text-slate-300",
    dot: "bg-slate-500",
  },
  on_leave: {
    bg: "bg-amber-500/15",
    border: "border-amber-500/40",
    text: "text-amber-300",
    dot: "bg-amber-500",
  },
  terminated: {
    bg: "bg-red-500/15",
    border: "border-red-500/40",
    text: "text-red-300",
    dot: "bg-red-500",
  },
};

export function TeacherDetailHeader({ teacher }: TeacherDetailHeaderProps) {
  const {
    fullName,
    firstName,
    lastName,
    email,
    phone,
    photoUrl,
    status,
    homeroom,
    subjects,
    hireDate,
    department,
  } = teacher;

  const statusStyle = statusConfig[status] || statusConfig.inactive;

  const hireDateLabel = React.useMemo(() => {
    if (!hireDate) return null;
    const d = new Date(hireDate);
    return d.toLocaleDateString(undefined, {
      month: "long",
      year: "numeric",
    });
  }, [hireDate]);

  return (
    <Card className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/80 via-slate-950/90 to-black shadow-2xl shadow-black/40 backdrop-blur-xl">
      {/* Background decorations */}
      <div
        className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-gradient-to-br from-indigo-500/15 via-purple-500/10 to-transparent blur-3xl transition-opacity duration-500 group-hover:opacity-100 opacity-70"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-32 -left-32 h-80 w-80 rounded-full bg-gradient-to-tr from-violet-500/10 via-fuchsia-500/5 to-transparent blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"
        aria-hidden="true"
      />

      <CardContent className="relative z-10 p-8">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
          {/* Left: Avatar + Info */}
          <div className="flex flex-1 items-start gap-6">
            {/* Avatar */}
            <div className="relative shrink-0">
              <div className="relative">
                <Avatar className="h-24 w-24 rounded-2xl border-2 border-white/20 shadow-2xl shadow-black/50 ring-4 ring-indigo-500/20">
                  {photoUrl ? (
                    <AvatarImage
                      src={photoUrl}
                      alt={fullName}
                      className="object-cover"
                    />
                  ) : null}
                  <AvatarFallback className="rounded-2xl bg-gradient-to-br from-indigo-500/40 to-purple-600/40 text-2xl font-bold text-white">
                    {initialsFromName(firstName, lastName)}
                  </AvatarFallback>
                </Avatar>

                {/* Status indicator */}
                <div
                  className={cn(
                    "absolute -bottom-1 -right-1 h-6 w-6 rounded-lg border-2 border-slate-900 flex items-center justify-center",
                    statusStyle.dot
                  )}
                >
                  <Sparkles className="h-3 w-3 text-white" />
                </div>
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 space-y-4">
              {/* Name and Status */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
                    {fullName}
                  </h1>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold capitalize",
                      statusStyle.bg,
                      statusStyle.border,
                      statusStyle.text
                    )}
                  >
                    <span
                      className={cn("h-1.5 w-1.5 rounded-full", statusStyle.dot)}
                    />
                    {status.replace("_", " ")}
                  </span>
                </div>

                {/* Department / Role */}
                {department && (
                  <p className="text-sm text-white/60">{department}</p>
                )}
              </div>

              {/* Badges */}
              <div className="flex flex-wrap items-center gap-2">
                {homeroom && (
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-blue-500/30 bg-blue-500/15 px-2.5 py-1 text-xs font-medium text-blue-300">
                    <Home className="h-3.5 w-3.5" />
                    Homeroom: {homeroom.name}
                  </span>
                )}
                {subjects && subjects.length > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-purple-500/30 bg-purple-500/15 px-2.5 py-1 text-xs font-medium text-purple-300">
                    <BookOpen className="h-3.5 w-3.5" />
                    {subjects.length} subject{subjects.length === 1 ? "" : "s"}
                  </span>
                )}
              </div>

              {/* Contact Info */}
              <div className="flex flex-wrap items-center gap-4 text-sm text-white/50">
                {email && (
                  <a
                    href={`mailto:${email}`}
                    className="flex items-center gap-1.5 transition-colors hover:text-white/80"
                  >
                    <Mail className="h-4 w-4" />
                    <span className="truncate">{email}</span>
                  </a>
                )}
                {phone && (
                  <a
                    href={`tel:${phone}`}
                    className="flex items-center gap-1.5 transition-colors hover:text-white/80"
                  >
                    <PhoneCall className="h-4 w-4" />
                    <span>{phone}</span>
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Right: Quick Stats */}
          <div className="flex flex-wrap gap-3 lg:flex-col lg:items-end">
            {hireDateLabel && (
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <Calendar className="h-4 w-4 text-indigo-400" />
                <div className="text-xs">
                  <p className="text-white/40">Joined</p>
                  <p className="font-medium text-white/80">{hireDateLabel}</p>
                </div>
              </div>
            )}
            {subjects && subjects.length > 0 && (
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <Users className="h-4 w-4 text-purple-400" />
                <div className="text-xs">
                  <p className="text-white/40">Teaching</p>
                  <p className="font-medium text-white/80">
                    {subjects.slice(0, 2).map((s) => s.name).join(", ")}
                    {subjects.length > 2 && ` +${subjects.length - 2}`}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
