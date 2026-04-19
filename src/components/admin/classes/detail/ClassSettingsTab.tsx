"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Settings2, Save, RotateCcw, Home, BookOpen, Users, Loader2 } from "lucide-react";
import { useBusyToast } from "@/hooks/useBusyToast";
import { useUpdateClass } from "@/hooks/admin/useClasses";
import type { ClassDetailData } from "./ClassDetailHeader";

type Props = {
  classData: ClassDetailData & { defaultRoomName?: string | null };
  onAssignHomeroom: () => void;
  onManageSubjects: () => void;
  onGoStudents: () => void;
  onGoRoles: () => void;
};

export function ClassSettingsTab({
  classData,
  onAssignHomeroom,
  onManageSubjects,
  onGoStudents,
  onGoRoles,
}: Props) {
  const busy = useBusyToast();
  const updateClass = useUpdateClass();
  const [name, setName] = React.useState(classData.name);
  const [capacity, setCapacity] = React.useState(
    classData.capacity !== null ? String(classData.capacity) : ""
  );
  const [defaultRoomName, setDefaultRoomName] = React.useState(
    classData.defaultRoomName ?? ""
  );
  const [isActive, setIsActive] = React.useState(classData.isActive);

  React.useEffect(() => {
    setName(classData.name);
    setCapacity(classData.capacity !== null ? String(classData.capacity) : "");
    setDefaultRoomName(classData.defaultRoomName ?? "");
    setIsActive(classData.isActive);
  }, [classData]);

  const hasChanges =
    name.trim() !== classData.name ||
    capacity !== (classData.capacity !== null ? String(classData.capacity) : "") ||
    defaultRoomName.trim() !== (classData.defaultRoomName ?? "") ||
    isActive !== classData.isActive;

  const handleReset = () => {
    setName(classData.name);
    setCapacity(classData.capacity !== null ? String(classData.capacity) : "");
    setDefaultRoomName(classData.defaultRoomName ?? "");
    setIsActive(classData.isActive);
  };

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      busy.error("Class name is required");
      return;
    }

    const parsedCapacity =
      capacity.trim() === "" ? null : Number.parseInt(capacity.trim(), 10);
    if (capacity.trim() !== "" && (!Number.isFinite(parsedCapacity) || parsedCapacity < 0)) {
      busy.error("Capacity must be a valid positive number");
      return;
    }

    await busy.promise(
      updateClass.mutateAsync({
        classId: classData.id,
        name: trimmedName,
        capacity: parsedCapacity,
        defaultRoomName: defaultRoomName.trim() || null,
        isActive,
      }),
      {
        loading: "Saving class settings...",
        success: "Class settings updated",
        error: (error) => error.message || "Failed to update class settings",
      }
    );
  };

  return (
    <div className="space-y-6">
      <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 via-slate-950/90 to-black shadow-2xl shadow-black/30 backdrop-blur-xl">
        <div
          className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-[radial-gradient(ellipse_at_top_right,var(--tw-gradient-stops))] from-violet-500/18 via-sky-500/8 to-transparent blur-3xl"
          aria-hidden="true"
        />
        <CardHeader className="relative z-10 flex flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-violet-500/25 bg-violet-500/10 text-violet-200">
              <Settings2 className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold text-white">
                Class Settings
              </CardTitle>
              <p className="text-xs text-white/50">
                Adjust the class identity, capacity, room label, and core admin actions.
              </p>
            </div>
          </div>
          <Badge className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/70">
            {classData.fullLabel}
          </Badge>
        </CardHeader>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="border border-white/10 bg-linear-to-br from-slate-900/80 to-black backdrop-blur-xl">
          <CardHeader className="border-b border-white/5 pb-4">
            <CardTitle className="text-base font-semibold text-white">
              General Settings
            </CardTitle>
            <p className="text-xs text-white/45">
              These values persist on the class record and affect how the class is surfaced across admin tools.
            </p>
          </CardHeader>
          <CardContent className="space-y-5 p-5">
            <div className="space-y-2">
              <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
                Class Name
              </label>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Class name"
                className="h-11 rounded-xl border-white/10 bg-white/5 text-white placeholder:text-white/35"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
                  Capacity
                </label>
                <Input
                  type="number"
                  min={0}
                  value={capacity}
                  onChange={(event) => setCapacity(event.target.value)}
                  placeholder="No limit"
                  className="h-11 rounded-xl border-white/10 bg-white/5 text-white placeholder:text-white/35"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
                  Room Label
                </label>
                <Input
                  value={defaultRoomName}
                  onChange={(event) => setDefaultRoomName(event.target.value)}
                  placeholder="e.g. Block A Room 3"
                  className="h-11 rounded-xl border-white/10 bg-white/5 text-white placeholder:text-white/35"
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-white">Active class</p>
                <p className="text-xs text-white/45">
                  Inactive classes remain visible historically but should not be used for active operations.
                </p>
              </div>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                onClick={handleSave}
                disabled={!hasChanges || updateClass.isPending}
                className="gap-2 rounded-xl bg-linear-to-r from-violet-500 to-sky-600 text-white shadow-lg shadow-violet-500/20 hover:from-violet-600 hover:to-sky-700"
              >
                {updateClass.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save Settings
              </Button>
              <Button
                variant="outline"
                onClick={handleReset}
                disabled={!hasChanges || updateClass.isPending}
                className="gap-2 rounded-xl border-white/10 bg-white/5 text-white/75 hover:bg-white/10 hover:text-white"
              >
                <RotateCcw className="h-4 w-4" />
                Reset
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border border-white/10 bg-linear-to-br from-slate-900/80 to-black backdrop-blur-xl">
            <CardHeader className="border-b border-white/5 pb-4">
              <CardTitle className="text-base font-semibold text-white">
                Operational Shortcuts
              </CardTitle>
              <p className="text-xs text-white/45">
                Jump straight into the most common class administration tasks.
              </p>
            </CardHeader>
            <CardContent className="grid gap-3 p-5">
              <Button
                variant="outline"
                onClick={onAssignHomeroom}
                className="justify-start gap-3 rounded-2xl border-white/10 bg-white/5 px-4 py-6 text-left text-white/80 hover:border-violet-500/30 hover:bg-violet-500/10 hover:text-violet-100"
              >
                <Home className="h-4 w-4 text-violet-300" />
                Assign Homeroom Teacher
              </Button>
              <Button
                variant="outline"
                onClick={onManageSubjects}
                className="justify-start gap-3 rounded-2xl border-white/10 bg-white/5 px-4 py-6 text-left text-white/80 hover:border-sky-500/30 hover:bg-sky-500/10 hover:text-sky-100"
              >
                <BookOpen className="h-4 w-4 text-sky-300" />
                Manage Subjects
              </Button>
              <Button
                variant="outline"
                onClick={onGoStudents}
                className="justify-start gap-3 rounded-2xl border-white/10 bg-white/5 px-4 py-6 text-left text-white/80 hover:border-emerald-500/30 hover:bg-emerald-500/10 hover:text-emerald-100"
              >
                <Users className="h-4 w-4 text-emerald-300" />
                Review Students
              </Button>
              <Button
                variant="outline"
                onClick={onGoRoles}
                className="justify-start gap-3 rounded-2xl border-white/10 bg-white/5 px-4 py-6 text-left text-white/80 hover:border-amber-500/30 hover:bg-amber-500/10 hover:text-amber-100"
              >
                <Settings2 className="h-4 w-4 text-amber-300" />
                Review Class Roles
              </Button>
            </CardContent>
          </Card>

          <Card className="border border-white/10 bg-linear-to-br from-slate-900/80 to-black backdrop-blur-xl">
            <CardHeader className="border-b border-white/5 pb-4">
              <CardTitle className="text-base font-semibold text-white">
                Current Snapshot
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-5 text-sm text-white/70">
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-white/4 px-4 py-3">
                <span>Grade</span>
                <span className="font-medium text-white">{classData.grade.name}</span>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-white/4 px-4 py-3">
                <span>Homeroom</span>
                <span className="font-medium text-white">
                  {classData.homeroomTeacher?.fullName ?? "Not assigned"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-white/4 px-4 py-3">
                <span>Students</span>
                <span className="font-medium text-white">{classData.studentCount}</span>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-white/4 px-4 py-3">
                <span>Subjects</span>
                <span className="font-medium text-white">{classData.subjectCount}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
