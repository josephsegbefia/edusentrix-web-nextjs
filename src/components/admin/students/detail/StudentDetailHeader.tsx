"use client";

import * as React from "react";
import * as ReactDOM from "react-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  GraduationCap,
  UserCircle2,
  PhoneCall,
  Mail,
  Wallet,
  Calendar,
  Hash,
  Landmark,
  FileText,
  Pencil,
  Check,
  X,
  Loader2,
  HelpCircle,
  Send,
  Mars,
  Venus,
} from "lucide-react";
import type { StudentDetailDTO } from "@/hooks/admin/useStudentDetail";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/useToast";
import { StudentDetailAvatar } from "@/components/admin/students/detail/StudentDetailAvatar";
import { formatStudentSexLabel } from "@/lib/students/format-student-sex";

type StudentDetailHeaderProps = {
  student: StudentDetailDTO;
  onRecordPayment?: () => void;
};

function MetricStatCard({
  icon: Icon,
  label,
  value,
  subLabel,
  tone,
  tooltip,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  subLabel?: string;
  tone: "teal" | "cyan" | "emerald" | "amber" | "red";
  tooltip?: string;
}) {
  const [showTooltip, setShowTooltip] = React.useState(false);
  const helpRef = React.useRef<HTMLDivElement>(null);
  const [tooltipPos, setTooltipPos] = React.useState({ top: 0, left: 0 });

  React.useEffect(() => {
    if (showTooltip && helpRef.current) {
      const rect = helpRef.current.getBoundingClientRect();
      setTooltipPos({
        top: rect.bottom + 6,
        left: rect.right - 208,
      });
    }
  }, [showTooltip]);

  const tones = {
    teal: {
      gradient: "from-teal-500/10 via-teal-500/5 to-transparent",
      iconBg: "bg-teal-500/20 border-teal-500/30",
      iconColor: "text-teal-300",
    },
    cyan: {
      gradient: "from-cyan-500/10 via-cyan-500/5 to-transparent",
      iconBg: "bg-cyan-500/20 border-cyan-500/30",
      iconColor: "text-cyan-300",
    },
    emerald: {
      gradient: "from-emerald-500/10 via-emerald-500/5 to-transparent",
      iconBg: "bg-emerald-500/20 border-emerald-500/30",
      iconColor: "text-emerald-300",
    },
    amber: {
      gradient: "from-amber-500/10 via-amber-500/5 to-transparent",
      iconBg: "bg-amber-500/20 border-amber-500/30",
      iconColor: "text-amber-300",
    },
    red: {
      gradient: "from-red-500/10 via-red-500/5 to-transparent",
      iconBg: "bg-red-500/20 border-red-500/30",
      iconColor: "text-red-300",
    },
  };

  const style = tones[tone];

  return (
    <div className="group/card relative overflow-hidden rounded-xl border border-white/10 bg-linear-to-br from-slate-900/80 to-black p-4 shadow-lg shadow-black/30 backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl">
      <div
        className={cn(
          "pointer-events-none absolute inset-0 bg-linear-to-br opacity-60 transition-opacity duration-300 group-hover/card:opacity-100",
          style.gradient
        )}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/15 to-transparent"
        aria-hidden="true"
      />

      {tooltip && (
        <div
          ref={helpRef}
          className="absolute right-2.5 top-2.5 z-20"
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          <HelpCircle className="h-3.5 w-3.5 cursor-help text-white/25 transition-colors hover:text-white/50" />
          {showTooltip &&
            ReactDOM.createPortal(
              <div
                style={{ top: tooltipPos.top, left: tooltipPos.left }}
                className="fixed z-9999 w-52 rounded-lg border border-white/15 bg-slate-900 px-3 py-2 text-[11px] leading-relaxed text-white/70 shadow-xl shadow-black/50"
              >
                <div className="absolute -top-1 right-2 h-2 w-2 rotate-45 border-l border-t border-white/15 bg-slate-900" />
                {tooltip}
              </div>,
              document.body
            )}
        </div>
      )}

      <div className="relative z-10 space-y-2">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg border",
              style.iconBg
            )}
          >
            <Icon className={cn("h-4 w-4", style.iconColor)} />
          </div>
          <span className="text-[10px] font-medium uppercase tracking-widest text-white/50">
            {label}
          </span>
        </div>
        <div className="text-xl font-bold tracking-tight text-white">
          {value}
        </div>
        {subLabel && <p className="text-[10px] text-white/40">{subLabel}</p>}
      </div>
    </div>
  );
}

export function StudentDetailHeader({
  student,
  onRecordPayment,
}: StudentDetailHeaderProps) {
  const {
    id,
    schoolId,
    fullName,
    classGroup,
    grade,
    admissionNo,
    status,
    photoUrl,
    sex,
    ageYears,
    academicSummary,
    feesSummary,
    guardians,
    gesIndexNumber,
    gesSchoolCode,
  } = student;

  const sexLabel = formatStudentSexLabel(sex);

  const performanceTier = academicSummary?.performanceTier ?? null;
  const feesStatus = feesSummary?.status ?? null;

  // GES inline editing
  const [editingGes, setEditingGes] = React.useState(false);
  const [gesForm, setGesForm] = React.useState({
    gesSchoolCode: gesSchoolCode ?? "",
    gesIndexNumber: gesIndexNumber ?? "",
  });
  const [savingGes, setSavingGes] = React.useState(false);
  const queryClient = useQueryClient();
  const toast = useToast();

  const primaryGuardian = React.useMemo(() => {
    if (!guardians?.length) return null;

    return (
      guardians.find(
        (guardian) =>
          guardian.isPrimary &&
          (guardian.phone?.trim() || guardian.email?.trim())
      ) ??
      guardians.find(
        (guardian) => guardian.phone?.trim() || guardian.email?.trim()
      ) ??
      null
    );
  }, [guardians]);

  const guardianPhone = primaryGuardian?.phone?.trim() || "";
  const guardianEmail = primaryGuardian?.email?.trim() || "";

  function handlePhoneClick() {
    if (!guardianPhone) {
      toast.warning("No guardian phone number available for this student");
      return;
    }

    window.location.href = `tel:${guardianPhone}`;
  }

  function handleEmailClick() {
    if (!guardianEmail) {
      toast.warning("No guardian email available for this student");
      return;
    }

    const subject = encodeURIComponent(`Update on ${fullName}`);
    window.location.href = `mailto:${guardianEmail}?subject=${subject}`;
  }

  function handleRecordPaymentClick() {
    if (onRecordPayment) {
      onRecordPayment();
      return;
    }

    toast.info("Open the Fees tab to record a payment");
  }

  React.useEffect(() => {
    setGesForm({
      gesSchoolCode: gesSchoolCode ?? "",
      gesIndexNumber: gesIndexNumber ?? "",
    });
  }, [gesSchoolCode, gesIndexNumber]);

  async function handleSaveGes() {
    setSavingGes(true);
    try {
      const res = await fetch(`/api/admin/students/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gesSchoolCode: gesForm.gesSchoolCode || null,
          gesIndexNumber: gesForm.gesIndexNumber || null,
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
      await queryClient.invalidateQueries({
        queryKey: ["admin-student-detail", id],
      });
      setEditingGes(false);
    } catch {
      // Error handled silently, stay in editing mode
    } finally {
      setSavingGes(false);
    }
  }

  return (
    <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-teal-950/40 to-transparent shadow-2xl shadow-black/40 backdrop-blur-xl">
      {/* Decorative elements */}
      <div
        className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-teal-500/10 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -left-10 bottom-0 h-40 w-40 rounded-full bg-cyan-500/10 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-teal-500/30 to-transparent"
        aria-hidden="true"
      />

      <CardContent className="relative z-10 flex flex-col gap-6 p-6 lg:flex-row lg:items-start lg:justify-between">
        {/* Left: Avatar + basic info */}
        <div className="flex flex-1 flex-col items-center gap-5 min-w-0 sm:flex-row sm:items-start">
          <StudentDetailAvatar
            studentId={id}
            schoolId={schoolId}
            fullName={fullName}
            photoUrl={photoUrl}
            status={status}
          />

          <div className="flex-1 min-w-0 space-y-3 text-center sm:text-left">
            {/* Name and badges */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
                  {fullName}
                </h1>
                {performanceTier === "top" && (
                  <Badge
                    variant="outline"
                    className="gap-1 rounded-lg border-amber-400/50 bg-amber-500/20 text-[10px] font-semibold text-amber-200"
                  >
                    <GraduationCap className="h-3 w-3" />
                    Top Performer
                  </Badge>
                )}
                {feesStatus === "owing" && (
                  <Badge
                    variant="outline"
                    className="gap-1 rounded-lg border-red-400/50 bg-red-500/20 text-[10px] font-semibold text-red-200"
                  >
                    <Wallet className="h-3 w-3" />
                    Owing Fees
                  </Badge>
                )}
              </div>

              {/* Info badges */}
              <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                {grade && (
                  <Badge className="rounded-lg border border-teal-400/30 bg-teal-500/20 px-2.5 py-0.5 text-[10px] font-semibold text-teal-100">
                    {grade.label}
                  </Badge>
                )}
                {classGroup && (
                  <Badge
                    variant="outline"
                    className="rounded-lg border-cyan-400/30 bg-cyan-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-cyan-100"
                  >
                    {classGroup.label}
                  </Badge>
                )}
                {admissionNo && (
                  <span className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-black/40 px-2.5 py-1 text-[10px] font-medium text-white/60 font-mono">
                    <Hash className="h-3 w-3" />
                    {admissionNo}
                  </span>
                )}
                {typeof ageYears === "number" && ageYears >= 0 && (
                  <span className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-black/40 px-2.5 py-1 text-[10px] font-medium text-white/60">
                    <Calendar className="h-3 w-3" />
                    {ageYears} years old
                  </span>
                )}
                {sexLabel && (
                  <span
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[10px] font-semibold",
                      sex === "female"
                        ? "border-rose-400/35 bg-rose-500/15 text-rose-100"
                        : "border-sky-400/35 bg-sky-500/15 text-sky-100"
                    )}
                  >
                    {sex === "female" ? (
                      <Venus className="h-3 w-3" aria-hidden />
                    ) : (
                      <Mars className="h-3 w-3" aria-hidden />
                    )}
                    {sexLabel}
                  </span>
                )}
                <span
                  className={cn(
                    "rounded-lg border px-2.5 py-1 text-[10px] font-semibold",
                    status === "active" &&
                      "border-emerald-400/50 bg-emerald-500/20 text-emerald-200",
                    status === "inactive" &&
                      "border-slate-400/50 bg-slate-500/20 text-slate-200",
                    status === "withdrawn" &&
                      "border-red-400/50 bg-red-500/20 text-red-200",
                    status === "graduated" &&
                      "border-violet-400/50 bg-violet-500/20 text-violet-200"
                  )}
                >
                  {status === "graduated" ? "Alumni" : status.charAt(0).toUpperCase() + status.slice(1)}
                </span>
              </div>

              {/* GES Information row */}
              <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                {gesSchoolCode && !editingGes && (
                  <span className="flex items-center gap-1.5 rounded-lg border border-violet-400/20 bg-violet-500/10 px-2.5 py-1 text-[10px] font-medium text-violet-200 font-mono">
                    <Landmark className="h-3 w-3" />
                    GES: {gesSchoolCode}
                  </span>
                )}
                {gesIndexNumber && !editingGes && (
                  <span className="flex items-center gap-1.5 rounded-lg border border-indigo-400/20 bg-indigo-500/10 px-2.5 py-1 text-[10px] font-medium text-indigo-200 font-mono">
                    <FileText className="h-3 w-3" />
                    Index: {gesIndexNumber}
                  </span>
                )}
                {!editingGes && (
                  <button
                    type="button"
                    onClick={() => setEditingGes(true)}
                    className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-medium text-white/40 transition-all hover:border-white/20 hover:bg-white/10 hover:text-white/60"
                  >
                    <Pencil className="h-2.5 w-2.5" />
                    {gesSchoolCode || gesIndexNumber ? "Edit" : "Add"} GES Info
                  </button>
                )}
              </div>

              {/* GES inline edit form */}
              {editingGes && (
                <div className="mt-2 flex flex-col gap-2 rounded-xl border border-violet-500/20 bg-violet-500/5 p-3 sm:flex-row sm:items-end">
                  <div className="flex-1 space-y-1">
                    <label className="text-[9px] font-medium uppercase tracking-wider text-violet-300/60">
                      GES School Code
                    </label>
                    <Input
                      value={gesForm.gesSchoolCode}
                      onChange={(e) =>
                        setGesForm((f) => ({
                          ...f,
                          gesSchoolCode: e.target.value,
                        }))
                      }
                      placeholder="e.g. 0301234"
                      className="h-8 border-violet-500/20 bg-violet-500/5 font-mono text-xs text-white placeholder:text-violet-300/30 focus:border-violet-400/40 focus:ring-1 focus:ring-violet-400/30"
                    />
                  </div>
                  <div className="flex-1 space-y-1">
                    <label className="text-[9px] font-medium uppercase tracking-wider text-violet-300/60">
                      BECE Index Number
                    </label>
                    <Input
                      value={gesForm.gesIndexNumber}
                      onChange={(e) =>
                        setGesForm((f) => ({
                          ...f,
                          gesIndexNumber: e.target.value,
                        }))
                      }
                      placeholder="e.g. 0301234001"
                      className="h-8 border-violet-500/20 bg-violet-500/5 font-mono text-xs text-white placeholder:text-violet-300/30 focus:border-violet-400/40 focus:ring-1 focus:ring-violet-400/30"
                    />
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={handleSaveGes}
                      disabled={savingGes}
                      className="h-8 w-8 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30"
                    >
                      {savingGes ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Check className="h-3.5 w-3.5" />
                      )}
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        setEditingGes(false);
                        setGesForm({
                          gesSchoolCode: gesSchoolCode ?? "",
                          gesIndexNumber: gesIndexNumber ?? "",
                        });
                      }}
                      disabled={savingGes}
                      className="h-8 w-8 rounded-lg bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: quick stats + actions */}
        <div className="flex flex-col items-stretch gap-4 lg:w-[380px]">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3">
            <MetricStatCard
              icon={UserCircle2}
              label="Academic"
              value={
                academicSummary?.overallAverage != null
                  ? `${academicSummary.overallAverage.toFixed(1)}%`
                  : "--"
              }
              subLabel={academicSummary?.latestTermLabel ?? "No term data"}
              tone="teal"
              tooltip={
                academicSummary?.isFromPreviousTerm
                  ? `No results yet for the current term. Showing data from ${academicSummary.previousTermLabel ?? "a previous term"}.`
                  : academicSummary?.overallAverage != null
                    ? `Showing recorded results for ${academicSummary.latestTermLabel ?? "the current term"}.`
                    : "No academic results have been recorded for this student yet."
              }
            />
            <MetricStatCard
              icon={Wallet}
              label="Fees"
              value={
                feesSummary
                  ? `${feesSummary.currency} ${feesSummary.totalOutstanding.toLocaleString()}`
                  : "--"
              }
              subLabel={
                feesStatus === "clear"
                  ? "All fees cleared"
                  : feesStatus === "partial"
                    ? "Partially paid"
                    : feesStatus === "owing"
                      ? "Outstanding balance"
                      : "No fee data"
              }
              tone={
                feesStatus === "clear"
                  ? "emerald"
                  : feesStatus === "owing"
                    ? "red"
                    : "amber"
              }
            />
          </div>

          {primaryGuardian &&
            primaryGuardian.hasPlatformAccount === false && (
              <div className="flex items-start gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2.5 text-left">
                <Send className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" aria-hidden />
                <p className="text-[11px] leading-snug text-amber-100/90">
                  <span className="font-semibold text-amber-100">Primary contact</span> has not
                  accepted their invitation yet and does not have a parent portal login. You can
                  still use their details saved here.
                </p>
              </div>
            )}

          {/* Actions */}
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handlePhoneClick}
              className="h-9 w-9 rounded-xl border-white/15 bg-white/5 text-white/60 transition-all hover:border-teal-500/30 hover:bg-teal-500/10 hover:text-teal-300"
              aria-label={
                guardianPhone ? `Call ${primaryGuardian?.fullName ?? "guardian"}` : "Call guardian"
              }
              title={
                guardianPhone ? `Call ${primaryGuardian?.fullName ?? "guardian"}` : "No guardian phone available"
              }
            >
              <PhoneCall className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleEmailClick}
              className="h-9 w-9 rounded-xl border-white/15 bg-white/5 text-white/60 transition-all hover:border-cyan-500/30 hover:bg-cyan-500/10 hover:text-cyan-300"
              aria-label={
                guardianEmail ? `Email ${primaryGuardian?.fullName ?? "guardian"}` : "Email guardian"
              }
              title={
                guardianEmail ? `Email ${primaryGuardian?.fullName ?? "guardian"}` : "No guardian email available"
              }
            >
              <Mail className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRecordPaymentClick}
              className="gap-2 rounded-xl border-teal-500/30 bg-teal-500/10 text-xs font-medium text-teal-200 transition-all hover:bg-teal-500/20"
            >
              <Wallet className="h-3.5 w-3.5" />
              Record Payment
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
