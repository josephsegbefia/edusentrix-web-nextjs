"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarDays, ChevronDown, ChevronRight, Copy, Layers } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useTeacherLessonWeekPlans } from "@/hooks/teacher/useTeacherLessonWeekPlans";
import {
  DELIVERY_STATUS_COLORS,
  DELIVERY_STATUS_LABELS,
  type LessonWeekPlanDto,
} from "@/types/lessons-v2";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ResponsiveModal } from "@/components/modals/ResponsiveModal";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import { useCloneLessonWeekPlan } from "@/hooks/teacher/useLessonWeekCreation";
import { useTeacherClasses } from "@/hooks/teacher/useTeacherClasses";
import { useBusyToast } from "@/hooks/useBusyToast";

type Props = {
  classGroupId?: string | null;
  classLabelMap: Map<string, string>;
};

function SessionRow({ session }: { session: LessonWeekPlanDto["sessions"][number] }) {
  const deliveryStatus = session.delivery?.status ?? "scheduled";
  const durationLabel = session.isDoublePeriod
    ? `Double period · ${session.periodCount || 2} periods · ${session.durationMinutes} min`
    : `${session.durationMinutes} min`;
  return (
    <li>
      <Link
        href={`/teacher/lessons/sessions/${session.id}`}
        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 transition hover:border-teal-500/30 hover:bg-teal-500/5"
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-white/90">{session.title}</p>
          <p className="text-xs text-white/50">
            {session.scheduledDate} · {session.startTime}–{session.endTime} · {durationLabel}
          </p>
        </div>
        <Badge className={cn("shrink-0 border-0", DELIVERY_STATUS_COLORS[deliveryStatus])}>
          {DELIVERY_STATUS_LABELS[deliveryStatus]}
        </Badge>
      </Link>
    </li>
  );
}

function CloneWeekPlanButton({
  plan,
  classGroupId,
  classLabelMap,
}: {
  plan: LessonWeekPlanDto;
  classGroupId?: string | null;
  classLabelMap: Map<string, string>;
}) {
  const busyToast = useBusyToast();
  const cloneMutation = useCloneLessonWeekPlan();
  const { data: classesData } = useTeacherClasses();
  const [open, setOpen] = React.useState(false);
  const [targetClassId, setTargetClassId] = React.useState("");

  const classOptions = (classesData?.data.classes || []).filter(
    (c) => c._id && c._id !== plan.classGroupId,
  );

  const submit = async () => {
    if (!targetClassId) {
      busyToast.error("Choose a target class");
      return;
    }
    await busyToast.promise(
      cloneMutation.mutateAsync({
        sourceWeekPlanId: plan.id,
        targetClassGroupId: targetClassId,
        weekStartDate: plan.weekStartDate,
        weekEndDate: plan.weekEndDate,
      }),
      {
        loading: "Cloning week plan…",
        success: `Cloned to ${classLabelMap.get(targetClassId) || "class"}`,
        error: (e) => (e instanceof Error ? e.message : "Clone failed"),
      },
    );
    setOpen(false);
    setTargetClassId("");
  };

  if (classGroupId && plan.classGroupId !== classGroupId) return null;
  if (classOptions.length === 0) return null;

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        className="border-white/10 bg-white/5 text-xs text-white/70 hover:bg-white/10"
      >
        <Copy className="mr-1.5 h-3.5 w-3.5" />
        Clone to class
      </Button>
      <ResponsiveModal open={open} onClose={() => setOpen(false)} title="Clone week plan">
        <div className="space-y-4 p-1">
          <p className="text-sm text-white/60">
            Copy session titles and plan notes to another class. Each class keeps separate delivery
            records.
          </p>
          <PremiumSelect value={targetClassId} onValueChange={setTargetClassId}>
            <PremiumSelectTrigger>
              <PremiumSelectValue placeholder="Target class" />
            </PremiumSelectTrigger>
            <PremiumSelectContent>
              {classOptions.map((c) => (
                <PremiumSelectItem key={c._id} value={c._id}>
                  {classLabelMap.get(c._id) || c.name}
                </PremiumSelectItem>
              ))}
            </PremiumSelectContent>
          </PremiumSelect>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="border-white/10 bg-white/5 text-white/70"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void submit()}
              disabled={cloneMutation.isPending}
              className="bg-teal-500/25 text-teal-100 hover:bg-teal-500/35"
            >
              Clone
            </Button>
          </div>
        </div>
      </ResponsiveModal>
    </>
  );
}

export function TeacherLessonWeekPlansPanel({ classGroupId, classLabelMap }: Props) {
  const { data, isLoading, error } = useTeacherLessonWeekPlans(classGroupId);
  const [openWeeks, setOpenWeeks] = React.useState<Record<string, boolean>>({});

  const weekGroups = data?.data.weekGroups ?? [];

  React.useEffect(() => {
    if (weekGroups.length === 0) return;
    setOpenWeeks((prev) => {
      if (Object.keys(prev).length > 0) return prev;
      const first = weekGroups[0]?.weekStartDate;
      return first ? { [first]: true } : prev;
    });
  }, [weekGroups]);

  return (
    <Card className="border border-teal-500/20 bg-linear-to-br from-teal-500/10 via-transparent to-transparent shadow-lg shadow-black/20 backdrop-blur">
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-500/20 text-teal-100">
            <CalendarDays className="h-4 w-4" />
          </div>
          <div>
            <CardTitle className="text-lg text-white">Lessons by week</CardTitle>
            <p className="text-xs text-white/50">
              Weekly lesson plans from approved notes, grouped by calendar week.
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <p className="text-sm text-rose-300">{error.message}</p>}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl bg-white/5" />
            ))}
          </div>
        ) : weekGroups.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 py-10 text-center text-sm text-white/50">
            <Layers className="mx-auto mb-2 h-8 w-8 text-white/25" />
            No weekly lesson plans yet. Open an approved lesson note and choose Create weekly lessons.
          </div>
        ) : (
          weekGroups.map((group) => {
            const open = openWeeks[group.weekStartDate] ?? false;
            return (
              <div
                key={group.weekStartDate}
                className="overflow-hidden rounded-2xl border border-white/10 bg-black/20"
              >
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-white/5"
                  onClick={() =>
                    setOpenWeeks((prev) => ({
                      ...prev,
                      [group.weekStartDate]: !open,
                    }))
                  }
                >
                  {open ? (
                    <ChevronDown className="h-4 w-4 shrink-0 text-white/50" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0 text-white/50" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white">
                      {group.weekLabel || "Week"} · {group.weekStartDate} – {group.weekEndDate}
                    </p>
                    <p className="text-xs text-white/45">
                      {group.plans.length} class plan{group.plans.length === 1 ? "" : "s"}
                    </p>
                  </div>
                </button>
                {open ? (
                  <div className="space-y-4 border-t border-white/10 px-4 py-3">
                    {group.plans.map((plan) => (
                      <div key={plan.id} className="space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium text-white/90">{plan.title}</p>
                            <p className="text-xs text-white/50">
                              {classLabelMap.get(plan.classGroupId) || "Class"} ·{" "}
                              {plan.lessonNoteTopic || "Lesson note"}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-xs text-white/45">
                              {plan.deliverySummary.completed}/{plan.deliverySummary.total} completed
                            </p>
                            <CloneWeekPlanButton
                              plan={plan}
                              classGroupId={classGroupId}
                              classLabelMap={classLabelMap}
                            />
                          </div>
                        </div>
                        <ul className="space-y-2">
                          {plan.sessions.map((session) => (
                            <SessionRow key={session.id} session={session} />
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
