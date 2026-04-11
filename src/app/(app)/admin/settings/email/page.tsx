"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  Mail,
  Bell,
  BellOff,
  Clock,
  Sparkles,
  Loader2,
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  BookOpen,
  Receipt,
  Megaphone,
  UserCheck,
  FileText,
  MessageSquare,
} from "lucide-react";
import Link from "next/link";
import {
  useEmailPreferences,
  useUpdateEmailPreferences,
  type EmailPreferenceDTO,
} from "@/hooks/admin/useEmailPreferences";

const CATEGORY_OPTIONS: {
  key: string;
  label: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  {
    key: "attendance",
    label: "Attendance",
    description: "Daily attendance alerts and absence notifications",
    icon: <UserCheck className="h-4 w-4" />,
  },
  {
    key: "academics",
    label: "Academics",
    description: "Grade reports, assessment results, and academic progress",
    icon: <BookOpen className="h-4 w-4" />,
  },
  {
    key: "announcements",
    label: "Announcements",
    description: "School-wide announcements and news",
    icon: <Megaphone className="h-4 w-4" />,
  },
  {
    key: "billingReminders",
    label: "Billing & Fees",
    description: "Fee reminders, payment confirmations, and invoices",
    icon: <Receipt className="h-4 w-4" />,
  },
  {
    key: "manualMessages",
    label: "Manual Messages",
    description: "Direct messages from school administrators",
    icon: <MessageSquare className="h-4 w-4" />,
  },
  {
    key: "lessonNoteReview",
    label: "Lesson Notes",
    description: "Lesson note submissions and review notifications",
    icon: <FileText className="h-4 w-4" />,
  },
];

type FormState = {
  channels: NonNullable<EmailPreferenceDTO["channels"]>;
  email: NonNullable<EmailPreferenceDTO["email"]>;
};

function buildForm(pref: EmailPreferenceDTO | null): FormState {
  return {
    channels: {
      email: pref?.channels?.email ?? true,
      inApp: pref?.channels?.inApp ?? true,
      whatsapp: pref?.channels?.whatsapp ?? false,
      sms: pref?.channels?.sms ?? false,
    },
    email: {
      immediate: {
        attendance: pref?.email?.immediate?.attendance ?? true,
        academics: pref?.email?.immediate?.academics ?? true,
        announcements: pref?.email?.immediate?.announcements ?? true,
        billingReminders: pref?.email?.immediate?.billingReminders ?? true,
        manualMessages: pref?.email?.immediate?.manualMessages ?? true,
        lessonNoteReview: pref?.email?.immediate?.lessonNoteReview ?? true,
      },
      digest: {
        daily: pref?.email?.digest?.daily ?? false,
        weekly: pref?.email?.digest?.weekly ?? true,
      },
      urgentOnly: pref?.email?.urgentOnly ?? false,
      quietHours: {
        enabled: pref?.email?.quietHours?.enabled ?? false,
        startTime: pref?.email?.quietHours?.startTime ?? "22:00",
        endTime: pref?.email?.quietHours?.endTime ?? "07:00",
      },
      optOutCategories: pref?.email?.optOutCategories ?? [],
    },
  };
}

export default function EmailPreferencesPage() {
  const { data, isLoading, isError } = useEmailPreferences();
  const updatePreferences = useUpdateEmailPreferences();
  const [form, setForm] = React.useState<FormState | null>(null);
  const [saved, setSaved] = React.useState(false);

  React.useEffect(() => {
    if (data && !form) {
      setForm(buildForm(data.data));
    }
  }, [data, form]);

  const handleSave = async () => {
    if (!form) return;
    try {
      await updatePreferences.mutateAsync({
        channels: form.channels,
        email: form.email,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      // handled by mutation state
    }
  };

  const toggleCategory = (key: string) => {
    if (!form) return;
    const immediateKey = key as keyof NonNullable<
      FormState["email"]["immediate"]
    >;
    setForm({
      ...form,
      email: {
        ...form.email,
        immediate: {
          ...form.email.immediate,
          [immediateKey]: !form.email.immediate?.[immediateKey],
        },
      },
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="relative">
          <div
            className="pointer-events-none absolute -left-20 -top-20 h-56 w-56 rounded-full bg-blue-500/10 blur-3xl"
            aria-hidden="true"
          />
          <div className="relative z-10">
            <div className="h-10 w-64 animate-pulse rounded-lg bg-white/10" />
            <div className="mt-2 h-5 w-96 animate-pulse rounded bg-white/5" />
          </div>
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-xl bg-white/5"
            />
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
              <p className="font-medium text-red-200">
                Failed to load preferences
              </p>
              <p className="text-sm text-red-300/70">
                Please refresh the page to try again
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative">
        <div
          className="pointer-events-none absolute -left-20 -top-20 h-56 w-56 rounded-full bg-blue-500/10 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -right-10 top-10 h-40 w-40 rounded-full bg-cyan-500/10 blur-3xl"
          aria-hidden="true"
        />

        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <Link
              href="/admin/settings"
              className="mt-1.5 rounded-lg p-1.5 text-white/40 transition-colors hover:bg-white/5 hover:text-white"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-blue-500/30 bg-blue-500/20">
              <Bell className="h-6 w-6 text-blue-300" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="bg-linear-to-r from-blue-200 via-cyan-200 to-teal-300 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent lg:text-4xl">
                  Email Preferences
                </h1>
                <Badge
                  variant="outline"
                  className="border-blue-500/30 bg-blue-500/10 text-blue-300"
                >
                  <Sparkles className="mr-1 h-3 w-3" />
                  Notifications
                </Badge>
              </div>
              <p className="mt-1 text-sm text-white/60">
                Control which emails you receive and how they are delivered
              </p>
            </div>
          </div>

          <Button
            onClick={handleSave}
            disabled={updatePreferences.isPending || !form}
            className="gap-2 bg-linear-to-r from-blue-500 to-cyan-600 text-white shadow-lg shadow-blue-500/20 hover:from-blue-600 hover:to-cyan-700"
          >
            {updatePreferences.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : saved ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <Mail className="h-4 w-4" />
            )}
            {saved ? "Saved" : "Save Preferences"}
          </Button>
        </div>
      </div>

      {updatePreferences.isError && (
        <Card className="border border-red-500/30 bg-red-950/20">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <p className="text-sm text-red-300">
              {updatePreferences.error?.message || "Failed to save preferences"}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Channel Toggles */}
      <Card className="border border-white/10 bg-linear-to-br from-slate-900/80 to-slate-950/90 backdrop-blur-xl">
        <CardContent className="p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">
            Notification Channels
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {(
              [
                { key: "email", label: "Email", desc: "Receive email notifications" },
                { key: "inApp", label: "In-App", desc: "Show in-app notifications" },
              ] as const
            ).map((ch) => (
              <div
                key={ch.key}
                className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-4"
              >
                <div>
                  <p className="text-sm font-medium text-white">{ch.label}</p>
                  <p className="text-xs text-white/40">{ch.desc}</p>
                </div>
                <Switch
                  checked={form?.channels?.[ch.key] ?? true}
                  onCheckedChange={(val) =>
                    form &&
                    setForm({
                      ...form,
                      channels: { ...form.channels, [ch.key]: val },
                    })
                  }
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Category Subscriptions */}
      <Card className="border border-white/10 bg-linear-to-br from-slate-900/80 to-slate-950/90 backdrop-blur-xl">
        <CardContent className="p-6">
          <h2 className="mb-1 text-lg font-semibold text-white">
            Email Categories
          </h2>
          <p className="mb-4 text-sm text-white/40">
            Toggle individual email categories on or off
          </p>
          <div className="space-y-3">
            {CATEGORY_OPTIONS.map((cat) => {
              const enabled =
                form?.email?.immediate?.[
                  cat.key as keyof NonNullable<
                    FormState["email"]["immediate"]
                  >
                ] ?? true;
              return (
                <button
                  key={cat.key}
                  onClick={() => toggleCategory(cat.key)}
                  className={cn(
                    "flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-colors",
                    enabled
                      ? "border-emerald-500/20 bg-emerald-500/5"
                      : "border-white/10 bg-white/5",
                  )}
                >
                  <div
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-lg",
                      enabled
                        ? "bg-emerald-500/20 text-emerald-300"
                        : "bg-white/10 text-white/40",
                    )}
                  >
                    {cat.icon}
                  </div>
                  <div className="flex-1">
                    <p
                      className={cn(
                        "text-sm font-medium",
                        enabled ? "text-white" : "text-white/60",
                      )}
                    >
                      {cat.label}
                    </p>
                    <p className="text-xs text-white/40">{cat.description}</p>
                  </div>
                  {enabled ? (
                    <Bell className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <BellOff className="h-4 w-4 text-white/30" />
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Digest & Quiet Hours */}
      <Card className="border border-white/10 bg-linear-to-br from-slate-900/80 to-slate-950/90 backdrop-blur-xl">
        <CardContent className="p-6 space-y-6">
          <div>
            <h2 className="mb-4 text-lg font-semibold text-white">
              Digest Settings
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-4">
                <div>
                  <p className="text-sm font-medium text-white">
                    Daily Digest
                  </p>
                  <p className="text-xs text-white/40">
                    Summary of the day&apos;s activity each morning
                  </p>
                </div>
                <Switch
                  checked={form?.email?.digest?.daily ?? false}
                  onCheckedChange={(val) =>
                    form &&
                    setForm({
                      ...form,
                      email: {
                        ...form.email,
                        digest: { ...form.email.digest, daily: val },
                      },
                    })
                  }
                />
              </div>
              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-4">
                <div>
                  <p className="text-sm font-medium text-white">
                    Weekly Digest
                  </p>
                  <p className="text-xs text-white/40">
                    Weekly activity summary every Monday
                  </p>
                </div>
                <Switch
                  checked={form?.email?.digest?.weekly ?? true}
                  onCheckedChange={(val) =>
                    form &&
                    setForm({
                      ...form,
                      email: {
                        ...form.email,
                        digest: { ...form.email.digest, weekly: val },
                      },
                    })
                  }
                />
              </div>
            </div>
          </div>

          <div className="border-t border-white/10 pt-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Clock className="h-5 w-5 text-blue-300" />
                  Quiet Hours
                </h2>
                <p className="text-sm text-white/40">
                  Pause non-urgent emails during these hours
                </p>
              </div>
              <Switch
                checked={form?.email?.quietHours?.enabled ?? false}
                onCheckedChange={(val) =>
                  form &&
                  setForm({
                    ...form,
                    email: {
                      ...form.email,
                      quietHours: { ...form.email.quietHours!, enabled: val },
                    },
                  })
                }
              />
            </div>

            {form?.email?.quietHours?.enabled && (
              <div className="flex items-center gap-4">
                <div className="space-y-1">
                  <Label className="text-xs text-white/50">From</Label>
                  <Input
                    type="time"
                    value={form.email.quietHours.startTime ?? "22:00"}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        email: {
                          ...form.email,
                          quietHours: {
                            ...form.email.quietHours!,
                            startTime: e.target.value,
                          },
                        },
                      })
                    }
                    className="w-32 border-white/10 bg-white/5 text-white"
                  />
                </div>
                <span className="mt-5 text-white/30">to</span>
                <div className="space-y-1">
                  <Label className="text-xs text-white/50">Until</Label>
                  <Input
                    type="time"
                    value={form.email.quietHours.endTime ?? "07:00"}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        email: {
                          ...form.email,
                          quietHours: {
                            ...form.email.quietHours!,
                            endTime: e.target.value,
                          },
                        },
                      })
                    }
                    className="w-32 border-white/10 bg-white/5 text-white"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Urgent Only Toggle */}
          <div className="border-t border-white/10 pt-6">
            <div className="flex items-center justify-between rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
              <div>
                <p className="text-sm font-medium text-amber-200">
                  Urgent Only Mode
                </p>
                <p className="text-xs text-amber-300/50">
                  Only receive critical and transactional emails
                </p>
              </div>
              <Switch
                checked={form?.email?.urgentOnly ?? false}
                onCheckedChange={(val) =>
                  form &&
                  setForm({
                    ...form,
                    email: { ...form.email, urgentOnly: val },
                  })
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
