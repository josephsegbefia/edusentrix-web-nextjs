"use client";

import * as React from "react";
import {
  AlertCircle,
  Bell,
  CheckCircle2,
  Loader2,
  Save,
  Settings,
  ShieldCheck,
  Sparkles,
  User,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  useTeacherSettings,
  useUpdateTeacherSettings,
  type UpdateTeacherSettingsInput,
} from "@/hooks/teacher/useTeacherSettings";
import { useBusyToast } from "@/hooks/useBusyToast";

type SettingsTab = "notifications" | "profile";

const TABS: Array<{ id: SettingsTab; label: string; icon: React.ElementType }> = [
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "profile", label: "Profile", icon: User },
];

type FormState = {
  locale: string;
  timezone: string;
  notifications: {
    inApp: {
      messages: boolean;
      notices: boolean;
      submissions: boolean;
      escalations: boolean;
      reminders: boolean;
    };
    email: {
      weeklyDigest: boolean;
      urgentOnly: boolean;
    };
  };
};

function SettingsSwitch({
  className,
  ...props
}: React.ComponentProps<typeof Switch>) {
  return (
    <Switch
      className={cn(
        "data-[state=unchecked]:border-white/25 data-[state=unchecked]:bg-white/10 data-[state=checked]:border-emerald-300/40 data-[state=checked]:bg-emerald-500/80 focus-visible:ring-emerald-300/35 focus-visible:border-emerald-300/40 shadow-none",
        className
      )}
      {...props}
    />
  );
}

export default function TeacherSettingsPage() {
  const [activeTab, setActiveTab] = React.useState<SettingsTab>("notifications");
  const { data, isLoading, isError } = useTeacherSettings();
  const updateSettings = useUpdateTeacherSettings();
  const busy = useBusyToast();

  const [formData, setFormData] = React.useState<FormState | null>(null);

  React.useEffect(() => {
    if (!data?.data || formData) return;
    setFormData({
      locale: data.data.locale,
      timezone: data.data.timezone,
      notifications: {
        inApp: { ...data.data.notifications.inApp },
        email: { ...data.data.notifications.email },
      },
    });
  }, [data, formData]);

  const handleSave = async () => {
    if (!formData) return;

    const payload: UpdateTeacherSettingsInput = {
      locale: formData.locale,
      timezone: formData.timezone,
      notifications: formData.notifications,
    };

    try {
      await busy.promise(updateSettings.mutateAsync(payload), {
        loading: "Saving settings...",
        success: "Settings saved",
        error: (error: Error) => error.message || "Failed to save settings",
      });
    } catch {
      // handled by toast
    }
  };

  if (isLoading || !formData) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <div className="h-10 w-64 animate-pulse rounded-lg bg-white/10" />
          <div className="h-5 w-96 animate-pulse rounded bg-white/5" />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div key={idx} className="h-36 animate-pulse rounded-xl bg-white/5" />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !data?.data) {
    return (
      <Card className="border border-red-500/30 bg-red-950/20">
        <CardContent className="flex items-center gap-4 p-6">
          <AlertCircle className="h-8 w-8 text-red-400" />
          <div>
            <p className="font-medium text-red-200">Failed to load settings</p>
            <p className="text-sm text-red-300/70">Please refresh the page to try again.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="relative">
        <div
          className="pointer-events-none absolute -left-20 -top-20 h-56 w-56 rounded-full bg-emerald-500/10 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -right-10 top-10 h-40 w-40 rounded-full bg-cyan-500/10 blur-3xl"
          aria-hidden="true"
        />

        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/20">
              <Settings className="h-6 w-6 text-emerald-300" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="bg-gradient-to-r from-emerald-200 via-cyan-200 to-teal-300 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent lg:text-4xl">
                  Teacher Settings
                </h1>
                <Badge
                  variant="outline"
                  className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                >
                  <Sparkles className="mr-1 h-3 w-3" />
                  Preferences
                </Badge>
              </div>
              <p className="mt-1 text-sm text-white/60">
                Configure notification delivery and regional preferences used across web and companion app experiences.
              </p>
            </div>
          </div>

          <Button
            onClick={() => void handleSave()}
            disabled={updateSettings.isPending}
            className="gap-2 bg-gradient-to-r from-emerald-500 to-cyan-600 text-white shadow-lg shadow-emerald-500/20 hover:from-emerald-600 hover:to-cyan-700"
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
                  ? "border border-emerald-500/30 bg-emerald-500/20 text-emerald-200 shadow-lg shadow-emerald-500/10"
                  : "border border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "notifications" && (
        <div className="space-y-4">
          <Card className="border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-950/90 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-lg text-white">In-app notifications</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              {[
                { key: "messages", label: "Messages", desc: "Conversation and thread updates." },
                { key: "notices", label: "Notices", desc: "Notice publish and audience updates." },
                { key: "submissions", label: "Submissions", desc: "New and late submission alerts." },
                { key: "escalations", label: "Escalations", desc: "Escalation workflow updates." },
                { key: "reminders", label: "Reminders", desc: "Task and follow-up reminders." },
              ].map((item) => (
                <div
                  key={item.key}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3"
                >
                  <div>
                    <Label className="text-white/80">{item.label}</Label>
                    <p className="text-xs text-white/45">{item.desc}</p>
                  </div>
                  <SettingsSwitch
                    checked={
                      formData.notifications.inApp[
                        item.key as keyof FormState["notifications"]["inApp"]
                      ]
                    }
                    onCheckedChange={(checked) =>
                      setFormData((prev) =>
                        prev
                          ? {
                              ...prev,
                              notifications: {
                                ...prev.notifications,
                                inApp: {
                                  ...prev.notifications.inApp,
                                  [item.key]: checked,
                                },
                              },
                            }
                          : prev
                      )
                    }
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-950/90 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-lg text-white">Email preferences</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                <div>
                  <Label className="text-white/80">Urgent only</Label>
                  <p className="text-xs text-white/45">Limit email to high-priority events.</p>
                </div>
                <SettingsSwitch
                  checked={formData.notifications.email.urgentOnly}
                  onCheckedChange={(checked) =>
                    setFormData((prev) =>
                      prev
                        ? {
                            ...prev,
                            notifications: {
                              ...prev.notifications,
                              email: {
                                ...prev.notifications.email,
                                urgentOnly: checked,
                              },
                            },
                          }
                        : prev
                    )
                  }
                />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "profile" && (
        <div className="space-y-4">
          <Card className="border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-950/90 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg text-white">
                <ShieldCheck className="h-5 w-5 text-cyan-300" />
                Account Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-white/70">Display name</Label>
                <Input value={data.data.account.displayName} readOnly className="border-white/10 bg-white/5 text-white/80" />
              </div>
              <div className="space-y-2">
                <Label className="text-white/70">Email</Label>
                <Input value={data.data.account.email} readOnly className="border-white/10 bg-white/5 text-white/80" />
              </div>
              <div className="space-y-2">
                <Label className="text-white/70">Timezone</Label>
                <Input
                  value={formData.timezone}
                  onChange={(event) =>
                    setFormData((prev) => (prev ? { ...prev, timezone: event.target.value } : prev))
                  }
                  placeholder="e.g. Africa/Accra"
                  className="border-white/10 bg-white/5 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-white/70">Locale</Label>
                <Input
                  value={formData.locale}
                  onChange={(event) =>
                    setFormData((prev) => (prev ? { ...prev, locale: event.target.value } : prev))
                  }
                  placeholder="e.g. en-GH"
                  className="border-white/10 bg-white/5 text-white"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-950/90 backdrop-blur-xl">
            <CardContent className="p-6">
              <p className="text-sm text-white/65">
                This page focuses on settings that are currently enforced: app notification
                categories, email behavior, locale, and timezone. Advanced policy controls remain at admin level.
              </p>
              <div className="mt-3 flex items-center gap-2 text-xs text-white/45">
                <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                Last server update: {data.data.updatedAt ? new Date(data.data.updatedAt).toLocaleString() : "Not yet saved"}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
