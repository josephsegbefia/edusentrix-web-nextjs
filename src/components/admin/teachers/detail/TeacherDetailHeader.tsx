"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import { TeacherDetailAvatar } from "@/components/admin/teachers/detail/TeacherDetailAvatar";
import {
  PhoneCall,
  Mail,
  Home,
  BookOpen,
  Calendar,
  Clock3,
  Send,
} from "lucide-react";

type TeacherDetailHeaderProps = {
  teacher: {
    id: string;
    schoolId?: string;
    fullName: string;
    firstName: string;
    lastName: string;
    email?: string | null;
    phone?: string | null;
    photoUrl?: string | null;
    status: string;
    homeroom?: { id: string; name: string; gradeName?: string | null; label?: string | null } | null;
    subjects?: Array<{ id: string; name: string }>;
    assignedSubjects?: Array<{ id: string; name: string; classGroups: string[] }>;
    hireDate?: string | null;
    department?: string | null;
    leaveStartDate?: string | null;
    leaveEndDate?: string | null;
    leaveReason?: string | null;
    /** False until they accept the invite and link a Clerk login */
    hasPlatformAccount?: boolean;
  };
};

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
  const { me } = useAuth();
  const schoolId = teacher.schoolId || me?.schoolId || "";

  const {
    id,
    fullName,
    firstName,
    lastName,
    email,
    phone,
    photoUrl,
    status,
    homeroom,
    subjects,
    assignedSubjects,
    hireDate,
    department,
    leaveEndDate,
    hasPlatformAccount = true,
  } = teacher;
  const displaySubjects = (assignedSubjects?.length ? assignedSubjects : subjects) ?? [];
  const homeroomLabel = homeroom?.label || (
    homeroom?.gradeName ? `${homeroom.gradeName} ${homeroom.name}`.trim() : homeroom?.name
  );
  const invitePending = hasPlatformAccount === false;

  const statusStyle = statusConfig[status] || statusConfig.inactive;

  const hireDateLabel = React.useMemo(() => {
    if (!hireDate) return null;
    const d = new Date(hireDate);
    return d.toLocaleDateString(undefined, {
      month: "long",
      year: "numeric",
    });
  }, [hireDate]);

  const leaveCountdown = React.useMemo(() => {
    if (status !== "on_leave" || !leaveEndDate) return null;

    const endDate = new Date(leaveEndDate);
    if (Number.isNaN(endDate.getTime())) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const leaveEnd = new Date(endDate);
    leaveEnd.setHours(0, 0, 0, 0);

    const daysLeft = Math.max(
      0,
      Math.ceil((leaveEnd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    );

    const returnDate = new Date(leaveEnd);
    returnDate.setDate(returnDate.getDate() + 1);

    return {
      daysLeft,
      daysLabel:
        daysLeft === 0
          ? "Ends Today"
          : daysLeft === 1
          ? "1 Day Left"
          : `${daysLeft} Days Left`,
      returnLabel: returnDate.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
    };
  }, [status, leaveEndDate]);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
      {invitePending && (
        <div
          className="mb-6 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
          role="status"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/20">
            <Send className="h-4 w-4 text-amber-200" aria-hidden />
          </div>
          <div className="min-w-0 space-y-1">
            <p className="font-semibold text-amber-100">Invitation not accepted yet</p>
            <p className="text-xs leading-relaxed text-amber-100/85">
              This teacher does not have an official platform login until they accept the
              invitation email. You can still add details, subjects, and assignments here.
            </p>
          </div>
        </div>
      )}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        {/* Left: Avatar + Info */}
        <div className="flex flex-1 items-start gap-5">
          {schoolId ? (
            <TeacherDetailAvatar
              teacherId={id}
              schoolId={schoolId}
              firstName={firstName}
              lastName={lastName}
              fullName={fullName}
              photoUrl={photoUrl ?? null}
            />
          ) : (
            <div
              className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-gradient-to-br from-indigo-500/30 to-purple-600/30 text-xl font-semibold text-white"
              aria-hidden
            >
              {(firstName?.charAt(0) || "") + (lastName?.charAt(0) || "") || "?"}
            </div>
          )}

          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
                {fullName}
              </h2>
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium capitalize",
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
              {invitePending && (
                <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/35 bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-200">
                  Invite pending
                </span>
              )}
            </div>

            {department && (
              <p className="text-sm text-white/55">{department}</p>
            )}

            <div className="flex flex-wrap items-center gap-3">
              {homeroom && (
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-blue-500/25 bg-blue-500/10 px-2 py-1 text-xs font-medium text-blue-300">
                  <Home className="h-3.5 w-3.5" />
                  {homeroomLabel}
                </span>
              )}
              {displaySubjects.length > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-purple-500/25 bg-purple-500/10 px-2 py-1 text-xs font-medium text-purple-300">
                  <BookOpen className="h-3.5 w-3.5" />
                  {displaySubjects.length} subject{displaySubjects.length === 1 ? "" : "s"}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-4 text-sm text-white/50">
              {email && (
                <a
                  href={`mailto:${email}`}
                  className="flex items-center gap-1.5 transition-colors hover:text-white/85"
                >
                  <Mail className="h-4 w-4 shrink-0" />
                  <span className="truncate">{email}</span>
                </a>
              )}
              {phone && (
                <a
                  href={`tel:${phone}`}
                  className="flex items-center gap-1.5 transition-colors hover:text-white/85"
                >
                  <PhoneCall className="h-4 w-4 shrink-0" />
                  <span>{phone}</span>
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Right: Quick Stats */}
        <div className="flex flex-wrap gap-3 lg:flex-col lg:items-end">
          {leaveCountdown && (
            <div className="flex items-center gap-3 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/20">
                <Clock3 className="h-5 w-5 text-amber-300" />
              </div>
              <div className="text-sm">
                <p className="font-medium text-amber-200">
                  {leaveCountdown.daysLabel}
                </p>
                <p className="text-xs text-amber-200/70">
                  Returns {leaveCountdown.returnLabel}
                </p>
              </div>
            </div>
          )}
          {hireDateLabel && (
            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/15">
                <Calendar className="h-5 w-5 text-indigo-300" />
              </div>
              <div className="text-sm">
                <p className="text-xs text-white/45">Joined</p>
                <p className="font-medium text-white/90">{hireDateLabel}</p>
              </div>
            </div>
          )}
          {displaySubjects.length > 0 && (
            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/15">
                <BookOpen className="h-5 w-5 text-purple-300" />
              </div>
              <div className="text-sm">
                <p className="text-xs text-white/45">Teaching</p>
                <p className="font-medium text-white/90 line-clamp-2">
                  {displaySubjects.slice(0, 2).map((s) => s.name).join(", ")}
                  {displaySubjects.length > 2 && ` +${displaySubjects.length - 2}`}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
