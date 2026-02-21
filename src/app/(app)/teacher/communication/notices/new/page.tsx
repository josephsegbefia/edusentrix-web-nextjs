"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarDays, Megaphone, Users } from "lucide-react";
import { useTeacherClasses } from "@/hooks/teacher/useTeacherClasses";
import { useClassRoster } from "@/hooks/teacher/useClassRoster";
import { useTeacherContext } from "@/hooks/teacher/useTeacherContext";
import { useBusyToast } from "@/hooks/useBusyToast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import {
  PremiumDropdownMenu,
  PremiumDropdownMenuCheckboxItem,
  PremiumDropdownMenuContent,
  PremiumDropdownMenuLabel,
  PremiumDropdownMenuTrigger,
} from "@/components/ui/premium-dropdown-menu";
import { CustomDatePicker } from "@/components/ui/custom-date-picker";
import { can } from "@/lib/auth/can";
import { PERMISSIONS, type Permission } from "@/lib/rbac";
import { cn } from "@/lib/utils";

const audienceOptions = [
  { value: "class", label: "Class groups" },
  { value: "subject", label: "Subject-wide" },
  { value: "custom", label: "Custom students" },
  { value: "school", label: "School-wide" },
] as const;

type Audience = (typeof audienceOptions)[number]["value"];

type NoticeForm = {
  title: string;
  message: string;
  audience: Audience;
  classGroupIds: string[];
  subjectIds: string[];
  targetStudentIds: string[];
  schedule: boolean;
  scheduledFor: Date | null;
};

function toggleSelection(ids: string[], id: string) {
  if (ids.includes(id)) {
    return ids.filter((value) => value !== id);
  }
  return [...ids, id];
}

export default function NewTeacherNoticePage() {
  const router = useRouter();
  const busyToast = useBusyToast();
  const { data: contextData } = useTeacherContext();
  const permissions = contextData?.data.permissions as Permission[] | undefined;
  const canPublish = can(permissions, PERMISSIONS.noticesPublish);

  const { data: classesData } = useTeacherClasses();
  const classes = React.useMemo(
    () => classesData?.data.classes || [],
    [classesData?.data.classes]
  );

  const [form, setForm] = React.useState<NoticeForm>({
    title: "",
    message: "",
    audience: "class",
    classGroupIds: [],
    subjectIds: [],
    targetStudentIds: [],
    schedule: false,
    scheduledFor: null,
  });

  const classOptions = React.useMemo(() => {
    const map = new Map<string, string>();
    classes.forEach((cls) => {
      if (cls._id && cls.name) map.set(cls._id, cls.name);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [classes]);

  const subjectOptions = React.useMemo(() => {
    const map = new Map<string, string>();
    classes.forEach((cls) => {
      if (cls.subjectId && cls.subjectName) map.set(cls.subjectId, cls.subjectName);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [classes]);

  const customClassId = form.classGroupIds[0] || classOptions[0]?.id;
  const { data: rosterData } = useClassRoster(form.audience === "custom" ? customClassId : undefined);
  const roster = rosterData?.data.students || [];

  const update = (patch: Partial<NoticeForm>) => setForm((prev) => ({ ...prev, ...patch }));

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.message.trim()) {
      busyToast.error("Title and message are required");
      return;
    }

    if (form.audience === "class" && form.classGroupIds.length === 0) {
      busyToast.error("Select at least one class group");
      return;
    }
    if (form.audience === "subject" && form.subjectIds.length === 0) {
      busyToast.error("Select at least one subject");
      return;
    }
    if (form.audience === "custom" && form.targetStudentIds.length === 0) {
      busyToast.error("Select students to notify");
      return;
    }

    await busyToast.promise(
      fetch("/api/teacher/notices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          message: form.message.trim(),
          audience: form.audience,
          classGroupIds: form.audience === "class" ? form.classGroupIds : [],
          subjectIds: form.audience === "subject" ? form.subjectIds : [],
          targetStudentIds: form.audience === "custom" ? form.targetStudentIds : [],
          scheduledFor: form.schedule && form.scheduledFor ? form.scheduledFor.toISOString() : null,
        }),
      }).then(async (res) => {
        const payload = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(payload?.error || "Failed to create notice");
        }
        return payload;
      }),
      {
        loading: "Creating notice...",
        success: "Notice saved",
        error: "Failed to create notice",
      }
    );

    router.push("/teacher/communication/notices");
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link href="/teacher/communication/notices" className="inline-flex items-center gap-2 text-xs text-white/50 hover:text-white">
          <ArrowLeft className="h-4 w-4" />
          Back to notices
        </Link>
        <h1 className="text-2xl font-semibold text-white">New Notice</h1>
        <p className="text-sm text-white/60">Craft an announcement and deliver it instantly or schedule it for later.</p>
      </div>

      {!canPublish && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
          You can draft notices, but publishing is disabled for your role.
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-emerald-500/20 text-emerald-200">
                <Megaphone className="h-4 w-4" />
              </span>
              Notice details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">Title</label>
              <Input
                value={form.title}
                onChange={(event) => update({ title: event.target.value })}
                placeholder="e.g. Homework reminder"
                className="border-white/10 bg-white/5 text-white"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">Message</label>
              <Textarea
                value={form.message}
                onChange={(event) => update({ message: event.target.value })}
                placeholder="Write the announcement details..."
                className="min-h-[140px] border-white/10 bg-white/5 text-white"
              />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-lg">Audience</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">Audience type</label>
                <PremiumSelect value={form.audience} onValueChange={(value) => update({ audience: value as Audience })}>
                  <PremiumSelectTrigger>
                    <PremiumSelectValue placeholder="Select audience" />
                  </PremiumSelectTrigger>
                  <PremiumSelectContent>
                    {audienceOptions.map((opt) => (
                      <PremiumSelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </PremiumSelectItem>
                    ))}
                  </PremiumSelectContent>
                </PremiumSelect>
                {form.audience === "school" && (
                  <p className="text-xs text-amber-200/80">School-wide notices require admin access.</p>
                )}
              </div>

              {form.audience === "class" && (
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">Class groups</label>
                  <PremiumDropdownMenu>
                    <PremiumDropdownMenuTrigger asChild>
                      <Button variant="outline" className="w-full border-white/10 bg-white/5 text-white/70 hover:bg-white/10">
                        Select class groups
                      </Button>
                    </PremiumDropdownMenuTrigger>
                    <PremiumDropdownMenuContent align="start">
                      <PremiumDropdownMenuLabel>Classes</PremiumDropdownMenuLabel>
                      {classOptions.map((cls) => (
                        <PremiumDropdownMenuCheckboxItem
                          key={cls.id}
                          checked={form.classGroupIds.includes(cls.id)}
                          onCheckedChange={() => update({ classGroupIds: toggleSelection(form.classGroupIds, cls.id) })}
                        >
                          {cls.name}
                        </PremiumDropdownMenuCheckboxItem>
                      ))}
                    </PremiumDropdownMenuContent>
                  </PremiumDropdownMenu>
                  <div className="flex flex-wrap gap-2">
                    {form.classGroupIds.map((id) => {
                      const name = classOptions.find((item) => item.id === id)?.name;
                      return name ? (
                        <Badge key={id} className="bg-white/10 text-white/70">
                          {name}
                        </Badge>
                      ) : null;
                    })}
                  </div>
                </div>
              )}

              {form.audience === "subject" && (
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">Subjects</label>
                  <PremiumDropdownMenu>
                    <PremiumDropdownMenuTrigger asChild>
                      <Button variant="outline" className="w-full border-white/10 bg-white/5 text-white/70 hover:bg-white/10">
                        Select subjects
                      </Button>
                    </PremiumDropdownMenuTrigger>
                    <PremiumDropdownMenuContent align="start">
                      <PremiumDropdownMenuLabel>Subjects</PremiumDropdownMenuLabel>
                      {subjectOptions.map((subject) => (
                        <PremiumDropdownMenuCheckboxItem
                          key={subject.id}
                          checked={form.subjectIds.includes(subject.id)}
                          onCheckedChange={() => update({ subjectIds: toggleSelection(form.subjectIds, subject.id) })}
                        >
                          {subject.name}
                        </PremiumDropdownMenuCheckboxItem>
                      ))}
                    </PremiumDropdownMenuContent>
                  </PremiumDropdownMenu>
                  <div className="flex flex-wrap gap-2">
                    {form.subjectIds.map((id) => {
                      const name = subjectOptions.find((item) => item.id === id)?.name;
                      return name ? (
                        <Badge key={id} className="bg-white/10 text-white/70">
                          {name}
                        </Badge>
                      ) : null;
                    })}
                  </div>
                </div>
              )}

              {form.audience === "custom" && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">Class group</label>
                    <PremiumSelect
                      value={customClassId}
                      onValueChange={(value) => update({ classGroupIds: [value], targetStudentIds: [] })}
                    >
                      <PremiumSelectTrigger>
                        <PremiumSelectValue placeholder="Select class" />
                      </PremiumSelectTrigger>
                      <PremiumSelectContent>
                        {classOptions.map((cls) => (
                          <PremiumSelectItem key={cls.id} value={cls.id}>
                            {cls.name}
                          </PremiumSelectItem>
                        ))}
                      </PremiumSelectContent>
                    </PremiumSelect>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">Students</label>
                    <PremiumDropdownMenu>
                      <PremiumDropdownMenuTrigger asChild>
                        <Button variant="outline" className="w-full border-white/10 bg-white/5 text-white/70 hover:bg-white/10">
                          Select students
                        </Button>
                      </PremiumDropdownMenuTrigger>
                      <PremiumDropdownMenuContent align="start">
                        <PremiumDropdownMenuLabel>Roster</PremiumDropdownMenuLabel>
                        {roster.map((student) => (
                          <PremiumDropdownMenuCheckboxItem
                            key={student._id}
                            checked={form.targetStudentIds.includes(student._id)}
                            onCheckedChange={() =>
                              update({ targetStudentIds: toggleSelection(form.targetStudentIds, student._id) })
                            }
                          >
                            {student.firstName} {student.lastName}
                          </PremiumDropdownMenuCheckboxItem>
                        ))}
                        {roster.length === 0 && (
                          <div className="px-3 py-2 text-xs text-white/50">No students found.</div>
                        )}
                      </PremiumDropdownMenuContent>
                    </PremiumDropdownMenu>
                    <div className="flex flex-wrap gap-2">
                      {form.targetStudentIds.map((id) => {
                        const student = roster.find((item) => item._id === id);
                        return student ? (
                          <Badge key={id} className="bg-white/10 text-white/70">
                            {student.firstName} {student.lastName}
                          </Badge>
                        ) : null;
                      })}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-indigo-500/20 text-indigo-200">
                  <CalendarDays className="h-4 w-4" />
                </span>
                Schedule
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/70">
                <div>
                  <div className="font-semibold text-white">Schedule notice</div>
                  <div className="text-xs text-white/50">Send later instead of now.</div>
                </div>
                <Switch checked={form.schedule} onCheckedChange={(checked) => update({ schedule: checked })} />
              </div>
              {form.schedule && (
                <CustomDatePicker
                  value={form.scheduledFor ?? undefined}
                  onChange={(date) => update({ scheduledFor: date ?? null })}
                  placeholder="Select a delivery date"
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className={cn("flex flex-wrap items-center gap-3", !canPublish && "opacity-70")}>        
        <Button
          onClick={handleSubmit}
          disabled={!canPublish}
          className="bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30"
        >
          <Users className="h-4 w-4" />
          Save notice
        </Button>
        <Button
          variant="outline"
          onClick={() => router.push("/teacher/communication/notices")}
          className="border-white/10 text-white/60"
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
