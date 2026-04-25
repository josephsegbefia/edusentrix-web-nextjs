// src/app/(app)/admin/settings/page.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { SchoolIdentitySettingsCard } from "@/components/admin/settings/SchoolIdentitySettingsCard";
import {
  Settings,
  Calendar,
  Users,
  Save,
  Loader2,
  AlertCircle,
  Megaphone,
  CheckCircle2,
  Sparkles,
  ClipboardCheck,
  Wifi,
  Landmark,
  ArrowRight,
  Building2,
  Clock,
  Globe,
} from "lucide-react";
import {
  useSchoolSettings,
  useUpdateSchoolSettings,
  type AssemblyConfigDTO,
  type AssemblyDailyOverrideDTO,
  type AssemblyGradeOverrideDTO,
  type SchoolSettingsDTO,
} from "@/hooks/admin/useSchoolSettings";
import { useSchoolPaymentSetup } from "@/hooks/admin/useSchoolPaymentSetup";
import { useBusyToast } from "@/hooks/useBusyToast";
import { SchoolDailySchedulePanel } from "@/components/admin/settings/school-daily/SchoolDailySchedulePanel";
import { SchoolTimeZoneSettingsCard } from "@/components/admin/settings/SchoolTimeZoneSettingsCard";
import { SchoolLeoSettingsCard } from "@/components/admin/settings/SchoolLeoSettingsCard";

type SettingsTab = "school" | "attendance" | "academic" | "features" | "dailySchedule" | "regional";

const TABS: Array<{ id: SettingsTab; label: string; icon: React.ElementType }> = [
  { id: "school", label: "School & billing", icon: Building2 },
  { id: "attendance", label: "Attendance", icon: Users },
  { id: "academic", label: "Academic Calendar", icon: Calendar },
  { id: "regional", label: "Time zone", icon: Globe },
  { id: "dailySchedule", label: "Daily schedules", icon: Clock },
  { id: "features", label: "Features", icon: Sparkles },
];

const VALID_SETTINGS_TABS: SettingsTab[] = [
  "school",
  "attendance",
  "academic",
  "regional",
  "features",
  "dailySchedule",
];

function tabFromSearchParam(raw: string | null): SettingsTab {
  if (raw === "schedule") return "school";
  if (raw === "daily" || raw === "dailySchedule") return "dailySchedule";
  if (raw === "timezone" || raw === "regional" || raw === "timeZone") return "regional";
  if (raw && VALID_SETTINGS_TABS.includes(raw as SettingsTab)) {
    return raw as SettingsTab;
  }
  return "school";
}

type SettingsFormData = {
  assembly: AssemblyConfigDTO | null;
  lateArrivalCutoff: string;
  minimumAttendancePercent: number;
  defaultExamWeekDuration: number;
  defaultRevisionWeekDuration: number;
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
  assemblyDailyOverrides: AssemblyDailyOverrideDTO[];
  assemblyGradeOverrides: AssemblyGradeOverrideDTO[];
};

function buildSettingsFormData(settings: SchoolSettingsDTO): SettingsFormData {
  return {
    assembly: settings.assembly,
    lateArrivalCutoff: settings.lateArrivalCutoff || "",
    minimumAttendancePercent: settings.minimumAttendancePercent,
    defaultExamWeekDuration: settings.defaultExamWeekDuration,
    defaultRevisionWeekDuration: settings.defaultRevisionWeekDuration,
    teacherStudio: settings.teacherStudio || { enabled: true },
    attendanceNotifications: settings.attendanceNotifications || {
      enabled: true,
      channels: { whatsapp: true, sms: false, email: false },
    },
    offlineMode: settings.offlineMode || { enabled: true },
    assemblyDailyOverrides: settings.assemblyDailyOverrides || [],
    assemblyGradeOverrides: settings.assemblyGradeOverrides || [],
  };
}

function mergeOperationalFields(
  current: SettingsFormData,
  next: SettingsFormData
): SettingsFormData {
  return {
    ...current,
    assembly: next.assembly,
    lateArrivalCutoff: next.lateArrivalCutoff,
    minimumAttendancePercent: next.minimumAttendancePercent,
    defaultExamWeekDuration: next.defaultExamWeekDuration,
    defaultRevisionWeekDuration: next.defaultRevisionWeekDuration,
    teacherStudio: next.teacherStudio,
    attendanceNotifications: next.attendanceNotifications,
    offlineMode: next.offlineMode,
    assemblyDailyOverrides: next.assemblyDailyOverrides,
    assemblyGradeOverrides: next.assemblyGradeOverrides,
  };
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

function SettingsPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const activeTab = React.useMemo(
    () => tabFromSearchParam(searchParams.get("tab")),
    [searchParams]
  );
  const selectTab = React.useCallback(
    (tab: SettingsTab) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", tab);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );
  const { data, isLoading, isError } = useSchoolSettings();
  const updateSettings = useUpdateSchoolSettings();
  const busy = useBusyToast();
  const serverFormData = React.useMemo(
    () => (data?.data ? buildSettingsFormData(data.data) : null),
    [data]
  );

  // Local form state
  const [formData, setFormData] = React.useState<SettingsFormData | null>(null);
  const [isOperationalDirty, setIsOperationalDirty] = React.useState(false);

  // Keep local form state aligned with fresh server data while preserving unsaved edits.
  React.useEffect(() => {
    if (!serverFormData) return;
    setFormData((current) => {
      if (!current) return serverFormData;
      if (!isOperationalDirty) {
        return mergeOperationalFields(current, serverFormData);
      }
      return current;
    });
  }, [isOperationalDirty, serverFormData]);

  const updateOperationalForm = React.useCallback(
    (updater: (current: SettingsFormData) => SettingsFormData) => {
      setFormData((current) => (current ? updater(current) : current));
      setIsOperationalDirty(true);
    },
    []
  );

  const handleSaveOperational = async () => {
    if (!formData) return;
    const payload = {
      assembly: formData.assembly,
      assemblyDailyOverrides: formData.assemblyDailyOverrides,
      assemblyGradeOverrides: formData.assemblyGradeOverrides,
      lateArrivalCutoff: formData.lateArrivalCutoff || null,
      minimumAttendancePercent: formData.minimumAttendancePercent,
      defaultExamWeekDuration: formData.defaultExamWeekDuration,
      defaultRevisionWeekDuration: formData.defaultRevisionWeekDuration,
      teacherStudio: formData.teacherStudio,
      attendanceNotifications: formData.attendanceNotifications,
      offlineMode: formData.offlineMode,
    };
    try {
      const response = await busy.promise(updateSettings.mutateAsync(payload), {
        loading: "Saving settings...",
        success: "Settings saved successfully!",
        error: (e: Error) => e.message || "Failed to save settings",
      });
      const nextFormData = buildSettingsFormData(response.data);
      setFormData((current) =>
        current ? mergeOperationalFields(current, nextFormData) : nextFormData
      );
      setIsOperationalDirty(false);
    } catch {
      // Error handled by toast
    }
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
                Configure school-wide operational rules and feature preferences
              </p>
            </div>
          </div>

          {["attendance", "academic", "features"].includes(activeTab) && (
            <Button
              type="button"
              onClick={handleSaveOperational}
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
                  Save changes
                </>
              )}
            </Button>
          )}
        </div>
      </div>
      {/* Tabs Navigation */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => selectTab(tab.id)}
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

      {activeTab === "regional" && <SchoolTimeZoneSettingsCard />}

      {/* Tab Content */}
      {formData && (
        <div className="space-y-6">
          {activeTab === "school" && (
            <div className="space-y-4">
              <SchoolIdentitySettingsCard />
              <PaymentSetupEntryCard />
            </div>
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
                          updateOperationalForm((current) => ({
                            ...current,
                            lateArrivalCutoff: e.target.value,
                          }))
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
                          updateOperationalForm((current) => ({
                            ...current,
                            minimumAttendancePercent: Number(e.target.value),
                          }))
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
                          updateOperationalForm((current) => ({
                            ...current,
                            attendanceNotifications: {
                              ...current.attendanceNotifications,
                              enabled: checked,
                            },
                          }))
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
                              updateOperationalForm((current) => ({
                                ...current,
                                attendanceNotifications: {
                                  ...current.attendanceNotifications,
                                  channels: {
                                    ...current.attendanceNotifications.channels,
                                    [channel.key]: checked,
                                  },
                                },
                              }))
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
                        updateOperationalForm((current) => ({
                          ...current,
                          defaultExamWeekDuration: Number(e.target.value),
                        }))
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
                        updateOperationalForm((current) => ({
                          ...current,
                          defaultRevisionWeekDuration: Number(e.target.value),
                        }))
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

          {activeTab === "dailySchedule" && <SchoolDailySchedulePanel />}

          {activeTab === "features" && (
            <>
            <SchoolLeoSettingsCard />
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
                        updateOperationalForm((current) => ({
                          ...current,
                          teacherStudio: { enabled: checked },
                        }))
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
                        updateOperationalForm((current) => ({
                          ...current,
                          offlineMode: { enabled: checked },
                        }))
                      }
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  return (
    <React.Suspense
      fallback={
        <div className="p-6 text-sm text-white/60">Loading settings…</div>
      }
    >
      <SettingsPageContent />
    </React.Suspense>
  );
}
