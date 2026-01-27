/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/(app)/admin/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Users,
  GraduationCap,
  BookOpen,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Calendar,
  UserPlus,
  School,
  FileText,
  ArrowRight,
  Clock,
  CheckCircle2,
  Bell,
  AlertCircle,
  Search,
  Mail,
  MessageSquare,
  PlusCircle,
  ClipboardList,
} from "lucide-react";

/* ------------------ NEW: hooks + modals ------------------ */
import { useAdminMetrics } from "@/hooks/admin/useAdminMetrics";
import { useAdminSSE } from "@/hooks/admin/useAdminSSE";
import { useBusyToast } from "@/hooks/useBusyToast";
import { useOnboardingProgress } from "@/hooks/admin/useOnboardingProgress";
import { useInvitationStats } from "@/hooks/admin/useInvitations";

import { ResponsiveModal } from "@/components/modals/ResponsiveModal";

import CreateStudentModal from "@/components/modals/CreateStudentModal";
import CreateTeacherModal from "@/components/modals/CreateTeacherModal";
import CreateAcademicPeriodModal from "@/components/modals/CreateAcademicPeriodModal";
import { DraftReminderModal } from "@/components/modals/DraftReminderModal";
import { format } from "date-fns/format";
import type { CreateStudentInput } from "@/schemas/student";
import type { CreateTeacherInput } from "@/schemas/teacher";
import { CreateClassGroupsModal } from "@/components/modals/CreateClassGroupsModal";
import { GHANA_BASIC_SUBJECTS } from "@/constants/ghana-basic-subjects";
import { ShimmerHighlight } from "@/components/onboarding/ShimmerHighlight";
import { OnboardingProgressIndicator } from "@/components/onboarding/OnboardingProgressIndicator";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { PeriodWarningBanner } from "@/components/dashboard/PeriodWarningBanner";
import { PeriodExpiryModal } from "@/components/dashboard/PeriodExpiryModal";
import { usePeriodStatus } from "@/hooks/admin/usePeriodStatus";

/* --------------------------------------------------------------------------------
   Helpers
-------------------------------------------------------------------------------- */

type Trend = { deltaPct: number; direction: "up" | "down" | "flat" };

function getOrdinalSuffix(day: number): string {
  if (day > 3 && day < 21) return "th";
  switch (day % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}

function formatDateLong(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "—";
  const day = d.getDate();
  const ordinal = getOrdinalSuffix(day);
  const weekday = format(d, "EEEE");
  const month = format(d, "MMMM");
  const year = format(d, "yyyy");
  return `${weekday}, ${day}${ordinal} ${month} ${year}`;
}

function termProgress(start?: string, end?: string) {
  if (!start || !end) return { pct: 0, label: "Not Set" };
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  const now = Date.now();
  if (now <= s) return { pct: 0, label: "Starts soon" };
  if (now >= e) return { pct: 100, label: "Completed" };
  const pct = Math.round(((now - s) / (e - s)) * 100);
  return { pct, label: `${pct}% complete` };
}

/* --------------------------------------------------------------------------------
   Reusable UI Blocks
-------------------------------------------------------------------------------- */

function MetricCard({
  label,
  value,
  accent,
  subtitle,
  trend,
  onClick,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  accent: string;
  subtitle?: string;
  trend?: Trend;
  onClick?: () => void;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  const TrendIcon =
    trend?.direction === "up"
      ? TrendingUp
      : trend?.direction === "down"
      ? TrendingDown
      : null;

  const trendColor =
    trend?.direction === "up"
      ? "text-emerald-300"
      : trend?.direction === "down"
      ? "text-rose-300"
      : "text-white/60";

  const Wrapper: React.ElementType = onClick ? "button" : "div";

  return (
    <Wrapper
      onClick={onClick}
      className={[
        "relative w-full overflow-hidden rounded-2xl border border-white/10",
        "bg-linear-to-br from-white/5 to-transparent p-5 lg:p-6",
        "shadow-lg shadow-black/20 backdrop-blur",
        onClick
          ? "text-left transition-transform hover:scale-[1.01] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          : "",
      ].join(" ")}
    >
      <div
        className={`pointer-events-none absolute inset-0 bg-linear-to-br ${accent}`}
        aria-hidden="true"
      />
      <div className="relative z-10 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">
            {label}
          </div>
          {Icon && (
            <Icon className="h-4 w-4 text-white/40" aria-hidden="true" />
          )}
        </div>
        <div className="text-3xl font-semibold text-white drop-shadow-sm">
          {typeof value === "number" ? value.toLocaleString() : value}
        </div>
        {(subtitle || trend) && (
          <div className="flex items-center gap-2 text-xs text-white/60">
            {trend && TrendIcon && (
              <span className={`inline-flex items-center gap-1 ${trendColor}`}>
                <TrendIcon className="h-3 w-3" />
                {Math.abs(trend.deltaPct)}%
              </span>
            )}
            {subtitle && <span>{subtitle}</span>}
          </div>
        )}
        <div className="h-[3px] w-12 rounded-full bg-white/30" />
      </div>
    </Wrapper>
  );
}

function QuickAction({
  title,
  description,
  icon: Icon,
  accent,
  href,
  onClick,
  disabled = false,
  highlighted = false,
}: {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  highlighted?: boolean;
}) {
  const Inner = (
    <div
      className={`
        group w-full text-left px-4 py-3.5 rounded-xl border transition-all duration-200
        ${
          disabled
            ? "border-white/5 bg-white/5 opacity-40 cursor-not-allowed"
            : highlighted
            ? "border-white/20 bg-white/10"
            : "border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20"
        }
      `}
    >
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg ${accent}`}>
          <Icon className="h-4 w-4 text-white/80" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-white mb-1">{title}</div>
          <div className="text-xs text-white/60">{description}</div>
        </div>
        {!disabled && (
          <ArrowRight className="h-4 w-4 text-white/40 group-hover:text-white/60 group-hover:translate-x-1 transition-all" />
        )}
      </div>
    </div>
  );

  if (disabled) {
    return (
      <div
        className="w-full cursor-not-allowed"
        title="Complete previous steps first"
      >
        {Inner}
      </div>
    );
  }

  if (href) return <Link href={href}>{Inner}</Link>;
  return (
    <button type="button" onClick={onClick} className="w-full text-left">
      {Inner}
    </button>
  );
}

/** Minimal SVG donut */
function Donut({
  segments,
  size = 120,
  stroke = 14,
}: {
  segments: { label: string; value: number; className: string }[];
  size?: number;
  stroke?: number;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;

  let offset = 0;
  const arcs = segments.map((seg, i) => {
    const frac = total ? seg.value / total : 0;
    const dash = frac * c;
    const arc = (
      <circle
        key={i}
        r={r}
        cx={size / 2}
        cy={size / 2}
        fill="transparent"
        className={seg.className}
        strokeWidth={stroke}
        strokeDasharray={`${dash} ${c - dash}`}
        strokeDashoffset={-offset}
        strokeLinecap="butt"
      />
    );
    offset += dash;
    return arc;
  });

  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} className="shrink-0">
        <circle
          r={r}
          cx={size / 2}
          cy={size / 2}
          fill="transparent"
          className="stroke-white/10"
          strokeWidth={stroke}
        />
        {total > 0 ? arcs : null}
      </svg>
      <div className="space-y-2">
        {segments.map((s, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span
              className={[
                "inline-block size-3 rounded-sm border",
                s.className.replace("stroke-", "bg-").replace("/60", "/60"),
              ].join(" ")}
            />
            <span className="text-white/70 min-w-[92px]">{s.label}</span>
            <span className="text-white/90 font-medium">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReconPill({ count }: { count: number }) {
  if (count <= 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-300">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Reconciled
      </span>
    );
  }
  return (
    <Link
      href="/admin/reconciliation"
      className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-300 hover:opacity-90"
    >
      <AlertCircle className="h-3.5 w-3.5" />
      {count} unmatched settlements
    </Link>
  );
}

/* --------------------------------------------------------------------------------
   Command Palette
-------------------------------------------------------------------------------- */

type CmdItem = { id: string; label: string; kbd?: string; onRun: () => void };
function useCommandPalette(items: CmdItem[]) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((i) => i.label.toLowerCase().includes(s));
  }, [items, q]);

  return { open, setOpen, q, setQ, filtered };
}

/* --------------------------------------------------------------------------------
   Page
-------------------------------------------------------------------------------- */

export default function SchoolAdminOverviewPage() {
  const { data: m } = useAdminMetrics();
  useAdminSSE();

  const busy = useBusyToast();

  /* Mapped metrics (keep UI) */
  const students = m?.students.total ?? 0;
  const studentsTrend: Trend = m?.students.trend ?? {
    deltaPct: 0,
    direction: "flat",
  };

  const teachers = m?.teachers.total ?? 0;
  const teachersTrend: Trend = m?.teachers.trend ?? {
    deltaPct: 0,
    direction: "flat",
  };

  const subjects = m?.subjects.total ?? 0;
  const subjectsTrend: Trend = m?.subjects.trend ?? {
    deltaPct: 0,
    direction: "flat",
  };

  const revenue = `₵${(m?.revenue.current ?? 0).toLocaleString()}`;
  const revenueTrend: Trend = m?.revenue.trend ?? {
    deltaPct: 0,
    direction: "flat",
  };

  const period = m?.period
    ? {
        yearLabel: m.period.yearLabel,
        term: m.period.term,
        startDate: formatDateLong(m.period.startDate),
        endDate: formatDateLong(m.period.endDate),
        startDateRaw: new Date(m.period.startDate).toISOString().slice(0, 10),
        endDateRaw: new Date(m.period.endDate).toISOString().slice(0, 10),
      }
    : {
        yearLabel: "—",
        term: "—",
        startDate: "",
        endDate: "",
        startDateRaw: "",
        endDateRaw: "",
      };
  const progress = termProgress(period.startDateRaw, period.endDateRaw);

  const collections = {
    collected: `₵${(m?.collections.collected ?? 0).toLocaleString()}`,
    outstanding: `₵${(m?.collections.outstanding ?? 0).toLocaleString()}`,
    rate: `${(m?.collections.rate ?? 0).toFixed(0)}%`,
  };

  const reconUnmatched = 0; // placeholder

  const overdues = {
    "0–7d": 0,
    "8–14d": 0,
    "15–30d": 0,
    "30d+": 0,
  };

  const upcomingEvents = [
    { id: 1, title: "—", when: "No events yet" },
    { id: 2, title: " ", when: " " },
    { id: 3, title: " ", when: " " },
  ];

  const suggestions = [
    {
      id: 1,
      text: "You have ₵4,200 outstanding; send a reminder?",
      actions: [
        { icon: Mail, label: "Send Email", onClick: () => {} },
        { icon: MessageSquare, label: "Send SMS", onClick: () => {} },
      ],
    },
    {
      id: 2,
      text: "Grade 6 attendance dipped 12% this week; investigate?",
      actions: [
        { icon: ClipboardList, label: "View Attendance", onClick: () => {} },
      ],
    },
  ];

  /* ---------------- NEW: Preflight for Create Class (seed grades if empty) --------------- */
  async function openCreateClassFlow() {
    try {
      // Step 1: Check and seed grades if empty
      const checkGradesRes = await fetch("/api/admin/grades?active=1", {
        cache: "no-store",
      });
      let gradeCount = 0;
      if (checkGradesRes.ok) {
        const json: any = await checkGradesRes.json().catch(() => ({}));
        const list = Array.isArray(json) ? json : json?.data;
        if (Array.isArray(list)) gradeCount = list.length;
        else if (typeof json?.total === "number") gradeCount = json.total;
      }

      if (gradeCount === 0) {
        await busy.promise(
          fetch("/api/admin/grades/seed", { method: "POST" }).then((r) => {
            if (!r.ok) throw new Error("Failed to seed grades");
          }),
          {
            loading: "Preparing default grades…",
            success: "Grades ready.",
            error: "Couldn't prepare grades",
          }
        );
      }

      // Step 2: Check school type and subjects
      const schoolRes = await fetch("/api/admin/school", { cache: "no-store" });
      let schoolType: "Basic" | "SHS" | null = null;
      if (schoolRes.ok) {
        const schoolJson: any = await schoolRes.json().catch(() => ({}));
        schoolType = schoolJson?.data?.type === "SHS" ? "SHS" : "Basic";
      }

      // Step 3: Check subjects count
      const checkSubjectsRes = await fetch("/api/admin/subjects?active=1", {
        cache: "no-store",
      });
      let subjectCount = 0;
      if (checkSubjectsRes.ok) {
        const json: any = await checkSubjectsRes.json().catch(() => ({}));
        const list = Array.isArray(json) ? json : json?.data;
        if (Array.isArray(list)) subjectCount = list.length;
        else if (typeof json?.total === "number") subjectCount = json.total;
      }

      // Step 4: Auto-create subjects for Basic schools if none exist
      if (subjectCount === 0 && schoolType === "Basic") {
        await busy.promise(
          fetch("/api/admin/subjects/bulk", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ names: GHANA_BASIC_SUBJECTS }),
          }).then(async (r) => {
            if (!r.ok) {
              const errorText = await r.text();
              throw new Error(errorText || "Failed to create subjects");
            }
          }),
          {
            loading: "Creating default subjects for Basic school…",
            success: "Subjects created successfully.",
            error: "Couldn't create subjects",
          }
        );
      }

      setShowCreateClass(true);
    } catch (e: any) {
      busy.error(e?.message || "Couldn't prepare class creation");
    }
  }

  const cmdItems: CmdItem[] = [
    {
      id: "search",
      label: "Search (students, teachers, classes)",
      kbd: "⌘K",
      onRun: () => {},
    },
    {
      id: "create-student",
      label: "Create Student",
      onRun: () => setShowCreateStudent(true),
    },
    {
      id: "add-class",
      label: "Add Class",
      onRun: openCreateClassFlow, // <-- use preflight
    },
    { id: "add-fee", label: "Add Fee", onRun: () => {} },
    {
      id: "send-reminder",
      label: "Send Fee Reminder",
      onRun: () => setShowReminder("email"),
    },
    { id: "create-event", label: "Create Event", onRun: () => {} },
    { id: "reports", label: "Generate Simple Report", onRun: () => {} },
  ];
  const palette = useCommandPalette(cmdItems);

  /* Onboarding progress */
  const onboarding = useOnboardingProgress();

  /* Invitation stats */
  const { data: invitationStats } = useInvitationStats();

  /* Quick action modal state */
  const [showReminder, setShowReminder] = useState<null | "email" | "sms">(
    null
  );
  const [showCreateClass, setShowCreateClass] = useState(false);
  const [showCreateStudent, setShowCreateStudent] = useState(false);
  const [showCreateTeacher, setShowCreateTeacher] = useState(false);

  /* Academic period modal state */
  const [showCreatePeriod, setShowCreatePeriod] = useState(false);
  const [showPeriodExpiryModal, setShowPeriodExpiryModal] = useState(false);
  const [creatingPeriod, setCreatingPeriod] = useState(false);

  /* Period status for warnings */
  const { data: periodStatus } = usePeriodStatus();

  /* Auto-show period expiry modal for critical statuses */
  React.useEffect(() => {
    if (
      periodStatus &&
      (periodStatus.status === "no_period" ||
        periodStatus.status === "expired" ||
        periodStatus.status === "expiring_critical")
    ) {
      // Small delay to let the page load first
      const timer = setTimeout(() => {
        setShowPeriodExpiryModal(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [periodStatus?.status]);

  /* Student create busy state */
  const [creatingStudent, setCreatingStudent] = useState(false);
  const [creatingTeacher, setCreatingTeacher] = useState(false);

  const donutSegments = [
    {
      label: "0–7 days",
      value: overdues["0–7d"],
      className: "stroke-amber-300/80",
    },
    {
      label: "8–14 days",
      value: overdues["8–14d"],
      className: "stroke-orange-300/80",
    },
    {
      label: "15–30 days",
      value: overdues["15–30d"],
      className: "stroke-rose-300/80",
    },
    {
      label: "30+ days",
      value: overdues["30d+"],
      className: "stroke-red-400/80",
    },
  ];
  const overdueTotal = donutSegments.reduce((s, x) => s + x.value, 0);

  async function handleCreatePeriod(payload: {
    yearLabel: string;
    term: string;
    startDate: string;
    endDate: string;
  }) {
    if (!payload.yearLabel || !payload.term || !payload.startDate || !payload.endDate) {
      busy.error("Please fill all fields");
      throw new Error("Missing academic period fields");
    }
    setCreatingPeriod(true);
    try {
      const fetchPromise = fetch("/api/periods/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          yearLabel: payload.yearLabel.trim(),
          term: payload.term.trim(),
          startDate: payload.startDate,
          endDate: payload.endDate,
        }),
      }).then(async (res) => {
        if (!res.ok) {
          const msg = await res.text();
          throw new Error(msg || "Failed to create period");
        }
        return res;
      });
      await busy.promise(fetchPromise, {
        loading: "Creating academic period…",
        success: "Academic period created",
        error: "Could not create period",
      });
      // SSE will push period.updated
    } finally {
      setCreatingPeriod(false);
    }
  }

  async function handleCreateTeacher(payload: CreateTeacherInput) {
    setCreatingTeacher(true);
    try {
      // Log payload for debugging
      console.log("Creating teacher with payload:", payload);

      const fetchPromise = fetch("/api/admin/teachers/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).then(async (res) => {
        if (!res.ok) {
          let errorMsg = "Failed to add teacher";
          try {
            const errorData = await res.json();
            errorMsg = errorData.error || errorMsg;
            console.error("Teacher creation API error:", {
              status: res.status,
              error: errorData,
              payload,
            });
            if (errorData.details) {
              const details = Object.entries(errorData.details)
                .filter(([, missing]) => missing)
                .map(([field]) => field)
                .join(", ");
              if (details) {
                errorMsg += `: Missing ${details}`;
              }
            }
          } catch {
            const text = await res.text();
            errorMsg = text || errorMsg;
            console.error("Teacher creation error (non-JSON):", {
              status: res.status,
              text,
              payload,
            });
          }
          throw new Error(errorMsg);
        }
        return res;
      });
      await busy.promise(fetchPromise, {
        loading: "Adding teacher…",
        success: "Teacher added successfully",
        error: "Could not add teacher",
      });
      setShowCreateTeacher(false);
    } catch (e: unknown) {
      throw e;
    } finally {
      setCreatingTeacher(false);
    }
  }

  async function handleCreateStudent(payload: CreateStudentInput) {
    setCreatingStudent(true);
    try {
      const apiPayload = {
        ...payload,
        dateOfBirth: payload.dateOfBirth
          ? payload.dateOfBirth.toISOString().split("T")[0]
          : undefined,
      };

      const fetchPromise = fetch("/api/students/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(apiPayload),
      }).then(async (res) => {
        if (!res.ok) {
          const msg = await res.text();
          throw new Error(msg || "Failed to add student");
        }
        return res;
      });
      await busy.promise(fetchPromise, {
        loading: "Adding student…",
        success: "Student added",
        error: "Could not add student",
      });
      setShowCreateStudent(false);
      // SSE pushes students.updated
    } catch (e: unknown) {
      // Error is already handled by busy.promise toast
      // Re-throw so the modal can handle it (won't close on error)
      throw e;
    } finally {
      setCreatingStudent(false);
    }
  }

  // Persistent onboarding toast notifications
  const [toastId, setToastId] = React.useState<string | number | null>(null);

  React.useEffect(() => {
    // Don't show toasts until data has loaded
    if (onboarding.isLoading) {
      return;
    }

    // Dismiss previous toast if exists
    if (toastId !== null) {
      busy.dismiss(toastId);
    }

    // Only show toast if onboarding is not complete
    if (onboarding.step === "complete") {
      return;
    }

    let newToastId: string | number | null = null;
    if (onboarding.step === "academic_period") {
      newToastId = busy.toast(
        "Welcome! Start by creating your academic period",
        {
          description: "This sets up your school's term and academic year.",
          duration: Infinity, // Persistent until action taken
        }
      );
    } else if (onboarding.step === "class_groups") {
      newToastId = busy.toast("Great! Now create your first class group", {
        description: "Set up classes for your grades to organize students.",
        duration: Infinity,
      });
    } else if (onboarding.step === "teachers") {
      newToastId = busy.toast("Excellent! Add your first teacher", {
        description: "Assign subjects and homeroom classes to teachers.",
        duration: Infinity,
      });
    } else if (onboarding.step === "students") {
      newToastId = busy.toast("Almost there! Add your first student", {
        description: "Enroll students and assign them to classes.",
        duration: Infinity,
      });
    }

    setToastId(newToastId);

    // Cleanup on unmount
    return () => {
      if (newToastId !== null) {
        busy.dismiss(newToastId);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onboarding.step, onboarding.isLoading]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
          <p className="text-muted">
            Welcome back! Here&apos;s an overview of your school.
          </p>
        </div>
        <div className="pt-1">
          <ReconPill count={reconUnmatched} />
        </div>
      </div>

      {/* Period Warning Banner */}
      <PeriodWarningBanner
        onCreatePeriod={() => setShowCreatePeriod(true)}
      />

      {/* Onboarding Progress Indicator */}
      {!onboarding.isLoading && onboarding.step !== "complete" && (
        <OnboardingProgressIndicator
          currentStep={onboarding.step}
          progressPercentage={onboarding.progressPercentage}
        />
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Total Students"
          value={students}
          accent="from-blue-500/25 via-blue-500/10 to-transparent"
          subtitle="Vs previous period"
          trend={studentsTrend}
          icon={GraduationCap}
        />
        <MetricCard
          label="Teachers"
          value={teachers}
          accent="from-purple-500/25 via-purple-500/10 to-transparent"
          subtitle="Active staff members"
          trend={teachersTrend}
          icon={Users}
        />
        <MetricCard
          label="Subjects"
          value={subjects}
          accent="from-emerald-500/25 via-emerald-500/10 to-transparent"
          subtitle="Active subjects"
          trend={subjectsTrend}
          icon={BookOpen}
        />
        <MetricCard
          label="Revenue"
          value={revenue}
          accent="from-amber-500/25 via-amber-500/10 to-transparent"
          subtitle="This academic period"
          trend={revenueTrend}
          icon={DollarSign}
        />
      </div>

      {/* Enhanced Quick Stats */}
      {invitationStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
            <div
              className="pointer-events-none absolute inset-0 bg-linear-to-br from-violet-500/15 via-violet-500/5 to-transparent"
              aria-hidden="true"
            />
            <CardContent className="relative z-10 p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-violet-500/20 border border-violet-500/30">
                  <Mail className="h-4 w-4 text-violet-300" />
                </div>
                <div className="text-xs text-white/60 uppercase tracking-wider">
                  Pending Invitations
                </div>
              </div>
              <div className="text-2xl font-bold text-amber-300">
                {invitationStats.pending}
              </div>
              <div className="text-xs text-white/50 mt-1">
                {invitationStats.total} total sent
              </div>
            </CardContent>
          </Card>
          <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
            <div
              className="pointer-events-none absolute inset-0 bg-linear-to-br from-emerald-500/15 via-emerald-500/5 to-transparent"
              aria-hidden="true"
            />
            <CardContent className="relative z-10 p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-emerald-500/20 border border-emerald-500/30">
                  <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                </div>
                <div className="text-xs text-white/60 uppercase tracking-wider">
                  Acceptance Rate
                </div>
              </div>
              <div className="text-2xl font-bold text-emerald-300">
                {invitationStats.total > 0
                  ? `${Math.round(
                      (invitationStats.accepted / invitationStats.total) * 100
                    )}%`
                  : "—"}
              </div>
              <div className="text-xs text-white/50 mt-1">
                {invitationStats.accepted} accepted
              </div>
            </CardContent>
          </Card>
          <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
            <div
              className="pointer-events-none absolute inset-0 bg-linear-to-br from-orange-500/15 via-orange-500/5 to-transparent"
              aria-hidden="true"
            />
            <CardContent className="relative z-10 p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-orange-500/20 border border-orange-500/30">
                  <Users className="h-4 w-4 text-orange-300" />
                </div>
                <div className="text-xs text-white/60 uppercase tracking-wider">
                  Student/Teacher Ratio
                </div>
              </div>
              <div className="text-2xl font-bold text-white">
                {teachers > 0 && students > 0
                  ? `1:${Math.round(students / teachers)}`
                  : "—"}
              </div>
              <div className="text-xs text-white/50 mt-1">
                Students per teacher
              </div>
            </CardContent>
          </Card>
          <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
            <div
              className="pointer-events-none absolute inset-0 bg-linear-to-br from-cyan-500/15 via-cyan-500/5 to-transparent"
              aria-hidden="true"
            />
            <CardContent className="relative z-10 p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-cyan-500/20 border border-cyan-500/30">
                  <School className="h-4 w-4 text-cyan-300" />
                </div>
                <div className="text-xs text-white/60 uppercase tracking-wider">
                  Class Groups
                </div>
              </div>
              <div className="text-2xl font-bold text-white">
                {onboarding.hasClassGroups ? "Active" : "—"}
              </div>
              <div className="text-xs text-white/50 mt-1">
                {onboarding.hasClassGroups
                  ? "Classes configured"
                  : "Setup required"}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Primary row: Quick Actions + Academic Period */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Actions */}
        <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <div
            className="pointer-events-none absolute inset-0 bg-linear-to-br from-indigo-500/20 via-indigo-500/5 to-transparent"
            aria-hidden="true"
          />
          <CardHeader className="relative z-10">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <div className="p-2 rounded-lg bg-indigo-500/20 border border-indigo-500/30">
                <FileText className="h-4 w-4 text-indigo-400" />
              </div>
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="relative z-10 space-y-3">
            <QuickAction
              title="Draft Fee Reminder (Email)"
              description="Send a reminder to guardians with outstanding balances"
              icon={Mail}
              accent="bg-blue-500/20 border-blue-500/30"
              onClick={() => setShowReminder("email")}
              disabled={!onboarding.isActionEnabled("other")}
            />
            <QuickAction
              title="Draft Fee Reminder (SMS)"
              description="Send a quick SMS nudge to guardians"
              icon={MessageSquare}
              accent="bg-cyan-500/20 border-cyan-500/30"
              onClick={() => setShowReminder("sms")}
              disabled={!onboarding.isActionEnabled("other")}
            />
            <QuickAction
              title="Generate Simple Report"
              description="Download a quick snapshot for management"
              icon={ClipboardList}
              accent="bg-emerald-500/20 border-emerald-500/30"
              onClick={() => {}}
              disabled={!onboarding.isActionEnabled("other")}
            />
            {/* preflight with seeding */}
            {onboarding.nextAction === "create_class_group" ? (
              <ShimmerHighlight enabled={true}>
                <QuickAction
                  title="Create Class"
                  description="Set up a new class or grade level"
                  icon={School}
                  accent="bg-purple-500/20 border-purple-500/30"
                  onClick={openCreateClassFlow}
                  highlighted={true}
                />
              </ShimmerHighlight>
            ) : (
              <QuickAction
                title="Create Class"
                description="Set up a new class or grade level"
                icon={School}
                accent="bg-purple-500/20 border-purple-500/30"
                onClick={openCreateClassFlow}
                disabled={!onboarding.isActionEnabled("create_class_group")}
              />
            )}
            {onboarding.nextAction === "add_teacher" ? (
              <ShimmerHighlight enabled={true}>
                <QuickAction
                  title="Add Teacher"
                  description="Add a new teacher and assign subjects"
                  icon={Users}
                  accent="bg-orange-500/20 border-orange-500/30"
                  onClick={() => setShowCreateTeacher(true)}
                  highlighted={true}
                />
              </ShimmerHighlight>
            ) : (
              <QuickAction
                title="Add Teacher"
                description="Add a new teacher and assign subjects"
                icon={Users}
                accent="bg-orange-500/20 border-orange-500/30"
                onClick={() => setShowCreateTeacher(true)}
                disabled={!onboarding.isActionEnabled("add_teacher")}
              />
            )}
            {onboarding.nextAction === "add_student" ? (
              <ShimmerHighlight enabled={true}>
                <QuickAction
                  title="Add New Student"
                  description="Enroll a new student to your school"
                  icon={UserPlus}
                  accent="bg-fuchsia-500/20 border-fuchsia-500/30"
                  onClick={() => setShowCreateStudent(true)}
                  highlighted={true}
                />
              </ShimmerHighlight>
            ) : (
              <QuickAction
                title="Add New Student"
                description="Enroll a new student to your school"
                icon={UserPlus}
                accent="bg-fuchsia-500/20 border-fuchsia-500/30"
                onClick={() => setShowCreateStudent(true)}
                disabled={!onboarding.isActionEnabled("add_student")}
              />
            )}
          </CardContent>
        </Card>

        {/* Academic Period */}
        <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <div
            className="pointer-events-none absolute inset-0 bg-linear-to-br from-amber-500/20 via-amber-500/5 to-transparent"
            aria-hidden="true"
          />
          <CardHeader className="relative z-10 flex items-center justify-between">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <div className="p-2 rounded-lg bg-amber-500/20 border border-amber-500/30">
                <Calendar className="h-4 w-4 text-amber-400" />
              </div>
              Academic Period
            </CardTitle>

            {progress.label === "Not Set" && (
              <>
                {onboarding.nextAction === "academic_period" ? (
                  <ShimmerHighlight enabled={true}>
                    <button
                      type="button"
                      onClick={() => setShowCreatePeriod(true)}
                      className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-300 hover:opacity-90"
                    >
                      Create period
                    </button>
                  </ShimmerHighlight>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowCreatePeriod(true)}
                    disabled={true}
                    className="rounded-lg border border-amber-500/10 bg-amber-500/5 px-3 py-1.5 text-xs font-medium text-amber-300/40 hover:opacity-90 opacity-40 cursor-not-allowed"
                    title="Complete previous steps first"
                  >
                    Create period
                  </button>
                )}
              </>
            )}
          </CardHeader>

          <CardContent className="relative z-10 space-y-4">
            <div className="flex items-start gap-4 p-4 rounded-xl border border-white/10 bg-white/5">
              <div className="p-3 rounded-lg bg-amber-500/20 border border-amber-500/30">
                <Calendar className="h-5 w-5 text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-semibold text-white">Current Term</span>
                  <span className="px-2 py-0.5 text-xs rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-400">
                    {progress.label}
                  </span>
                </div>
                <div className="text-sm text-white/60 mb-3">
                  {progress.pct === 0 && progress.label === "Not Set"
                    ? "No active academic period configured"
                    : "Academic period in progress"}
                </div>
                {progress.label !== "Not Set" && (
                  <div className="mb-3">
                    <div className="flex items-center justify-between text-xs text-white/50 mb-2">
                      <span>Term Progress</span>
                      <span className="font-medium text-white/70">
                        {progress.pct}%
                      </span>
                    </div>
                    <div className="relative h-3 w-full overflow-hidden rounded-full bg-white/5 border border-white/10 shadow-inner">
                      <div className="absolute inset-0 bg-linear-to-r from-amber-500/10 via-amber-400/5 to-transparent" />
                      {progress.pct > 0 ? (
                        <div
                          className="relative h-full rounded-full bg-linear-to-r from-amber-500 via-amber-400 to-amber-300 shadow-lg shadow-amber-500/40 transition-all duration-700 ease-out"
                          style={{ width: `${progress.pct}%` }}
                        >
                          <div className="absolute inset-0 bg-linear-to-r from-transparent via-white/40 to-transparent animate-shimmer" />
                          <div className="absolute inset-0 bg-amber-400/50 rounded-full animate-pulse" />
                        </div>
                      ) : (
                        <div className="h-full w-full flex items-center justify-center">
                          <div className="text-[8px] text-white/30">
                            Not started
                          </div>
                        </div>
                      )}
                      {progress.pct > 0 && progress.pct < 100 && (
                        <div
                          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white border-2 border-amber-400 shadow-lg shadow-amber-500/50 transition-all duration-700 ease-out"
                          style={{ left: `calc(${progress.pct}% - 8px)` }}
                        >
                          <div className="absolute inset-0 rounded-full bg-amber-400/30 animate-ping" />
                        </div>
                      )}
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-4 text-xs text-white/50 overflow-x-auto">
                  <div className="flex items-center gap-1.5 whitespace-nowrap shrink-0">
                    <Clock className="h-3.5 w-3.5 shrink-0" />
                    <span>Start: {period.startDate || "—"}</span>
                  </div>
                  <div className="flex items-center gap-1.5 whitespace-nowrap shrink-0">
                    <Clock className="h-3.5 w-3.5 shrink-0" />
                    <span>End: {period.endDate || "—"}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-white/10">
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/50">Academic Year</span>
                <span className="text-white/70 font-medium">
                  {period.yearLabel}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Overdues & Risk + Collections Snapshot */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <div
            className="pointer-events-none absolute inset-0 bg-linear-to-br from-rose-500/15 via-rose-500/5 to-transparent"
            aria-hidden="true"
          />
          <CardHeader className="relative z-10 flex items-center justify-between">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <div className="p-2 rounded-lg bg-rose-500/20 border border-rose-500/30">
                <DollarSign className="h-4 w-4 text-rose-300" />
              </div>
              Overdues &amp; Risk
            </CardTitle>
            {onboarding.step === "complete" ? (
              <Link
                href="/admin/overdue-report"
                className="text-sm text-brand hover:opacity-80"
              >
                Overdue report →
              </Link>
            ) : (
              <span className="text-sm text-white/40 cursor-not-allowed">
                Overdue report →
              </span>
            )}
          </CardHeader>
          <CardContent className="relative z-10">
            {overdueTotal > 0 ? (
              <Donut segments={donutSegments} />
            ) : (
              <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-sm text-white/70">
                No overdue invoices yet.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <div
            className="pointer-events-none absolute inset-0 bg-linear-to-br from-emerald-500/15 via-emerald-500/5 to-transparent"
            aria-hidden="true"
          />
          <CardHeader className="relative z-10 flex items-center justify-between">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <div className="p-2 rounded-lg bg-emerald-500/20 border border-emerald-500/30">
                <DollarSign className="h-4 w-4 text-emerald-400" />
              </div>
              Collections Snapshot
            </CardTitle>
            <ReconPill count={reconUnmatched} />
          </CardHeader>
          <CardContent className="relative z-10 grid grid-cols-3 gap-4">
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs text-white/60 mb-1">Collected</div>
              <div className="text-lg font-semibold text-white">
                {collections.collected}
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs text-white/60 mb-1">Outstanding</div>
              <div className="text-lg font-semibold text-white">
                {collections.outstanding}
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs text-white/60 mb-1">Collection Rate</div>
              <div className="text-lg font-semibold text-white">
                {collections.rate}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Invitations Card */}
      {invitationStats && invitationStats.pending > 0 && (
        <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <div
            className="pointer-events-none absolute inset-0 bg-linear-to-br from-violet-500/15 via-violet-500/5 to-transparent"
            aria-hidden="true"
          />
          <CardHeader className="relative z-10 flex items-center justify-between">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <div className="p-2 rounded-lg bg-violet-500/20 border border-violet-500/30">
                <Mail className="h-4 w-4 text-violet-300" />
              </div>
              Pending Invitations
            </CardTitle>
            <Link
              href="/admin/invitations"
              className="text-sm text-brand hover:opacity-80"
            >
              View all →
            </Link>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="flex items-center gap-4">
              <div className="rounded-xl border border-white/10 bg-white/5 p-4 flex-1">
                <div className="text-xs text-white/60 mb-1">Pending</div>
                <div className="text-2xl font-bold text-amber-300">
                  {invitationStats.pending}
                </div>
                <div className="text-xs text-white/50 mt-1">
                  {invitationStats.pending === 1
                    ? "invitation awaiting response"
                    : "invitations awaiting response"}
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-4 flex-1">
                <div className="text-xs text-white/60 mb-1">Total Sent</div>
                <div className="text-2xl font-bold text-white">
                  {invitationStats.total}
                </div>
                <div className="text-xs text-white/50 mt-1">
                  {invitationStats.accepted} accepted
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Attendance & Coverage + Upcoming Events */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <div
            className="pointer-events-none absolute inset-0 bg-linear-to-br from-blue-500/15 via-blue-500/5 to-transparent"
            aria-hidden="true"
          />
          <CardHeader className="relative z-10">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <div className="p-2 rounded-lg bg-blue-500/20 border border-blue-500/30">
                <Users className="h-4 w-4 text-blue-300" />
              </div>
              Attendance &amp; Coverage
            </CardTitle>
          </CardHeader>
          <CardContent className="relative z-10 grid grid-cols-3 gap-4">
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs text-white/60 mb-1">Today</div>
              <div className="text-lg font-semibold text-white">—</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs text-white/60 mb-1">7-day Trend</div>
              <div className="text-xs text-white/70">No recent data</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs text-white/60 mb-1">Teacher Coverage</div>
              <div className="text-lg font-semibold text-white">—</div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-fuchsia-500/15 via-fuchsia-500/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <div
            className="pointer-events-none absolute inset-0 bg-linear-to-br from-fuchsia-500/15 via-fuchsia-500/5 to-transparent"
            aria-hidden="true"
          />
          <CardHeader className="relative z-10 flex items-center justify-between">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <div className="p-2 rounded-lg bg-fuchsia-500/20 border border-fuchsia-500/30">
                <Calendar className="h-4 w-4 text-fuchsia-300" />
              </div>
              Upcoming Events
            </CardTitle>
            {onboarding.step === "complete" ? (
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-lg border border-fuchsia-500/30 bg-fuchsia-500/10 px-3 py-1.5 text-xs text-fuchsia-200 hover:opacity-90"
                onClick={() => {}}
              >
                <PlusCircle className="h-3.5 w-3.5" />
                Add event
              </button>
            ) : (
              <button
                type="button"
                disabled={true}
                className="inline-flex items-center gap-1 rounded-lg border border-fuchsia-500/10 bg-fuchsia-500/5 px-3 py-1.5 text-xs text-fuchsia-200/40 hover:opacity-90 opacity-40 cursor-not-allowed"
                title="Complete onboarding first"
              >
                <PlusCircle className="h-3.5 w-3.5" />
                Add event
              </button>
            )}
          </CardHeader>
          <CardContent className="relative z-10 space-y-3">
            {upcomingEvents.map((e) => (
              <div
                key={e.id}
                className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-3"
              >
                <div className="p-2 rounded-lg bg-fuchsia-500/20 border border-fuchsia-500/30">
                  <Calendar className="h-4 w-4 text-fuchsia-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white/80">{e.title}</div>
                  <div className="text-xs text-white/50 mt-0.5">{e.when}</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Activity Feed + Admin Assistant + Suggestions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ActivityFeed limit={5} />

        <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <div
            className="pointer-events-none absolute inset-0 bg-linear-to-br from-indigo-400/15 via-indigo-400/5 to-transparent"
            aria-hidden="true"
          />
          <CardHeader className="relative z-10 flex items-center justify-between">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <div className="p-2 rounded-lg bg-indigo-400/20 border border-indigo-400/30">
                <Search className="h-4 w-4 text-indigo-200" />
              </div>
              Admin Assistant
            </CardTitle>
          </CardHeader>
          <CardContent className="relative z-10 space-y-3">
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <textarea
                rows={3}
                placeholder="Ask: “Summarize collections this term”, “Draft a reminder for Grade 4 parents”…"
                className="w-full resize-none rounded-lg border border-white/10 bg-transparent p-3 text-sm text-white placeholder:text-white/40 focus:outline-none"
              />
              <div className="mt-2 flex flex-wrap gap-2">
                {[
                  "Draft fee reminder",
                  "Show recon issues",
                  "List top absences",
                  "Generate weekly summary",
                ].map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70 hover:bg-white/10"
                    onClick={() => {}}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-black hover:opacity-90"
                  onClick={() => {}}
                >
                  Ask
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <div
            className="pointer-events-none absolute inset-0 bg-linear-to-br from-amber-400/15 via-amber-400/5 to-transparent"
            aria-hidden="true"
          />
          <CardHeader className="relative z-10">
            <CardTitle className="text-lg font-semibold">Suggestions</CardTitle>
          </CardHeader>
          <CardContent className="relative z-10 space-y-3">
            {suggestions.map((s) => (
              <div
                key={s.id}
                className="rounded-xl border border-white/10 bg-white/5 p-4"
              >
                <div className="text-sm text-white/90 mb-3">{s.text}</div>
                <div className="flex flex-wrap gap-2">
                  {s.actions.map((a, i) => {
                    const Icon = a.icon;
                    return (
                      <button
                        key={i}
                        type="button"
                        className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10"
                        onClick={a.onClick}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {a.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions + Notices */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <div
            className="pointer-events-none absolute inset-0 bg-linear-to-br from-emerald-500/15 via-emerald-500/5 to-transparent"
            aria-hidden="true"
          />
          <CardHeader className="relative z-10">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <div className="p-2 rounded-lg bg-emerald-500/20 border border-emerald-500/30">
                <PlusCircle className="h-4 w-4 text-emerald-300" />
              </div>
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="relative z-10 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setShowCreateStudent(true)}
                className="flex flex-col items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-4 hover:bg-white/10 transition-colors text-left"
              >
                <div className="p-2 rounded-lg bg-blue-500/20 border border-blue-500/30">
                  <GraduationCap className="h-4 w-4 text-blue-300" />
                </div>
                <span className="text-xs font-medium text-white/90">
                  Add Student
                </span>
              </button>
              <button
                type="button"
                onClick={() => setShowCreateTeacher(true)}
                className="flex flex-col items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-4 hover:bg-white/10 transition-colors text-left"
              >
                <div className="p-2 rounded-lg bg-purple-500/20 border border-purple-500/30">
                  <Users className="h-4 w-4 text-purple-300" />
                </div>
                <span className="text-xs font-medium text-white/90">
                  Add Teacher
                </span>
              </button>
              <button
                type="button"
                onClick={() => setShowCreateClass(true)}
                className="flex flex-col items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-4 hover:bg-white/10 transition-colors text-left"
              >
                <div className="p-2 rounded-lg bg-emerald-500/20 border border-emerald-500/30">
                  <School className="h-4 w-4 text-emerald-300" />
                </div>
                <span className="text-xs font-medium text-white/90">
                  Create Class
                </span>
              </button>
              <Link
                href="/admin/fees/invoices"
                className="flex flex-col items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-4 hover:bg-white/10 transition-colors text-left"
              >
                <div className="p-2 rounded-lg bg-amber-500/20 border border-amber-500/30">
                  <DollarSign className="h-4 w-4 text-amber-300" />
                </div>
                <span className="text-xs font-medium text-white/90">
                  Create Invoice
                </span>
              </Link>
            </div>
            <div className="pt-2 border-t border-white/10">
              <Link
                href="/admin/students"
                className="flex items-center justify-between text-sm text-white/70 hover:text-white/90 transition-colors"
              >
                <span>View all students</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <div
            className="pointer-events-none absolute inset-0 bg-linear-to-br from-fuchsia-500/15 via-fuchsia-500/5 to-transparent"
            aria-hidden="true"
          />
          <CardHeader className="relative z-10 flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <div className="p-2 rounded-lg bg-fuchsia-500/20 border border-fuchsia-500/30">
                <Bell className="h-4 w-4 text-fuchsia-300" />
              </div>
              Notices
            </CardTitle>
            <button
              type="button"
              className="text-sm text-brand hover:opacity-80"
              onClick={() => {}}
            >
              Create notice
            </button>
          </CardHeader>
          <CardContent className="relative z-10 space-y-3">
            <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="p-2 rounded-lg bg-fuchsia-500/20 border border-fuchsia-500/30">
                <Bell className="h-4 w-4 text-fuchsia-300" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-white/80">No notices yet</div>
                <div className="text-xs text-white/50 mt-0.5">—</div>
              </div>
            </div>
            <div className="pt-1">
              <button
                type="button"
                className="text-sm text-white/70 hover:text-white/90"
                onClick={() => {}}
              >
                See all notices →
              </button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Command palette hint */}
      <div className="flex items-center justify-center pt-4">
        <button
          type="button"
          onClick={() => palette.setOpen(true)}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70 hover:bg-white/10"
        >
          <Search className="h-3.5 w-3.5" />
          Press <span className="rounded bg-white/10 px-1.5 py-0.5">⌘K</span> to
          search &amp; act
        </button>
      </div>

      {/* Command Palette Modal */}
      {palette.open && (
        <div
          className="fixed inset-0 z-60 grid place-items-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => palette.setOpen(false)}
        >
          <div
            className="w-full max-w-xl rounded-2xl border border-white/10 bg-card/95 p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3">
              <Search className="h-4 w-4 text-white/60" />
              <input
                autoFocus
                value={palette.q}
                onChange={(e) => palette.setQ(e.target.value)}
                placeholder="Search or type a command…"
                className="h-12 flex-1 bg-transparent text-white placeholder:text-white/40 focus:outline-none"
              />
            </div>
            <div className="mt-2 max-h-72 overflow-auto rounded-xl border border-white/10 bg-white/5">
              {palette.filtered.length === 0 ? (
                <div className="p-4 text-sm text-white/60">No results</div>
              ) : (
                <ul className="divide-y divide-white/10">
                  {palette.filtered.map((it) => (
                    <li key={it.id}>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-white/10"
                        onClick={() => {
                          palette.setOpen(false);
                          it.onRun();
                        }}
                      >
                        <span className="text-sm text-white/90">
                          {it.label}
                        </span>
                        {it.kbd && (
                          <span className="text-xs text-white/50 rounded bg-white/10 px-2 py-0.5">
                            {it.kbd}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Academic Period */}
      <CreateAcademicPeriodModal
        open={showCreatePeriod}
        onOpenChange={setShowCreatePeriod}
        onSubmit={handleCreatePeriod}
        isLoading={creatingPeriod}
      />

      {/* Quick Action Modals */}
      <ResponsiveModal
        open={showReminder !== null}
        onClose={() => setShowReminder(null)}
        title={
          showReminder === "sms"
            ? "Draft Fee Reminder (SMS)"
            : "Draft Fee Reminder (Email)"
        }
      >
        <DraftReminderModal onClose={() => setShowReminder(null)} />
      </ResponsiveModal>

      <ResponsiveModal
        open={showCreateClass}
        onClose={() => setShowCreateClass(false)}
        title="Create Class Group"
      >
        <CreateClassGroupsModal onClose={() => setShowCreateClass(false)} />
      </ResponsiveModal>

      <ResponsiveModal
        open={showCreateStudent}
        onClose={() => setShowCreateStudent(false)}
        title="Add New Student"
      >
        <CreateStudentModal
          onClose={() => setShowCreateStudent(false)}
          onSubmit={handleCreateStudent}
          isLoading={creatingStudent}
        />
      </ResponsiveModal>

      <ResponsiveModal
        open={showCreateTeacher}
        onClose={() => setShowCreateTeacher(false)}
        title="Add New Teacher"
      >
        <CreateTeacherModal
          onClose={() => setShowCreateTeacher(false)}
          onSubmit={handleCreateTeacher}
          isLoading={creatingTeacher}
        />
      </ResponsiveModal>

      {/* Period Expiry Modal (auto-shows for critical statuses) */}
      <PeriodExpiryModal
        open={showPeriodExpiryModal}
        onOpenChange={setShowPeriodExpiryModal}
        onCreatePeriod={() => {
          setShowPeriodExpiryModal(false);
          setShowCreatePeriod(true);
        }}
      />
    </div>
  );
}
