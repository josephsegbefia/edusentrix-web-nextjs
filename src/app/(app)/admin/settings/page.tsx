// src/app/(app)/admin/settings/page.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  Settings,
  Clock,
  Calendar,
  Users,
  Save,
  Loader2,
  AlertCircle,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Coffee,
  Megaphone,
  CheckCircle2,
  Sparkles,
  ClipboardCheck,
  Wifi,
  Landmark,
  ArrowRight,
} from "lucide-react";
import {
  useSchoolSettings,
  useUpdateSchoolSettings,
  formatTime,
  getShortDayName,
  type BreakPeriodDTO,
  type BreakDailyOverrideDTO,
  type BreakGradeOverrideDTO,
  type AssemblyConfigDTO,
  type AssemblyDailyOverrideDTO,
  type AssemblyGradeOverrideDTO,
  type DailyScheduleOverrideDTO,
  type GradeScheduleOverrideDTO,
} from "@/hooks/admin/useSchoolSettings";
import { useGradeOptions } from "@/hooks/admin/useGradeOptions";
import { useSchoolPaymentSetup } from "@/hooks/admin/useSchoolPaymentSetup";
import { useBusyToast } from "@/hooks/useBusyToast";

type SettingsTab = "schedule" | "attendance" | "academic" | "features";

const TABS: Array<{ id: SettingsTab; label: string; icon: React.ElementType }> = [
  { id: "schedule", label: "Daily Schedule", icon: Clock },
  { id: "attendance", label: "Attendance", icon: Users },
  { id: "academic", label: "Academic Calendar", icon: Calendar },
  { id: "features", label: "Features", icon: Sparkles },
];

const DAYS_OF_WEEK = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

function getGradeOptionId(grade: { _id: string }) {
  return grade._id;
}

function getGradeOptionLabel(grade: { name?: string; _id: string }) {
  return grade.name || grade._id;
}

function PaymentSetupEntryCard() {
  const { data, isLoading } = useSchoolPaymentSetup({ allowForbidden: true });

  if (isLoading) {
    return (
      <div className="h-32 rounded-2xl border border-white/10 bg-white/5 animate-pulse" />
    );
  }

  if (
    !data ||
    !data.capabilities.canManage ||
    !["school_creator", "admin_fallback", "billing_owner"].includes(data.accessMode)
  ) {
    return null;
  }

  const toneClass =
    data.statusTone === "emerald"
      ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-200"
      : data.statusTone === "amber"
        ? "border-amber-500/30 bg-amber-500/15 text-amber-200"
        : data.statusTone === "blue"
          ? "border-cyan-500/30 bg-cyan-500/15 text-cyan-200"
          : data.statusTone === "red"
            ? "border-rose-500/30 bg-rose-500/15 text-rose-200"
            : "border-white/15 bg-white/5 text-white/70";

  return (
    <Link
      href="/admin/settings/payment-setup"
      className="group block rounded-2xl border border-white/10 bg-linear-to-br from-emerald-500/10 via-transparent to-cyan-500/10 transition-all duration-200 hover:-translate-y-0.5 hover:border-white/20 hover:shadow-xl hover:shadow-emerald-900/10"
    >
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10">
              <Landmark className="h-5 w-5 text-emerald-200" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-semibold text-white">Payment Setup</h3>
                <Badge variant="outline" className={cn("text-[11px]", toneClass)}>
                  {data.statusLabel}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-white/60">
                Manage the school's payout account and online payments readiness.
              </p>
            </div>
          </div>
          <ArrowRight className="h-5 w-5 text-white/35 transition-transform group-hover:translate-x-0.5" />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-white/50">
          <span>
            {data.bank.maskedAccountNumber
              ? `${data.bank.bankName} • ${data.bank.maskedAccountNumber}`
              : "Payout account not configured"}
          </span>
          <span>{data.paymentReady ? "Parents can pay online" : "Online payments pending"}</span>
        </div>
      </div>
    </Link>
  );
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = React.useState<SettingsTab>("schedule");
  const [dailyOverridesExpanded, setDailyOverridesExpanded] =
    React.useState(false);
  const [gradeOverridesExpanded, setGradeOverridesExpanded] =
    React.useState(false);
  const [assemblyDailyExpanded, setAssemblyDailyExpanded] =
    React.useState(false);
  const [assemblyGradeExpanded, setAssemblyGradeExpanded] =
    React.useState(false);
  const [breakDailyExpanded, setBreakDailyExpanded] = React.useState(false);
  const [breakGradeExpanded, setBreakGradeExpanded] = React.useState(false);
  const { data, isLoading, isError } = useSchoolSettings();
  const { data: gradesData } = useGradeOptions();
  const updateSettings = useUpdateSchoolSettings();
  const busy = useBusyToast();

  // Local form state
  const [formData, setFormData] = React.useState<{
    schoolStartTime: string;
    schoolEndTime: string;
    periodDuration: number;
    periodsPerDay: number;
    breaks: BreakPeriodDTO[];
    assembly: AssemblyConfigDTO | null;
    lateArrivalCutoff: string;
    minimumAttendancePercent: number;
    defaultExamWeekDuration: number;
    defaultRevisionWeekDuration: number;
    workingDays: number[];
    teacherStudio: {
      enabled: boolean;
    };
    attendanceNotifications: {
      enabled: boolean;
      channels: {
        whatsapp: boolean;
        sms: boolean;
        email: boolean;
      };
    };
    offlineMode: {
      enabled: boolean;
    };
    dailyScheduleOverrides: DailyScheduleOverrideDTO[];
    gradeScheduleOverrides: GradeScheduleOverrideDTO[];
    breakDailyOverrides: BreakDailyOverrideDTO[];
    breakGradeOverrides: BreakGradeOverrideDTO[];
    assemblyDailyOverrides: AssemblyDailyOverrideDTO[];
    assemblyGradeOverrides: AssemblyGradeOverrideDTO[];
  } | null>(null);

  // Initialize form when data loads
  React.useEffect(() => {
    if (data?.data && !formData) {
      setFormData({
        schoolStartTime: data.data.schoolStartTime,
        schoolEndTime: data.data.schoolEndTime,
        periodDuration: data.data.periodDuration,
        periodsPerDay: data.data.periodsPerDay,
        breaks: data.data.breaks || [],
        assembly: data.data.assembly,
        lateArrivalCutoff: data.data.lateArrivalCutoff || "",
        minimumAttendancePercent: data.data.minimumAttendancePercent,
        defaultExamWeekDuration: data.data.defaultExamWeekDuration,
        defaultRevisionWeekDuration: data.data.defaultRevisionWeekDuration,
        workingDays: data.data.workingDays || [1, 2, 3, 4, 5],
        teacherStudio: data.data.teacherStudio || { enabled: true },
        attendanceNotifications: data.data.attendanceNotifications || {
          enabled: true,
          channels: { whatsapp: true, sms: false, email: false },
        },
        offlineMode: data.data.offlineMode || { enabled: true },
        dailyScheduleOverrides: data.data.dailyScheduleOverrides || [],
        gradeScheduleOverrides: data.data.gradeScheduleOverrides || [],
        breakDailyOverrides: data.data.breakDailyOverrides || [],
        breakGradeOverrides: data.data.breakGradeOverrides || [],
        assemblyDailyOverrides: data.data.assemblyDailyOverrides || [],
        assemblyGradeOverrides: data.data.assemblyGradeOverrides || [],
      });
    }
  }, [data, formData]);

  const handleSave = async () => {
    if (!formData) return;

    try {
      await busy.promise(updateSettings.mutateAsync(formData), {
        loading: "Saving settings...",
        success: "Settings saved successfully!",
        error: (e: Error) => e.message || "Failed to save settings",
      });
    } catch {
      // Error handled by toast
    }
  };

  const addBreak = () => {
    if (!formData) return;
    setFormData({
      ...formData,
      breaks: [
        ...formData.breaks,
        { name: "New Break", startTime: "10:00", endTime: "10:15", isLunch: false },
      ],
    });
  };

  const removeBreak = (index: number) => {
    if (!formData) return;
    setFormData({
      ...formData,
      breaks: formData.breaks.filter((_, i) => i !== index),
    });
  };

  const updateBreak = (index: number, field: keyof BreakPeriodDTO, value: string | boolean) => {
    if (!formData) return;
    const newBreaks = [...formData.breaks];
    newBreaks[index] = { ...newBreaks[index], [field]: value };
    setFormData({ ...formData, breaks: newBreaks });
  };

  const addDailyOverride = () => {
    if (!formData) return;
    const existing = formData.dailyScheduleOverrides || [];
    const usedDays = new Set(existing.map((o) => o.dayOfWeek));
    const firstFree = [1, 2, 3, 4, 5].find((d) => !usedDays.has(d)) ?? 1;
    setFormData({
      ...formData,
      dailyScheduleOverrides: [
        ...existing,
        { dayOfWeek: firstFree, startTime: undefined, endTime: undefined },
      ],
    });
  };

  const removeDailyOverride = (index: number) => {
    if (!formData) return;
    setFormData({
      ...formData,
      dailyScheduleOverrides: (formData.dailyScheduleOverrides || []).filter(
        (_, i) => i !== index
      ),
    });
  };

  const updateDailyOverride = (
    index: number,
    field: keyof DailyScheduleOverrideDTO,
    value: number | string | undefined
  ) => {
    if (!formData) return;
    const overrides = [...(formData.dailyScheduleOverrides || [])];
    overrides[index] = { ...overrides[index], [field]: value };
    setFormData({ ...formData, dailyScheduleOverrides: overrides });
  };

  const addGradeOverride = () => {
    if (!formData) return;
    const grades = gradesData ?? [];
    const existing = formData.gradeScheduleOverrides || [];
    const usedGrades = new Set(existing.map((o) => o.gradeId));
    const firstFree = grades.find((g) => !usedGrades.has(getGradeOptionId(g)));
    if (!firstFree) return;
    const gradeId = getGradeOptionId(firstFree);
    setFormData({
      ...formData,
      gradeScheduleOverrides: [
        ...existing,
        { gradeId, periodsPerDay: undefined, periodDuration: undefined },
      ],
    });
  };

  const removeGradeOverride = (index: number) => {
    if (!formData) return;
    setFormData({
      ...formData,
      gradeScheduleOverrides: (formData.gradeScheduleOverrides || []).filter(
        (_, i) => i !== index
      ),
    });
  };

  const updateGradeOverride = (
    index: number,
    field: keyof GradeScheduleOverrideDTO,
    value: string | number | undefined
  ) => {
    if (!formData) return;
    const overrides = [...(formData.gradeScheduleOverrides || [])];
    overrides[index] = { ...overrides[index], [field]: value };
    setFormData({ ...formData, gradeScheduleOverrides: overrides });
  };

  const addBreakDailyOverride = () => {
    if (!formData) return;
    const breaks = formData.breaks || [];
    const existing = formData.breakDailyOverrides || [];
    const firstBreak = breaks[0];
    if (!firstBreak) return;
    const candidateDays = formData.workingDays;
    const usedKeys = new Set(
      existing.map((o) => `${o.dayOfWeek}:${o.breakName}`)
    );
    const firstFreeDay = candidateDays.find((d) =>
      breaks.some((b) => !usedKeys.has(`${d}:${b.name}`))
    );
    if (firstFreeDay == null) return;
    const breakForDay = breaks.find((b) => !usedKeys.has(`${firstFreeDay}:${b.name}`));
    if (!breakForDay) return;
    setFormData({
      ...formData,
      breakDailyOverrides: [
        ...existing,
        {
          dayOfWeek: firstFreeDay,
          breakName: breakForDay.name,
          startTime: undefined,
          endTime: undefined,
        },
      ],
    });
  };

  const removeBreakDailyOverride = (index: number) => {
    if (!formData) return;
    setFormData({
      ...formData,
      breakDailyOverrides: (formData.breakDailyOverrides || []).filter(
        (_, i) => i !== index
      ),
    });
  };

  const updateBreakDailyOverride = (
    index: number,
    field: keyof BreakDailyOverrideDTO,
    value: number | string | undefined
  ) => {
    if (!formData) return;
    const overrides = [...(formData.breakDailyOverrides || [])];
    overrides[index] = { ...overrides[index], [field]: value };
    setFormData({ ...formData, breakDailyOverrides: overrides });
  };

  const addBreakGradeOverride = () => {
    if (!formData) return;
    const grades = gradesData ?? [];
    const breaks = formData.breaks || [];
    const existing = formData.breakGradeOverrides || [];
    const usedKeys = new Set(
      existing.map((o) => `${o.gradeId}:${o.breakName}`)
    );
    const firstFree = grades.find((g) => {
      const gradeId = getGradeOptionId(g);
      return breaks.some((b) => !usedKeys.has(`${gradeId}:${b.name}`));
    });
    if (!firstFree) return;
    const gradeId = getGradeOptionId(firstFree);
    const breakForGrade = breaks.find((b) => !usedKeys.has(`${gradeId}:${b.name}`));
    if (!breakForGrade) return;
    setFormData({
      ...formData,
      breakGradeOverrides: [
        ...existing,
        {
          gradeId,
          breakName: breakForGrade.name,
          startTime: undefined,
          endTime: undefined,
        },
      ],
    });
  };

  const removeBreakGradeOverride = (index: number) => {
    if (!formData) return;
    setFormData({
      ...formData,
      breakGradeOverrides: (formData.breakGradeOverrides || []).filter(
        (_, i) => i !== index
      ),
    });
  };

  const updateBreakGradeOverride = (
    index: number,
    field: keyof BreakGradeOverrideDTO,
    value: string | undefined
  ) => {
    if (!formData) return;
    const overrides = [...(formData.breakGradeOverrides || [])];
    overrides[index] = { ...overrides[index], [field]: value };
    setFormData({ ...formData, breakGradeOverrides: overrides });
  };

  const addAssemblyDailyOverride = () => {
    if (!formData) return;
    const candidateDays = formData.assembly?.days?.length
      ? formData.assembly.days
      : formData.workingDays;
    const existing = formData.assemblyDailyOverrides || [];
    const usedDays = new Set(existing.map((o) => o.dayOfWeek));
    const firstFree = candidateDays.find((d) => !usedDays.has(d)) ?? 1;
    setFormData({
      ...formData,
      assemblyDailyOverrides: [
        ...existing,
        { dayOfWeek: firstFree, startTime: undefined, duration: undefined },
      ],
    });
  };

  const removeAssemblyDailyOverride = (index: number) => {
    if (!formData) return;
    setFormData({
      ...formData,
      assemblyDailyOverrides: (formData.assemblyDailyOverrides || []).filter(
        (_, i) => i !== index
      ),
    });
  };

  const updateAssemblyDailyOverride = (
    index: number,
    field: keyof AssemblyDailyOverrideDTO,
    value: number | string | undefined
  ) => {
    if (!formData) return;
    const overrides = [...(formData.assemblyDailyOverrides || [])];
    overrides[index] = { ...overrides[index], [field]: value };
    setFormData({ ...formData, assemblyDailyOverrides: overrides });
  };

  const addAssemblyGradeOverride = () => {
    if (!formData) return;
    const grades = gradesData ?? [];
    const existing = formData.assemblyGradeOverrides || [];
    const usedGrades = new Set(existing.map((o) => o.gradeId));
    const firstFree = grades.find((g) => !usedGrades.has(getGradeOptionId(g)));
    if (!firstFree) return;
    const gradeId = getGradeOptionId(firstFree);
    setFormData({
      ...formData,
      assemblyGradeOverrides: [
        ...existing,
        { gradeId, startTime: undefined, duration: undefined },
      ],
    });
  };

  const removeAssemblyGradeOverride = (index: number) => {
    if (!formData) return;
    setFormData({
      ...formData,
      assemblyGradeOverrides: (formData.assemblyGradeOverrides || []).filter(
        (_, i) => i !== index
      ),
    });
  };

  const updateAssemblyGradeOverride = (
    index: number,
    field: keyof AssemblyGradeOverrideDTO,
    value: string | number | undefined
  ) => {
    if (!formData) return;
    const overrides = [...(formData.assemblyGradeOverrides || [])];
    overrides[index] = { ...overrides[index], [field]: value };
    setFormData({ ...formData, assemblyGradeOverrides: overrides });
  };

  const toggleWorkingDay = (day: number) => {
    if (!formData) return;
    const newDays = formData.workingDays.includes(day)
      ? formData.workingDays.filter((d) => d !== day)
      : [...formData.workingDays, day].sort();
    setFormData({ ...formData, workingDays: newDays });
  };

  const toggleAssemblyDay = (day: number) => {
    if (!formData) return;
    const currentDays = formData.assembly?.days || [];
    const newDays = currentDays.includes(day)
      ? currentDays.filter((d) => d !== day)
      : [...currentDays, day].sort();

    setFormData({
      ...formData,
      assembly: formData.assembly
        ? { ...formData.assembly, days: newDays }
        : { days: newDays, startTime: "07:30", duration: 30 },
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="relative">
          <div
            className="pointer-events-none absolute -left-20 -top-20 h-56 w-56 rounded-full bg-violet-500/10 blur-3xl"
            aria-hidden="true"
          />
          <div className="relative z-10">
            <div className="h-10 w-64 animate-pulse rounded-lg bg-white/10" />
            <div className="mt-2 h-5 w-96 animate-pulse rounded bg-white/5" />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-xl bg-white/5" />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <Card className="border border-red-500/30 bg-red-950/20">
          <CardContent className="flex items-center gap-4 p-6">
            <AlertCircle className="h-8 w-8 text-red-400" />
            <div>
              <p className="font-medium text-red-200">Failed to load settings</p>
              <p className="text-sm text-red-300/70">Please refresh the page to try again</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="relative">
        <div
          className="pointer-events-none absolute -left-20 -top-20 h-56 w-56 rounded-full bg-violet-500/10 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -right-10 top-10 h-40 w-40 rounded-full bg-purple-500/10 blur-3xl"
          aria-hidden="true"
        />

        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-violet-500/30 bg-violet-500/20">
              <Settings className="h-6 w-6 text-violet-300" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="bg-gradient-to-r from-violet-200 via-purple-200 to-fuchsia-300 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent lg:text-4xl">
                  School Settings
                </h1>
                <Badge
                  variant="outline"
                  className="border-violet-500/30 bg-violet-500/10 text-violet-300"
                >
                  <Sparkles className="mr-1 h-3 w-3" />
                  Configuration
                </Badge>
              </div>
              <p className="mt-1 text-sm text-white/60">
                Configure school-wide settings, schedules, and operational rules
              </p>
            </div>
          </div>

          <Button
            onClick={handleSave}
            disabled={updateSettings.isPending || !formData}
            className="gap-2 bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/20 hover:from-violet-600 hover:to-purple-700"
          >
            {updateSettings.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>
      <PaymentSetupEntryCard />
      {/* Tabs Navigation */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all",
                isActive
                  ? "border border-violet-500/30 bg-violet-500/20 text-violet-200 shadow-lg shadow-violet-500/10"
                  : "border border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {formData && (
        <div className="space-y-6">
          {activeTab === "schedule" && (
            <>
              {/* School Hours */}
              <Card className="border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-950/90 backdrop-blur-xl">
                <CardContent className="p-6">
                  <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
                    <Clock className="h-5 w-5 text-violet-400" />
                    School Hours
                  </h3>

                  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                    <div className="space-y-2">
                      <Label className="text-white/70">Start Time</Label>
                      <Input
                        type="time"
                        value={formData.schoolStartTime}
                        onChange={(e) =>
                          setFormData({ ...formData, schoolStartTime: e.target.value })
                        }
                        className="border-white/10 bg-white/5 text-white"
                      />
                      <p className="text-xs text-white/50">
                        {formatTime(formData.schoolStartTime)}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-white/70">End Time</Label>
                      <Input
                        type="time"
                        value={formData.schoolEndTime}
                        onChange={(e) =>
                          setFormData({ ...formData, schoolEndTime: e.target.value })
                        }
                        className="border-white/10 bg-white/5 text-white"
                      />
                      <p className="text-xs text-white/50">
                        {formatTime(formData.schoolEndTime)}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-white/70">Period Duration (min)</Label>
                      <Input
                        type="number"
                        min={15}
                        max={120}
                        value={formData.periodDuration}
                        onChange={(e) =>
                          setFormData({ ...formData, periodDuration: Number(e.target.value) })
                        }
                        className="border-white/10 bg-white/5 text-white"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-white/70">Periods Per Day</Label>
                      <Input
                        type="number"
                        min={1}
                        max={15}
                        value={formData.periodsPerDay}
                        onChange={(e) =>
                          setFormData({ ...formData, periodsPerDay: Number(e.target.value) })
                        }
                        className="border-white/10 bg-white/5 text-white"
                      />
                    </div>
                  </div>

                  {/* Working Days */}
                  <div className="mt-6">
                    <Label className="mb-3 block text-white/70">Working Days</Label>
                    <div className="flex flex-wrap gap-2">
                      {DAYS_OF_WEEK.map((day) => {
                        const isSelected = formData.workingDays.includes(day.value);
                        return (
                          <button
                            key={day.value}
                            type="button"
                            onClick={() => toggleWorkingDay(day.value)}
                            className={cn(
                              "rounded-lg px-4 py-2 text-sm font-medium transition-all",
                              isSelected
                                ? "border border-emerald-500/30 bg-emerald-500/20 text-emerald-300"
                                : "border border-white/10 bg-white/5 text-white/50 hover:bg-white/10"
                            )}
                          >
                            {day.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Per-day overrides */}
                  <div className="mt-6">
                    <button
                      type="button"
                      onClick={() => setDailyOverridesExpanded(!dailyOverridesExpanded)}
                      className="flex w-full items-center gap-2 text-left text-white/80 hover:text-white"
                    >
                      {dailyOverridesExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      <span className="font-medium">Per-day overrides</span>
                      <Badge
                        variant="outline"
                        className="border-white/20 text-xs text-white/60"
                      >
                        {(formData.dailyScheduleOverrides || []).length} set
                      </Badge>
                    </button>
                    {dailyOverridesExpanded && (
                      <div className="mt-3 space-y-3">
                        <p className="text-xs text-white/50">
                          Override start/end times for specific days (e.g., early
                          dismissal on Friday).
                        </p>
                        {(formData.dailyScheduleOverrides || []).map(
                          (override, index) => (
                            <div
                              key={index}
                              className="flex flex-wrap items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-3"
                            >
                              <div className="flex items-center gap-2">
                                <Label className="text-white/60">Day</Label>
                                <select
                                  value={override.dayOfWeek}
                                  onChange={(e) =>
                                    updateDailyOverride(
                                      index,
                                      "dayOfWeek",
                                      Number(e.target.value)
                                    )
                                  }
                                  className="rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white"
                                >
                                  {DAYS_OF_WEEK.map((d) => (
                                    <option
                                      key={d.value}
                                      value={d.value}
                                      className="bg-slate-900 text-white"
                                    >
                                      {d.label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <Input
                                type="time"
                                placeholder="Start"
                                value={override.startTime || ""}
                                onChange={(e) =>
                                  updateDailyOverride(
                                    index,
                                    "startTime",
                                    e.target.value || undefined
                                  )
                                }
                                className="w-28 border-white/10 bg-white/5 text-white"
                              />
                              <span className="text-white/50">to</span>
                              <Input
                                type="time"
                                placeholder="End"
                                value={override.endTime || ""}
                                onChange={(e) =>
                                  updateDailyOverride(
                                    index,
                                    "endTime",
                                    e.target.value || undefined
                                  )
                                }
                                className="w-28 border-white/10 bg-white/5 text-white"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removeDailyOverride(index)}
                                className="h-8 w-8 text-red-400 hover:bg-red-500/20 hover:text-red-300"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          )
                        )}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={addDailyOverride}
                          className="gap-2 border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                        >
                          <Plus className="h-4 w-4" />
                          Add day override
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Per-grade overrides */}
                  <div className="mt-6">
                    <button
                      type="button"
                      onClick={() => setGradeOverridesExpanded(!gradeOverridesExpanded)}
                      className="flex w-full items-center gap-2 text-left text-white/80 hover:text-white"
                    >
                      {gradeOverridesExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      <span className="font-medium">Per-grade overrides</span>
                      <Badge
                        variant="outline"
                        className="border-white/20 text-xs text-white/60"
                      >
                        {(formData.gradeScheduleOverrides || []).length} set
                      </Badge>
                    </button>
                    {gradeOverridesExpanded && (
                      <div className="mt-3 space-y-3">
                        <p className="text-xs text-white/50">
                          Override periods per day and period duration for
                          specific grades (e.g., primary vs secondary).
                        </p>
                        {(formData.gradeScheduleOverrides || []).map(
                          (override, index) => (
                              <div
                                key={index}
                                className="flex flex-wrap items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-3"
                              >
                                <div className="flex items-center gap-2">
                                  <Label className="text-white/60">Grade</Label>
                                  <select
                                    value={override.gradeId}
                                    onChange={(e) =>
                                      updateGradeOverride(
                                        index,
                                        "gradeId",
                                        e.target.value
                                      )
                                    }
                                    className="rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white"
                                  >
                                    {(gradesData ?? []).map((g) => {
                                      const id = getGradeOptionId(g);
                                      return (
                                        <option
                                          key={id}
                                          value={id}
                                          className="bg-slate-900 text-white"
                                        >
                                          {getGradeOptionLabel(g)}
                                        </option>
                                      );
                                    })}
                                  </select>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Label className="text-white/60">
                                    Periods
                                  </Label>
                                  <Input
                                    type="number"
                                    min={1}
                                    max={15}
                                    placeholder="Default"
                                    value={override.periodsPerDay ?? ""}
                                    onChange={(e) =>
                                      updateGradeOverride(
                                        index,
                                        "periodsPerDay",
                                        e.target.value
                                          ? Number(e.target.value)
                                          : undefined
                                      )
                                    }
                                    className="w-20 border-white/10 bg-white/5 text-white"
                                  />
                                </div>
                                <div className="flex items-center gap-2">
                                  <Label className="text-white/60">Duration</Label>
                                  <Input
                                    type="number"
                                    min={15}
                                    max={120}
                                    placeholder="Default"
                                    value={override.periodDuration ?? ""}
                                    onChange={(e) =>
                                      updateGradeOverride(
                                        index,
                                        "periodDuration",
                                        e.target.value
                                          ? Number(e.target.value)
                                          : undefined
                                      )
                                    }
                                    className="w-20 border-white/10 bg-white/5 text-white"
                                  />
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeGradeOverride(index)}
                                  className="h-8 w-8 text-red-400 hover:bg-red-500/20 hover:text-red-300"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            )
                        )}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={addGradeOverride}
                          disabled={
                            !gradesData?.length ||
                            (formData.gradeScheduleOverrides || []).length >=
                              (gradesData?.length ?? 0)
                          }
                          className="gap-2 border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                        >
                          <Plus className="h-4 w-4" />
                          Add grade override
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Break Periods */}
              <Card className="border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-950/90 backdrop-blur-xl">
                <CardContent className="p-6">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="flex items-center gap-2 text-lg font-semibold text-white">
                      <Coffee className="h-5 w-5 text-amber-400" />
                      Break Periods
                    </h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={addBreak}
                      className="gap-2 border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                    >
                      <Plus className="h-4 w-4" />
                      Add Break
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {formData.breaks.map((breakPeriod, index) => (
                      <div
                        key={index}
                        className="flex flex-wrap items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-3"
                      >
                        <Input
                          value={breakPeriod.name}
                          onChange={(e) => updateBreak(index, "name", e.target.value)}
                          placeholder="Break name"
                          className="w-40 border-white/10 bg-white/5 text-white"
                        />
                        <Input
                          type="time"
                          value={breakPeriod.startTime}
                          onChange={(e) => updateBreak(index, "startTime", e.target.value)}
                          className="w-32 border-white/10 bg-white/5 text-white"
                        />
                        <span className="text-white/50">to</span>
                        <Input
                          type="time"
                          value={breakPeriod.endTime}
                          onChange={(e) => updateBreak(index, "endTime", e.target.value)}
                          className="w-32 border-white/10 bg-white/5 text-white"
                        />
                        <label className="flex items-center gap-2 text-sm text-white/70">
                          <Checkbox
                            checked={breakPeriod.isLunch}
                            onCheckedChange={(checked) =>
                              updateBreak(index, "isLunch", checked === true)
                            }
                          />
                          Lunch
                        </label>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeBreak(index)}
                          className="ml-auto h-8 w-8 text-red-400 hover:bg-red-500/20 hover:text-red-300"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}

                    {formData.breaks.length === 0 && (
                      <p className="py-4 text-center text-sm text-white/50">
                        No break periods configured
                      </p>
                    )}

                    {/* Per-day break overrides */}
                    <div className="mt-6">
                      <button
                        type="button"
                        onClick={() => setBreakDailyExpanded(!breakDailyExpanded)}
                        className="flex w-full items-center gap-2 text-left text-white/80 hover:text-white"
                      >
                        {breakDailyExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                        <span className="font-medium">Per-day break overrides</span>
                        <Badge
                          variant="outline"
                          className="border-white/20 text-xs text-white/60"
                        >
                          {(formData.breakDailyOverrides || []).length} set
                        </Badge>
                      </button>
                      {breakDailyExpanded && (
                        <div className="mt-3 space-y-3">
                          <p className="text-xs text-white/50">
                            Override break times for specific days (e.g., earlier lunch on Friday).
                          </p>
                          {(formData.breakDailyOverrides || []).map(
                            (override, index) => (
                              <div
                                key={index}
                                className="flex flex-wrap items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-3"
                              >
                                <div className="flex items-center gap-2">
                                  <Label className="text-white/60">Day</Label>
                                  <select
                                    value={override.dayOfWeek}
                                    onChange={(e) =>
                                      updateBreakDailyOverride(
                                        index,
                                        "dayOfWeek",
                                        Number(e.target.value)
                                      )
                                    }
                                    className="rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white"
                                  >
                                    {DAYS_OF_WEEK.filter((d) =>
                                      formData.workingDays.includes(d.value)
                                    ).map((d) => (
                                      <option
                                        key={d.value}
                                        value={d.value}
                                        className="bg-slate-900 text-white"
                                      >
                                        {d.label}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Label className="text-white/60">Break</Label>
                                  <select
                                    value={override.breakName}
                                    onChange={(e) =>
                                      updateBreakDailyOverride(
                                        index,
                                        "breakName",
                                        e.target.value
                                      )
                                    }
                                    className="rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white"
                                  >
                                    {formData.breaks.map((b) => (
                                      <option
                                        key={b.name}
                                        value={b.name}
                                        className="bg-slate-900 text-white"
                                      >
                                        {b.name}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <Input
                                  type="time"
                                  placeholder="Start"
                                  value={override.startTime || ""}
                                  onChange={(e) =>
                                    updateBreakDailyOverride(
                                      index,
                                      "startTime",
                                      e.target.value || undefined
                                    )
                                  }
                                  className="w-28 border-white/10 bg-white/5 text-white"
                                />
                                <Input
                                  type="time"
                                  placeholder="End"
                                  value={override.endTime || ""}
                                  onChange={(e) =>
                                    updateBreakDailyOverride(
                                      index,
                                      "endTime",
                                      e.target.value || undefined
                                    )
                                  }
                                  className="w-28 border-white/10 bg-white/5 text-white"
                                />
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeBreakDailyOverride(index)}
                                  className="h-8 w-8 text-red-400 hover:bg-red-500/20 hover:text-red-300"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            )
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={addBreakDailyOverride}
                            disabled={
                              !formData.breaks.length ||
                              (formData.breakDailyOverrides || []).length >=
                                formData.breaks.length * formData.workingDays.length
                            }
                            className="border-amber-500/30 text-amber-300 hover:bg-amber-500/20"
                          >
                            <Plus className="mr-1 h-4 w-4" />
                            Add per-day override
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Per-grade break overrides */}
                    <div className="mt-6">
                      <button
                        type="button"
                        onClick={() => setBreakGradeExpanded(!breakGradeExpanded)}
                        className="flex w-full items-center gap-2 text-left text-white/80 hover:text-white"
                      >
                        {breakGradeExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                        <span className="font-medium">Per-grade break overrides</span>
                        <Badge
                          variant="outline"
                          className="border-white/20 text-xs text-white/60"
                        >
                          {(formData.breakGradeOverrides || []).length} set
                        </Badge>
                      </button>
                      {breakGradeExpanded && (
                        <div className="mt-3 space-y-3">
                          <p className="text-xs text-white/50">
                            Override break times for specific grades (e.g., different lunch for secondary).
                          </p>
                          {(formData.breakGradeOverrides || []).map(
                            (override, index) => (
                              <div
                                key={index}
                                className="flex flex-wrap items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-3"
                              >
                                <div className="flex items-center gap-2">
                                  <Label className="text-white/60">Grade</Label>
                                  <select
                                    value={override.gradeId}
                                    onChange={(e) =>
                                      updateBreakGradeOverride(
                                        index,
                                        "gradeId",
                                        e.target.value
                                      )
                                    }
                                    className="rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white"
                                  >
                                    {(gradesData ?? []).map((g) => {
                                      const id = getGradeOptionId(g);
                                      const label = getGradeOptionLabel(g);
                                      return (
                                        <option
                                          key={id}
                                          value={id}
                                          className="bg-slate-900 text-white"
                                        >
                                          {label}
                                        </option>
                                      );
                                    })}
                                  </select>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Label className="text-white/60">Break</Label>
                                  <select
                                    value={override.breakName}
                                    onChange={(e) =>
                                      updateBreakGradeOverride(
                                        index,
                                        "breakName",
                                        e.target.value
                                      )
                                    }
                                    className="rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white"
                                  >
                                    {formData.breaks.map((b) => (
                                      <option
                                        key={b.name}
                                        value={b.name}
                                        className="bg-slate-900 text-white"
                                      >
                                        {b.name}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <Input
                                  type="time"
                                  placeholder="Start"
                                  value={override.startTime || ""}
                                  onChange={(e) =>
                                    updateBreakGradeOverride(
                                      index,
                                      "startTime",
                                      e.target.value || undefined
                                    )
                                  }
                                  className="w-28 border-white/10 bg-white/5 text-white"
                                />
                                <Input
                                  type="time"
                                  placeholder="End"
                                  value={override.endTime || ""}
                                  onChange={(e) =>
                                    updateBreakGradeOverride(
                                      index,
                                      "endTime",
                                      e.target.value || undefined
                                    )
                                  }
                                  className="w-28 border-white/10 bg-white/5 text-white"
                                />
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeBreakGradeOverride(index)}
                                  className="h-8 w-8 text-red-400 hover:bg-red-500/20 hover:text-red-300"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            )
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={addBreakGradeOverride}
                            disabled={
                              !formData.breaks.length ||
                              !(gradesData ?? []).length ||
                              (formData.breakGradeOverrides || []).length >=
                                formData.breaks.length * (gradesData ?? []).length
                            }
                            className="border-amber-500/30 text-amber-300 hover:bg-amber-500/20"
                          >
                            <Plus className="mr-1 h-4 w-4" />
                            Add per-grade override
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Assembly */}
              <Card className="border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-950/90 backdrop-blur-xl">
                <CardContent className="p-6">
                  <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
                    <Megaphone className="h-5 w-5 text-blue-400" />
                    Assembly
                  </h3>

                  <div className="grid gap-6 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label className="text-white/70">Assembly Time</Label>
                      <Input
                        type="time"
                        value={formData.assembly?.startTime || "07:30"}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            assembly: {
                              ...(formData.assembly || { days: [], duration: 30 }),
                              startTime: e.target.value,
                            },
                          })
                        }
                        className="border-white/10 bg-white/5 text-white"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-white/70">Duration (minutes)</Label>
                      <Input
                        type="number"
                        min={5}
                        max={180}
                        value={formData.assembly?.duration || 30}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            assembly: {
                              ...(formData.assembly || { days: [], startTime: "07:30" }),
                              duration: Number(e.target.value),
                            },
                          })
                        }
                        className="border-white/10 bg-white/5 text-white"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-white/70">Location</Label>
                      <Input
                        value={formData.assembly?.location || ""}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            assembly: {
                              ...(formData.assembly || {
                                days: [],
                                startTime: "07:30",
                                duration: 30,
                              }),
                              location: e.target.value,
                            },
                          })
                        }
                        placeholder="e.g., Main Hall"
                        className="border-white/10 bg-white/5 text-white"
                      />
                    </div>
                  </div>

                  <div className="mt-4">
                    <Label className="mb-3 block text-white/70">Assembly Days</Label>
                    <div className="flex flex-wrap gap-2">
                      {DAYS_OF_WEEK.filter((d) => formData.workingDays.includes(d.value)).map(
                        (day) => {
                          const isSelected = formData.assembly?.days.includes(day.value);
                          return (
                            <button
                              key={day.value}
                              type="button"
                              onClick={() => toggleAssemblyDay(day.value)}
                              className={cn(
                                "rounded-lg px-4 py-2 text-sm font-medium transition-all",
                                isSelected
                                  ? "border border-blue-500/30 bg-blue-500/20 text-blue-300"
                                  : "border border-white/10 bg-white/5 text-white/50 hover:bg-white/10"
                              )}
                            >
                              {day.label}
                            </button>
                          );
                        }
                      )}
                    </div>
                  </div>

                  {/* Per-day assembly overrides */}
                  <div className="mt-6">
                    <button
                      type="button"
                      onClick={() => setAssemblyDailyExpanded(!assemblyDailyExpanded)}
                      className="flex w-full items-center gap-2 text-left text-white/80 hover:text-white"
                    >
                      {assemblyDailyExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      <span className="font-medium">Per-day assembly overrides</span>
                      <Badge
                        variant="outline"
                        className="border-white/20 text-xs text-white/60"
                      >
                        {(formData.assemblyDailyOverrides || []).length} set
                      </Badge>
                    </button>
                    {assemblyDailyExpanded && (
                      <div className="mt-3 space-y-3">
                        <p className="text-xs text-white/50">
                          Override assembly time/duration for specific days (e.g., shorter assembly on Friday).
                        </p>
                        {(formData.assemblyDailyOverrides || []).map(
                          (override, index) => (
                            <div
                              key={index}
                              className="flex flex-wrap items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-3"
                            >
                              <div className="flex items-center gap-2">
                                <Label className="text-white/60">Day</Label>
                                <select
                                  value={override.dayOfWeek}
                                  onChange={(e) =>
                                    updateAssemblyDailyOverride(
                                      index,
                                      "dayOfWeek",
                                      Number(e.target.value)
                                    )
                                  }
                                  className="rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white"
                                >
                                  {DAYS_OF_WEEK.filter((d) =>
                                    formData.workingDays.includes(d.value)
                                  ).map((d) => (
                                    <option
                                      key={d.value}
                                      value={d.value}
                                      className="bg-slate-900 text-white"
                                    >
                                      {d.label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <Input
                                type="time"
                                placeholder="Start"
                                value={override.startTime || ""}
                                onChange={(e) =>
                                  updateAssemblyDailyOverride(
                                    index,
                                    "startTime",
                                    e.target.value || undefined
                                  )
                                }
                                className="w-28 border-white/10 bg-white/5 text-white"
                              />
                              <Input
                                type="number"
                                min={5}
                                max={180}
                                placeholder="Duration"
                                value={override.duration ?? ""}
                                onChange={(e) =>
                                  updateAssemblyDailyOverride(
                                    index,
                                    "duration",
                                    e.target.value ? Number(e.target.value) : undefined
                                  )
                                }
                                className="w-24 border-white/10 bg-white/5 text-white"
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeAssemblyDailyOverride(index)}
                                className="h-8 w-8 text-red-400 hover:bg-red-500/20 hover:text-red-300"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          )
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={addAssemblyDailyOverride}
                          disabled={
                            (formData.assemblyDailyOverrides || []).length >=
                            formData.workingDays.length
                          }
                          className="border-blue-500/30 text-blue-300 hover:bg-blue-500/20"
                        >
                          <Plus className="mr-1 h-4 w-4" />
                          Add per-day override
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Per-grade assembly overrides */}
                  <div className="mt-6">
                    <button
                      type="button"
                      onClick={() => setAssemblyGradeExpanded(!assemblyGradeExpanded)}
                      className="flex w-full items-center gap-2 text-left text-white/80 hover:text-white"
                    >
                      {assemblyGradeExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      <span className="font-medium">Per-grade assembly overrides</span>
                      <Badge
                        variant="outline"
                        className="border-white/20 text-xs text-white/60"
                      >
                        {(formData.assemblyGradeOverrides || []).length} set
                      </Badge>
                    </button>
                    {assemblyGradeExpanded && (
                      <div className="mt-3 space-y-3">
                        <p className="text-xs text-white/50">
                          Override assembly time/duration for specific grades (e.g., later/shorter for kindergarten).
                        </p>
                        {(formData.assemblyGradeOverrides || []).map(
                          (override, index) => (
                            <div
                              key={index}
                              className="flex flex-wrap items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-3"
                            >
                              <div className="flex items-center gap-2">
                                <Label className="text-white/60">Grade</Label>
                                <select
                                  value={override.gradeId}
                                  onChange={(e) =>
                                    updateAssemblyGradeOverride(
                                      index,
                                      "gradeId",
                                      e.target.value
                                    )
                                  }
                                  className="rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white"
                                >
                                  {(gradesData ?? []).map((g) => {
                                    const id = getGradeOptionId(g);
                                    const label = getGradeOptionLabel(g);
                                    return (
                                      <option
                                        key={id}
                                        value={id}
                                        className="bg-slate-900 text-white"
                                      >
                                        {label}
                                      </option>
                                    );
                                  })}
                                </select>
                              </div>
                              <Input
                                type="time"
                                placeholder="Start"
                                value={override.startTime || ""}
                                onChange={(e) =>
                                  updateAssemblyGradeOverride(
                                    index,
                                    "startTime",
                                    e.target.value || undefined
                                  )
                                }
                                className="w-28 border-white/10 bg-white/5 text-white"
                              />
                              <Input
                                type="number"
                                min={5}
                                max={180}
                                placeholder="Duration"
                                value={override.duration ?? ""}
                                onChange={(e) =>
                                  updateAssemblyGradeOverride(
                                    index,
                                    "duration",
                                    e.target.value ? Number(e.target.value) : undefined
                                  )
                                }
                                className="w-24 border-white/10 bg-white/5 text-white"
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeAssemblyGradeOverride(index)}
                                className="h-8 w-8 text-red-400 hover:bg-red-500/20 hover:text-red-300"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          )
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={addAssemblyGradeOverride}
                          disabled={
                            !(gradesData ?? []).length ||
                            (formData.assemblyGradeOverrides || []).length >=
                              (gradesData ?? []).length
                          }
                          className="border-blue-500/30 text-blue-300 hover:bg-blue-500/20"
                        >
                          <Plus className="mr-1 h-4 w-4" />
                          Add per-grade override
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {activeTab === "attendance" && (
            <div className="space-y-4">
              <Card className="border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-950/90 backdrop-blur-xl">
                <CardContent className="p-6">
                  <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
                    <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                    Attendance Rules
                  </h3>

                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-white/70">Late Arrival Cutoff</Label>
                      <Input
                        type="time"
                        value={formData.lateArrivalCutoff}
                        onChange={(e) =>
                          setFormData({ ...formData, lateArrivalCutoff: e.target.value })
                        }
                        className="border-white/10 bg-white/5 text-white"
                      />
                      <p className="text-xs text-white/50">
                        Students arriving after this time are marked late
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-white/70">Minimum Attendance (%)</Label>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={formData.minimumAttendancePercent}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            minimumAttendancePercent: Number(e.target.value),
                          })
                        }
                        className="border-white/10 bg-white/5 text-white"
                      />
                      <p className="text-xs text-white/50">
                        Required for promotion to next grade
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between rounded-xl border border-indigo-500/20 bg-indigo-500/10 px-4 py-3">
                    <p className="text-sm text-white/80">
                      Configure promotion criteria and run previews
                    </p>
                    <Link
                      href="/admin/promotions"
                      className="text-sm font-medium text-indigo-300 hover:text-indigo-200"
                    >
                      Open Promotion Center →
                    </Link>
                  </div>
                </CardContent>
              </Card>

              <Card className="border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-950/90 backdrop-blur-xl">
                <CardContent className="p-6">
                  <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
                    <Megaphone className="h-5 w-5 text-indigo-300" />
                    Attendance Notifications
                  </h3>

                  <div className="space-y-4">
                    <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/5 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-1">
                        <Label className="text-white/80">Notify guardians</Label>
                        <p className="text-xs text-white/50">
                          Send absences and late alerts to primary guardians.
                        </p>
                      </div>
                      <Switch
                        checked={formData.attendanceNotifications.enabled}
                        onCheckedChange={(checked) =>
                          setFormData({
                            ...formData,
                            attendanceNotifications: {
                              ...formData.attendanceNotifications,
                              enabled: checked,
                            },
                          })
                        }
                      />
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      {[
                        { key: "whatsapp", label: "WhatsApp" },
                        { key: "sms", label: "SMS" },
                        { key: "email", label: "Email" },
                      ].map((channel) => (
                        <div
                          key={channel.key}
                          className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3"
                        >
                          <Label className="text-sm text-white/70">{channel.label}</Label>
                          <Switch
                            checked={
                              formData.attendanceNotifications.channels[channel.key as keyof typeof formData.attendanceNotifications.channels]
                            }
                            onCheckedChange={(checked) =>
                              setFormData({
                                ...formData,
                                attendanceNotifications: {
                                  ...formData.attendanceNotifications,
                                  channels: {
                                    ...formData.attendanceNotifications.channels,
                                    [channel.key]: checked,
                                  },
                                },
                              })
                            }
                            disabled={!formData.attendanceNotifications.enabled}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === "academic" && (
            <Card className="border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-950/90 backdrop-blur-xl">
              <CardContent className="p-6">
                <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
                  <Calendar className="h-5 w-5 text-purple-400" />
                  Academic Calendar Defaults
                </h3>

                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-white/70">Default Exam Week Duration (days)</Label>
                    <Input
                      type="number"
                      min={1}
                      max={21}
                      value={formData.defaultExamWeekDuration}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          defaultExamWeekDuration: Number(e.target.value),
                        })
                      }
                      className="border-white/10 bg-white/5 text-white"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-white/70">Default Revision Week Duration (days)</Label>
                    <Input
                      type="number"
                      min={1}
                      max={14}
                      value={formData.defaultRevisionWeekDuration}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          defaultRevisionWeekDuration: Number(e.target.value),
                        })
                      }
                      className="border-white/10 bg-white/5 text-white"
                    />
                  </div>
                </div>

                <div className="mt-6 rounded-lg border border-amber-500/20 bg-amber-500/10 p-4">
                  <p className="text-sm text-amber-200">
                    <strong>Note:</strong> These are default values used when creating new academic
                    periods. You can customize dates for each term individually in the Academic
                    Periods page.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === "features" && (
            <Card className="border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-950/90 backdrop-blur-xl">
              <CardContent className="p-6">
                <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
                  <Sparkles className="h-5 w-5 text-indigo-400" />
                  Feature Toggles
                </h3>

                <div className="space-y-4">
                  <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/5 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                      <Label className="flex items-center gap-2 text-white/80">
                        <ClipboardCheck className="h-4 w-4 text-indigo-300" />
                        Teacher Studio
                      </Label>
                      <p className="text-xs text-white/50">
                        Enable assignments, submissions, and rubrics for teachers.
                      </p>
                    </div>
                    <Switch
                      checked={formData.teacherStudio.enabled}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, teacherStudio: { enabled: checked } })
                      }
                    />
                  </div>

                  <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/5 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                      <Label className="flex items-center gap-2 text-white/80">
                        <Wifi className="h-4 w-4 text-emerald-300" />
                        Offline Mode (PWA)
                      </Label>
                      <p className="text-xs text-white/50">
                        Allow offline caching and background sync for teacher workflows.
                      </p>
                    </div>
                    <Switch
                      checked={formData.offlineMode.enabled}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, offlineMode: { enabled: checked } })
                      }
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
