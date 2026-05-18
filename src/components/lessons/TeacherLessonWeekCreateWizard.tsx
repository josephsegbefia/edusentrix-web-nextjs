"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  Clock,
  Loader2,
  Presentation,
  Sparkles,
  Split,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import { useTeacherClasses } from "@/hooks/teacher/useTeacherClasses";
import {
  useCreateLessonWeekPlan,
  useWeekCreationContext,
} from "@/hooks/teacher/useLessonWeekCreation";
import { useBusyToast } from "@/hooks/useBusyToast";
import { cn } from "@/lib/utils";
import type { CreateWeekPlanSessionInput } from "@/types/lessons-v2";
import type { LessonContentBlock } from "@/types/lesson-content-blocks";
import { LessonContentBlocksEditor } from "@/components/lessons/LessonContentBlocksEditor";
import { useGenerateSessionContent, useProposeWeekSplit } from "@/hooks/teacher/useLessonsLeo";
import { validateCoverageWeights } from "@/lib/lessons/coverage-weights";

const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type WizardStep = "context" | "timetable" | "split" | "content" | "review";

type SlotDraft = {
  timetableSlotId: string;
  title: string;
  include: boolean;
  scheduledDate: string;
  startTime: string;
  endTime: string;
  dayOfWeek: number;
  durationMinutes: number;
  noteSectionKeys: string[];
  coverageWeight: number;
  contentBlocks: LessonContentBlock[];
  focusSummary?: string;
};

function applyDefaultSplit(slots: SlotDraft[], sectionKeys: string[]): SlotDraft[] {
  const included = slots.filter((s) => s.include);
  const n = included.length;
  if (n === 0) return slots;
  const weight = 1 / n;
  return slots.map((slot) => {
    if (!slot.include) return { ...slot, coverageWeight: 0, noteSectionKeys: [] };
    const sessionIndex = included.findIndex((s) => s.timetableSlotId === slot.timetableSlotId);
    const keysForSession = sectionKeys.filter((_, i) => i % n === sessionIndex);
    return {
      ...slot,
      coverageWeight: weight,
      noteSectionKeys:
        keysForSession.length > 0 ? keysForSession : sectionKeys.slice(sessionIndex, sessionIndex + 1),
    };
  });
}

type Props = {
  noteId: string;
  initialClassGroupId?: string | null;
};

export function TeacherLessonWeekCreateWizard({ noteId, initialClassGroupId }: Props) {
  const router = useRouter();
  const busyToast = useBusyToast();
  const [step, setStep] = React.useState<WizardStep>("context");
  const [classGroupId, setClassGroupId] = React.useState(initialClassGroupId || "");
  const [planTitle, setPlanTitle] = React.useState("");
  const [slotDrafts, setSlotDrafts] = React.useState<SlotDraft[]>([]);
  const [activeContentIndex, setActiveContentIndex] = React.useState(0);

  const { data: classesData } = useTeacherClasses();
  const proposeSplit = useProposeWeekSplit();
  const generateContent = useGenerateSessionContent();
  const classOptions = classesData?.data.classes ?? [];

  const contextQuery = useWeekCreationContext(
    noteId,
    classGroupId || null,
    Boolean(classGroupId),
  );
  const ctx = contextQuery.data?.data;
  const createMutation = useCreateLessonWeekPlan();

  React.useEffect(() => {
    if (initialClassGroupId && !classGroupId) {
      setClassGroupId(initialClassGroupId);
    }
  }, [initialClassGroupId, classGroupId]);

  React.useEffect(() => {
    if (!ctx) return;
    const topic = ctx.lessonNote.topic || "Lesson";
    setPlanTitle((prev) => prev || `${topic} — ${ctx.weekLabel}`);
    setSlotDrafts(
      ctx.timetableSlots.map((slot, index) => ({
        timetableSlotId: slot.id,
        title: `${topic} — Session ${index + 1}`,
        include: true,
        scheduledDate: slot.scheduledDate,
        startTime: slot.startTime,
        endTime: slot.endTime,
        dayOfWeek: slot.dayOfWeek,
        durationMinutes: slot.durationMinutes,
        noteSectionKeys: [],
        coverageWeight: 0,
        contentBlocks: [],
      })),
    );
  }, [ctx]);

  const includedSlots = slotDrafts.filter((s) => s.include);
  const selectedCount = includedSlots.length;
  const leoEnabled = ctx?.enableLeoLessonTools ?? false;
  const sectionKeys = ctx?.allocatableNoteSectionKeys ?? [];

  const runLeoSplit = async () => {
    if (!ctx || !leoEnabled) return;
    const sessions = includedSlots.map((s, index) => ({
      timetableSlotId: s.timetableSlotId,
      sequenceInWeek: index + 1,
      title: s.title,
      durationMinutes: s.durationMinutes,
      scheduledDate: s.scheduledDate,
      startTime: s.startTime,
    }));
    const result = await busyToast.promise(
      proposeSplit.mutateAsync({ lessonNoteId: noteId, sessions }),
      {
        loading: "Leo is proposing a content split…",
        success: "Split proposal ready",
        error: (e) => (e instanceof Error ? e.message : "Split failed"),
      },
    );
    const proposals = result.data?.sessions ?? [];
    setSlotDrafts((prev) =>
      prev.map((slot) => {
        const proposal = proposals.find((p) => p.timetableSlotId === slot.timetableSlotId);
        if (!proposal || !slot.include) return slot;
        return {
          ...slot,
          title: proposal.title || slot.title,
          noteSectionKeys: proposal.noteSectionKeys,
          coverageWeight: proposal.coverageWeight,
          focusSummary: proposal.focusSummary,
        };
      }),
    );
  };

  const goNext = () => {
    if (step === "context") {
      if (!classGroupId) {
        busyToast.error("Choose a class group");
        return;
      }
      if (!ctx?.canCreate) {
        busyToast.error(ctx?.blockReason || "Cannot create lessons for this week yet");
        return;
      }
      setStep("timetable");
      return;
    }
    if (step === "timetable") {
      if (selectedCount === 0) {
        busyToast.error("Include at least one timetable period");
        return;
      }
      setSlotDrafts((prev) => applyDefaultSplit(prev, sectionKeys));
      setStep("split");
      return;
    }
    if (step === "split") {
      const weights = includedSlots.map((s) => s.coverageWeight);
      const check = validateCoverageWeights(weights);
      if (!check.ok) {
        busyToast.error(check.error);
        return;
      }
      setStep("content");
      return;
    }
    if (step === "content") {
      setStep("review");
    }
  };

  const goBack = () => {
    if (step === "timetable") setStep("context");
    else if (step === "split") setStep("timetable");
    else if (step === "content") setStep("split");
    else if (step === "review") setStep("content");
  };

  const submit = async () => {
    if (!ctx || !classGroupId) return;
    const sessions: CreateWeekPlanSessionInput[] = slotDrafts
      .filter((s) => s.include)
      .map((s) => ({
        timetableSlotId: s.timetableSlotId,
        title: s.title.trim(),
        include: true,
        noteSectionKeys: s.noteSectionKeys,
        coverageWeight: s.coverageWeight,
        contentBlocks: s.contentBlocks,
      }));

    await busyToast.promise(
      createMutation.mutateAsync({
        lessonNoteId: noteId,
        classGroupId,
        weekStartDate: ctx.weekStartDate,
        weekEndDate: ctx.weekEndDate,
        weekLabel: ctx.weekLabel,
        title: planTitle.trim() || undefined,
        sessions,
      }),
      {
        loading: "Creating weekly lessons…",
        success: "Weekly lessons created",
        error: (e) => (e instanceof Error ? e.message : "Failed to create week plan"),
      },
    );

    const classQuery = classGroupId ? `?classGroupId=${encodeURIComponent(classGroupId)}` : "";
    router.push(`/teacher/lessons${classQuery}`);
  };

  const steps: Array<{ id: WizardStep; label: string }> = [
    { id: "context", label: "Context" },
    { id: "timetable", label: "Timetable" },
    { id: "split", label: "Split" },
    { id: "content", label: "Content" },
    { id: "review", label: "Review" },
  ];

  const activeSlot = includedSlots[activeContentIndex];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Create weekly lessons</h1>
          <p className="mt-1 text-sm text-white/60">
            Build session plans from your approved lesson note and the published class timetable.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          asChild
          className="border-white/10 bg-white/5 text-white/75 hover:bg-white/10"
        >
          <Link href="/teacher/lessons">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to lessons
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {steps.map((s, index) => {
          const active = step === s.id;
          const order = steps.map((x) => x.id);
          const done = order.indexOf(step) > order.indexOf(s.id);
          return (
            <div
              key={s.id}
              className={cn(
                "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium",
                active
                  ? "border-teal-400/40 bg-teal-500/15 text-teal-100"
                  : done
                    ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
                    : "border-white/10 bg-white/5 text-white/50",
              )}
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-[10px]">
                {done ? <Check className="h-3 w-3" /> : index + 1}
              </span>
              {s.label}
            </div>
          );
        })}
      </div>

      {step === "context" ? (
        <Card className="border border-white/10 bg-linear-to-br from-white/6 via-white/4 to-transparent shadow-lg shadow-black/20 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-white">
              <CalendarDays className="h-5 w-5 text-teal-300" />
              Week context
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {contextQuery.isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-full rounded-xl bg-white/5" />
                <Skeleton className="h-24 w-full rounded-xl bg-white/5" />
              </div>
            ) : contextQuery.error ? (
              <p className="text-sm text-rose-300">{contextQuery.error.message}</p>
            ) : (
              <>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
                  <p className="font-medium text-white/90">{ctx?.lessonNote.topic || "Lesson note"}</p>
                  <p className="mt-1 text-xs text-white/50">
                    Status: {ctx?.lessonNote.status} · {ctx?.weekLabel} ({ctx?.weekStartDate} –{" "}
                    {ctx?.weekEndDate})
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-white/70">Class group</Label>
                  <PremiumSelect value={classGroupId} onValueChange={setClassGroupId}>
                    <PremiumSelectTrigger>
                      <PremiumSelectValue placeholder="Select class" />
                    </PremiumSelectTrigger>
                    <PremiumSelectContent>
                      {classOptions.map((c) => (
                        <PremiumSelectItem key={c._id} value={c._id}>
                          {c.gradeName ? `${c.gradeName} ` : ""}
                          {c.name}
                          {c.subjectName ? ` · ${c.subjectName}` : ""}
                        </PremiumSelectItem>
                      ))}
                    </PremiumSelectContent>
                  </PremiumSelect>
                </div>

                {ctx?.blockReason ? (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                    {ctx.blockReason}
                  </div>
                ) : ctx?.timetableSlotCount ? (
                  <p className="text-sm text-emerald-200/90">
                    {ctx.timetableSlotCount} timetable period
                    {ctx.timetableSlotCount === 1 ? "" : "s"} found for this class and week.
                  </p>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>
      ) : null}

      {step === "timetable" ? (
        <Card className="border border-white/10 bg-linear-to-br from-white/6 via-white/4 to-transparent shadow-lg shadow-black/20 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-white">
              <Clock className="h-5 w-5 text-teal-300" />
              Timetable periods
            </CardTitle>
            <p className="text-xs text-white/50">
              Include the periods you will teach this week. You can rename each session.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {slotDrafts.length === 0 ? (
              <p className="text-sm text-white/50">No timetable slots available.</p>
            ) : (
              slotDrafts.map((slot) => (
                <div
                  key={slot.timetableSlotId}
                  className={cn(
                    "rounded-xl border p-3 transition",
                    slot.include
                      ? "border-teal-500/25 bg-teal-500/5"
                      : "border-white/10 bg-white/5 opacity-60",
                  )}
                >
                  <div className="flex flex-wrap items-start gap-3">
                    <Checkbox
                      checked={slot.include}
                      onCheckedChange={(checked) =>
                        setSlotDrafts((prev) =>
                          prev.map((s) =>
                            s.timetableSlotId === slot.timetableSlotId
                              ? { ...s, include: checked === true }
                              : s,
                          ),
                        )
                      }
                      className="mt-1"
                    />
                    <div className="min-w-0 flex-1 space-y-2">
                      <p className="text-xs text-white/50">
                        {DAY_LABELS[slot.dayOfWeek] ?? "Day"} · {slot.scheduledDate} ·{" "}
                        {slot.startTime}–{slot.endTime}
                      </p>
                      <Input
                        value={slot.title}
                        onChange={(e) =>
                          setSlotDrafts((prev) =>
                            prev.map((s) =>
                              s.timetableSlotId === slot.timetableSlotId
                                ? { ...s, title: e.target.value }
                                : s,
                            ),
                          )
                        }
                        disabled={!slot.include}
                        className="border-white/10 bg-white/5 text-white"
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
            <p className="text-xs text-white/45">
              {selectedCount} of {slotDrafts.length} period{slotDrafts.length === 1 ? "" : "s"} selected
            </p>
          </CardContent>
        </Card>
      ) : null}

      {step === "split" ? (
        <Card className="border border-white/10 bg-linear-to-br from-white/6 via-white/4 to-transparent shadow-lg shadow-black/20 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-white">
              <Split className="h-5 w-5 text-teal-300" />
              Content split
            </CardTitle>
            <p className="text-xs text-white/50">
              Assign lesson note sections to each session. Coverage weights must sum to 1.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {leoEnabled ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={proposeSplit.isPending}
                onClick={() => void runLeoSplit()}
                className="border-violet-400/30 bg-violet-500/10 text-violet-100"
              >
                {proposeSplit.isPending ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                )}
                Propose split with Leo
              </Button>
            ) : null}
            {includedSlots.map((slot) => (
              <div
                key={slot.timetableSlotId}
                className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-3"
              >
                <p className="text-sm font-medium text-white/90">{slot.title}</p>
                {slot.focusSummary ? (
                  <p className="text-xs text-white/50">{slot.focusSummary}</p>
                ) : null}
                <div className="flex flex-wrap gap-3">
                  {sectionKeys.map((key) => (
                    <label key={key} className="flex items-center gap-2 text-xs text-white/70">
                      <Checkbox
                        checked={slot.noteSectionKeys.includes(key)}
                        onCheckedChange={(checked) =>
                          setSlotDrafts((prev) =>
                            prev.map((s) => {
                              if (s.timetableSlotId !== slot.timetableSlotId) return s;
                              const keys = new Set(s.noteSectionKeys);
                              if (checked) keys.add(key);
                              else keys.delete(key);
                              return { ...s, noteSectionKeys: Array.from(keys) };
                            }),
                          )
                        }
                      />
                      {key}
                    </label>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-white/50">Coverage</Label>
                  <Input
                    type="number"
                    min={0}
                    max={1}
                    step={0.01}
                    value={slot.coverageWeight}
                    onChange={(e) =>
                      setSlotDrafts((prev) =>
                        prev.map((s) =>
                          s.timetableSlotId === slot.timetableSlotId
                            ? { ...s, coverageWeight: Number(e.target.value) || 0 }
                            : s,
                        ),
                      )
                    }
                    className="h-8 w-24 border-white/10 bg-black/20 text-white"
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {step === "content" ? (
        <Card className="border border-white/10 bg-linear-to-br from-white/6 via-white/4 to-transparent shadow-lg shadow-black/20 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-white">
              <Sparkles className="h-5 w-5 text-teal-300" />
              Session content
            </CardTitle>
            <p className="text-xs text-white/50">
              Optional: generate rich blocks per session. You can edit them later on each session page.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {includedSlots.map((slot, index) => (
                <Button
                  key={slot.timetableSlotId}
                  type="button"
                  size="sm"
                  variant={activeContentIndex === index ? "default" : "outline"}
                  onClick={() => setActiveContentIndex(index)}
                  className={
                    activeContentIndex === index
                      ? "bg-teal-500/25 text-teal-100"
                      : "border-white/10 bg-white/5 text-white/70"
                  }
                >
                  {slot.title}
                </Button>
              ))}
            </div>
            {activeSlot ? (
              <LessonContentBlocksEditor
                blocks={activeSlot.contentBlocks}
                onChange={(blocks) =>
                  setSlotDrafts((prev) =>
                    prev.map((s) =>
                      s.timetableSlotId === activeSlot.timetableSlotId ? { ...s, contentBlocks: blocks } : s,
                    ),
                  )
                }
                leoEnabled={leoEnabled}
                leoLoading={generateContent.isPending}
                onGenerateWithLeo={
                  leoEnabled
                    ? async () => {
                        const blocks = await busyToast.promise(
                          generateContent.mutateAsync({
                            lessonNoteId: noteId,
                            session: {
                              title: activeSlot.title,
                              durationMinutes: activeSlot.durationMinutes,
                              noteSectionKeys: activeSlot.noteSectionKeys,
                              coverageWeight: activeSlot.coverageWeight,
                            },
                          }),
                          {
                            loading: "Generating content…",
                            success: "Blocks generated",
                            error: (e) => (e instanceof Error ? e.message : "Failed"),
                          },
                        );
                        setSlotDrafts((prev) =>
                          prev.map((s) =>
                            s.timetableSlotId === activeSlot.timetableSlotId
                              ? { ...s, contentBlocks: blocks }
                              : s,
                          ),
                        );
                      }
                    : undefined
                }
              />
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {step === "review" ? (
        <Card className="border border-white/10 bg-linear-to-br from-white/6 via-white/4 to-transparent shadow-lg shadow-black/20 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-white">
              <Presentation className="h-5 w-5 text-teal-300" />
              Review & create
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-white/70">Week plan title</Label>
              <Input
                value={planTitle}
                onChange={(e) => setPlanTitle(e.target.value)}
                className="border-white/10 bg-white/5 text-white"
              />
            </div>
            <ul className="space-y-2">
              {slotDrafts
                .filter((s) => s.include)
                .map((s) => (
                  <li
                    key={s.timetableSlotId}
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm"
                  >
                    <p className="font-medium text-white/90">{s.title}</p>
                    <p className="text-xs text-white/50">
                      {s.scheduledDate} · {s.startTime}–{s.endTime} · weight{" "}
                      {s.coverageWeight.toFixed(2)} · {s.contentBlocks.length} block
                      {s.contentBlocks.length === 1 ? "" : "s"}
                    </p>
                  </li>
                ))}
            </ul>
            <p className="text-xs text-white/45">
              Leo drafts are not published automatically. Review AI blocks before publishing to students
              if your school requires it.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={goBack}
          disabled={step === "context"}
          className="border-white/10 bg-white/5 text-white/75 hover:bg-white/10"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <div className="flex gap-2">
          {step !== "review" ? (
            <Button
              type="button"
              onClick={goNext}
              disabled={contextQuery.isLoading || (step === "context" && !ctx?.canCreate)}
              className="bg-teal-500/25 text-teal-100 hover:bg-teal-500/35"
            >
              Continue
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => void submit()}
              disabled={createMutation.isPending}
              className="bg-teal-500/25 text-teal-100 hover:bg-teal-500/35"
            >
              {createMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Check className="mr-2 h-4 w-4" />
              )}
              Create weekly lessons
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
