"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Loader2,
  Plus,
  Eye,
  Presentation,
  RefreshCw,
  Sparkles,
  Split,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  PremiumDropdownMenu,
  PremiumDropdownMenuContent,
  PremiumDropdownMenuItem,
  PremiumDropdownMenuTrigger,
} from "@/components/ui/premium-dropdown-menu";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import { useTeacherClasses } from "@/hooks/teacher/useTeacherClasses";
import { useTeacherContext } from "@/hooks/teacher/useTeacherContext";
import {
  LessonWeekPlanCreateError,
  useCreateLessonWeekPlan,
  useWeekCreationContext,
} from "@/hooks/teacher/useLessonWeekCreation";
import { useBusyToast } from "@/hooks/useBusyToast";
import { cn } from "@/lib/utils";
import type { CreateWeekPlanSessionInput } from "@/types/lessons-v2";
import type { LessonContentBlock, WeekSplitSessionProposal } from "@/types/lesson-content-blocks";
import { LessonContentBlocksEditor } from "@/components/lessons/LessonContentBlocksEditor";
import { useGenerateSessionContent, useProposeWeekSplit } from "@/hooks/teacher/useLessonsLeo";
import { validateCoverageWeights } from "@/lib/lessons/coverage-weights";
import { normalizeSplittableSectionKeys } from "@/lib/lessons/splittable-section-keys";
import {
  summarizeContentBlocksForHandoff,
  type PriorSessionHandoff,
} from "@/lib/lessons/session-content-handoff";
import type { GenerateSessionContentInput } from "@/hooks/teacher/useLessonsLeo";
import { LessonWeekPreviewPresenter } from "@/components/lessons/LessonWeekPreviewPresenter";
import type { LessonPreviewSession } from "@/types/lesson-preview";

/** Splittable section keys — context/curriculum stay week-level reference. */
const SECTION_KEY_DESCRIPTIONS: Record<string, string> = {
  body: "Main teaching activities and lesson phases for this period.",
  resources: "TLMs and materials used during this period's body work.",
  assessment: "Checks, exit tasks, homework, or end-of-week assessment for this period.",
};

const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type WizardStep = "context" | "timetable" | "split" | "content" | "review";

type SlotDraft = {
  slotDraftId: string;
  timetableSlotId: string;
  timetableSlotIds: string[];
  periodCount: number;
  isDoublePeriod: boolean;
  title: string;
  include: boolean;
  scheduledDate: string;
  startTime: string;
  endTime: string;
  dayOfWeek: number;
  durationMinutes: number;
  noteSectionKeys: string[];
  schemeItemIds: string[];
  coverageWeight: number;
  contentBlocks: LessonContentBlock[];
  focusSummary?: string;
};

function makeSlotDraftId(slot: { scheduledDate: string; id: string }) {
  return `${slot.scheduledDate}:${slot.id}`;
}

function applyDefaultSplit(slots: SlotDraft[], sectionKeys: string[]): SlotDraft[] {
  const included = slots.filter((s) => s.include);
  const n = included.length;
  if (n === 0) return slots;
  const weight = 1 / n;

  return slots.map((slot) => {
    if (!slot.include) return { ...slot, coverageWeight: 0, noteSectionKeys: [] };

    const sessionIndex = included.findIndex((s) => s.slotDraftId === slot.slotDraftId);
    const isLast = sessionIndex === n - 1;
    const keys: string[] = [];

    if (sectionKeys.includes("body")) {
      keys.push("body");
      if (sectionKeys.includes("resources")) keys.push("resources");
    }
    if (sectionKeys.includes("assessment") && (isLast || n === 1)) {
      keys.push("assessment");
    }

    return {
      ...slot,
      coverageWeight: weight,
      noteSectionKeys: normalizeSplittableSectionKeys(
        keys.length > 0 ? keys : [sectionKeys[sessionIndex] ?? "body"],
        sectionKeys,
      ),
    };
  });
}

function buildSessionGenerationPayload(
  slot: SlotDraft,
  index: number,
  includedSlots: SlotDraft[],
  priorHandoffs: PriorSessionHandoff[],
): GenerateSessionContentInput["session"] {
  const sequenceInWeek = index + 1;
  const previousSlot = index > 0 ? includedSlots[index - 1] : null;

  return {
    title: slot.title,
    durationMinutes: slot.durationMinutes,
    noteSectionKeys: slot.noteSectionKeys,
    coverageWeight: slot.coverageWeight,
    scheduledDate: slot.scheduledDate,
    startTime: slot.startTime,
    endTime: slot.endTime,
    periodCount: slot.periodCount,
    isDoublePeriod: slot.isDoublePeriod,
    focusSummary: slot.focusSummary,
    sequenceInWeek,
    previousSession: previousSlot
      ? {
          title: previousSlot.title,
          focusSummary: previousSlot.focusSummary,
          keyPointsSummary:
            summarizeContentBlocksForHandoff(previousSlot.contentBlocks) ?? undefined,
        }
      : undefined,
    priorSessions: priorHandoffs.length > 0 ? priorHandoffs : undefined,
  };
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
  const [additionalClassGroupIds, setAdditionalClassGroupIds] = React.useState<string[]>([]);
  const [planTitle, setPlanTitle] = React.useState("");
  const [slotDrafts, setSlotDrafts] = React.useState<SlotDraft[]>([]);
  const [activeContentIndex, setActiveContentIndex] = React.useState(0);
  const [conflictNotice, setConflictNotice] = React.useState<string | null>(null);
  const [leoSplitApplied, setLeoSplitApplied] = React.useState(false);
  const [expandedPreviews, setExpandedPreviews] = React.useState<Set<string>>(new Set());
  const [showWeekPreview, setShowWeekPreview] = React.useState(false);
  const [isRedirecting, setIsRedirecting] = React.useState(false);
  const autoSplitKeyRef = React.useRef<string | null>(null);

  const { data: classesData } = useTeacherClasses();
  const { data: teacherContext } = useTeacherContext();
  const schoolId = teacherContext?.data?.school?._id;
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
  const sectionKeys =
    ctx?.splittableNoteSectionKeys ?? ctx?.allocatableNoteSectionKeys ?? ["body", "resources", "assessment"];

  const applyLeoProposals = React.useCallback((proposals: WeekSplitSessionProposal[]) => {
    setSlotDrafts((prev) =>
      prev.map((slot, index) => {
        const proposal =
          proposals[index] ??
          proposals.find(
            (p) =>
              p.timetableSlotId === slot.timetableSlotId &&
              (!p.scheduledDate || p.scheduledDate === slot.scheduledDate),
          );
        if (!proposal || !slot.include) return slot;
        return {
          ...slot,
          title: proposal.title || slot.title,
          noteSectionKeys: normalizeSplittableSectionKeys(
            proposal.noteSectionKeys,
            sectionKeys,
          ),
          // Accept Leo's schemeItemIds if provided; keep existing ones otherwise.
          schemeItemIds:
            Array.isArray(proposal.schemeItemIds) && proposal.schemeItemIds.length > 0
              ? proposal.schemeItemIds
              : slot.schemeItemIds,
          coverageWeight: proposal.coverageWeight,
          focusSummary: proposal.focusSummary,
        };
      }),
    );
    setLeoSplitApplied(true);
  }, [sectionKeys]);

  React.useEffect(() => {
    if (initialClassGroupId && !classGroupId) {
      setClassGroupId(initialClassGroupId);
    }
  }, [initialClassGroupId, classGroupId]);

  React.useEffect(() => {
    if (!ctx) return;
    const topic = ctx.lessonNote.topic || "Lesson";
    setPlanTitle((prev) => prev || `${topic} — ${ctx.weekLabel}`);
    const noteSchemeItemIds = ctx.noteSchemeItemIds ?? [];
    setSlotDrafts(
      ctx.timetableSlots.map((slot, index) => ({
        slotDraftId: makeSlotDraftId(slot),
        timetableSlotId: slot.id,
        timetableSlotIds: slot.timetableSlotIds?.length ? slot.timetableSlotIds : [slot.id],
        periodCount: slot.periodCount || 1,
        isDoublePeriod: slot.isDoublePeriod || false,
        title: `${topic} — ${slot.isDoublePeriod ? "Double period" : "Session"} ${index + 1}`,
        include: true,
        scheduledDate: slot.scheduledDate,
        startTime: slot.startTime,
        endTime: slot.endTime,
        dayOfWeek: slot.dayOfWeek,
        durationMinutes: slot.durationMinutes,
        noteSectionKeys: [],
        // Seed every session with the note's scheme item IDs so Leo enrichment works immediately.
        schemeItemIds: noteSchemeItemIds,
        coverageWeight: 0,
        contentBlocks: [],
      })),
    );
  }, [ctx]);

  const includedSlots = slotDrafts.filter((s) => s.include);
  const selectedCount = includedSlots.length;
  const leoEnabled = ctx?.enableLeoLessonTools ?? false;

  const previewSessions = React.useMemo<LessonPreviewSession[]>(
    () =>
      includedSlots.map((slot, index) => ({
        id: slot.slotDraftId,
        sequenceInWeek: index + 1,
        title: slot.title,
        scheduledDate: slot.scheduledDate,
        startTime: slot.startTime,
        endTime: slot.endTime,
        durationMinutes: slot.durationMinutes,
        planNotes: null,
        contentBlocks: slot.contentBlocks,
      })),
    [includedSlots],
  );

  const runLeoSplit = async () => {
    if (!ctx || !leoEnabled) return;
    const sessions = includedSlots.map((s, index) => ({
      timetableSlotId: s.timetableSlotId,
      timetableSlotIds: s.timetableSlotIds,
      sequenceInWeek: index + 1,
      title: s.title,
      durationMinutes: s.durationMinutes,
      scheduledDate: s.scheduledDate,
      startTime: s.startTime,
      endTime: s.endTime,
      periodCount: s.periodCount,
      isDoublePeriod: s.isDoublePeriod,
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
    applyLeoProposals(proposals);
  };

  const moveBlockBetweenSessions = React.useCallback(
    (blockId: string, targetSlotDraftId: string) => {
      setSlotDrafts((prev) => {
        const source = prev.find((s) => s.contentBlocks.some((b) => b.id === blockId));
        if (!source || source.slotDraftId === targetSlotDraftId) return prev;
        const block = source.contentBlocks.find((b) => b.id === blockId);
        if (!block) return prev;
        return prev.map((s) => {
          if (s.slotDraftId === source.slotDraftId) {
            const updated = s.contentBlocks.filter((b) => b.id !== blockId);
            return { ...s, contentBlocks: updated.map((b, i) => ({ ...b, order: i })) };
          }
          if (s.slotDraftId === targetSlotDraftId) {
            const moved = { ...block, order: s.contentBlocks.length };
            return { ...s, contentBlocks: [...s.contentBlocks, moved] };
          }
          return s;
        });
      });
    },
    [],
  );

  const generateAllSessionContent = async () => {
    if (!leoEnabled || includedSlots.length === 0) return;
    const generated = new Map<string, LessonContentBlock[]>();
    await busyToast.promise(
      (async () => {
        const priorHandoffs: PriorSessionHandoff[] = [];
        for (let index = 0; index < includedSlots.length; index += 1) {
          const slot = includedSlots[index]!;
          const blocks = await generateContent.mutateAsync({
            lessonNoteId: noteId,
            session: buildSessionGenerationPayload(slot, index, includedSlots, priorHandoffs),
          });
          generated.set(slot.slotDraftId, blocks);
          priorHandoffs.push({
            title: slot.title,
            focusSummary: slot.focusSummary ?? null,
            keyPointsSummary: summarizeContentBlocksForHandoff(blocks),
          });
        }
      })(),
      {
        loading: "Generating teachable content for all sessions...",
        success: "Session content generated",
        error: (e) => (e instanceof Error ? e.message : "Content generation failed"),
      },
    );

    setSlotDrafts((prev) =>
      prev.map((slot) => {
        const blocks = generated.get(slot.slotDraftId);
        return blocks ? { ...slot, contentBlocks: blocks } : slot;
      }),
    );
  };

  React.useEffect(() => {
    if (!ctx || !leoEnabled || slotDrafts.length === 0 || proposeSplit.isPending) return;
    const autoKey = `${noteId}:${classGroupId}:${ctx.weekStartDate}:${slotDrafts.map((s) => s.slotDraftId).join(",")}`;
    if (autoSplitKeyRef.current === autoKey) return;
    autoSplitKeyRef.current = autoKey;

    const sessions = slotDrafts
      .filter((s) => s.include)
      .map((s, index) => ({
        timetableSlotId: s.timetableSlotId,
        timetableSlotIds: s.timetableSlotIds,
        scheduledDate: s.scheduledDate,
        sequenceInWeek: index + 1,
        title: s.title,
        durationMinutes: s.durationMinutes,
        scheduledDate: s.scheduledDate,
        startTime: s.startTime,
        endTime: s.endTime,
        periodCount: s.periodCount,
        isDoublePeriod: s.isDoublePeriod,
      }));

    void proposeSplit
      .mutateAsync({ lessonNoteId: noteId, sessions })
      .then((result) => applyLeoProposals(result.data?.sessions ?? []))
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "Leo split failed";
        busyToast.error(`Leo could not auto-split this week: ${message}`);
      });
  }, [applyLeoProposals, busyToast, classGroupId, ctx, leoEnabled, noteId, proposeSplit, slotDrafts]);

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
    const includedDrafts = slotDrafts.filter((s) => s.include);
    const includedDates = includedDrafts.map((s) => s.scheduledDate).sort();
    const planStartDate = includedDates[0] ?? ctx.weekStartDate;
    const planEndDate = includedDates[includedDates.length - 1] ?? ctx.weekEndDate;
    const sessions: CreateWeekPlanSessionInput[] = includedDrafts
      .map((s) => ({
        timetableSlotId: s.timetableSlotId,
        timetableSlotIds: s.timetableSlotIds,
        scheduledDate: s.scheduledDate,
        title: s.title.trim(),
        include: true,
        noteSectionKeys: s.noteSectionKeys,
        schemeItemIds: s.schemeItemIds,
        coverageWeight: s.coverageWeight,
        contentBlocks: s.contentBlocks,
      }));

    try {
      await busyToast.promise(
        createMutation.mutateAsync({
          lessonNoteId: noteId,
          classGroupId,
          additionalClassGroupIds,
          weekStartDate: planStartDate,
          weekEndDate: planEndDate,
          weekLabel: ctx.weekLabel,
          title: planTitle.trim() || undefined,
          sessions,
        }),
        {
          loading: "Creating weekly lessons…",
          success: "Weekly lessons created",
          error: (e) =>
            e instanceof LessonWeekPlanCreateError &&
            e.details?.code === "TIMETABLE_SLOT_CONFLICT"
              ? "That timetable period is already planned. Pick a different date or period."
              : e instanceof Error
                ? e.message
                : "Failed to create week plan",
        },
      );
    } catch (error) {
      if (
        error instanceof LessonWeekPlanCreateError &&
        error.details?.code === "TIMETABLE_SLOT_CONFLICT"
      ) {
        const conflictSlotIds = new Set(error.details.conflictingSlotIds);
        setSlotDrafts((prev) =>
          prev.map((slot) =>
            slot.timetableSlotIds.some((slotId) =>
              conflictSlotIds.has(slotId) || conflictSlotIds.has(`${slot.scheduledDate}:${slotId}`),
            ) ||
            conflictSlotIds.has(slot.timetableSlotId) ||
            conflictSlotIds.has(slot.slotDraftId)
              ? { ...slot, include: false }
              : slot,
          ),
        );
        setConflictNotice(
          [
            "That period is already planned.",
            error.details.scheduledDate && error.details.startTime && error.details.endTime
              ? `${error.details.scheduledDate}, ${error.details.startTime}-${error.details.endTime}`
              : null,
            error.details.existingLessonTitle ? `Existing lesson: ${error.details.existingLessonTitle}` : null,
            "Choose another available timetable period below, then continue.",
          ]
            .filter(Boolean)
            .join(" "),
        );
        setStep("timetable");
        return;
      }
      return;
    }

    const classQuery = classGroupId ? `?classGroupId=${encodeURIComponent(classGroupId)}` : "";
    setIsRedirecting(true);
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
                  <Label className="text-white/70">Primary class (timetable anchor)</Label>
                  <PremiumSelect
                    value={classGroupId}
                    onValueChange={(value) => {
                      setClassGroupId(value);
                      setAdditionalClassGroupIds([]);
                    }}
                  >
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
                  <p className="text-xs text-white/45">
                    Timetable periods are taken from this class. Content can be shared with other
                    classes you teach for the same subject.
                  </p>
                </div>

                {(ctx?.shareableClassGroups?.length ?? 0) > 0 ? (
                  <div className="space-y-2 rounded-xl border border-violet-400/20 bg-violet-500/8 p-4">
                    <Label className="text-white/80">Also use for these classes</Label>
                    <p className="text-xs text-white/45">
                      Same lesson content, separate timetable and taught status per class.
                    </p>
                    <div className="space-y-2">
                      {ctx?.shareableClassGroups.map((group) => {
                        const checked = additionalClassGroupIds.includes(group.classGroupId);
                        const label = `${group.gradeName ? `${group.gradeName} ` : ""}${group.classGroupName}`;
                        return (
                          <label
                            key={group.classGroupId}
                            className="flex cursor-pointer items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5"
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(value) => {
                                setAdditionalClassGroupIds((prev) =>
                                  value === true
                                    ? [...prev, group.classGroupId]
                                    : prev.filter((id) => id !== group.classGroupId),
                                );
                              }}
                            />
                            <span className="text-sm text-white/85">{label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {ctx?.blockReason ? (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                    {ctx.blockReason}
                  </div>
                ) : ctx?.timetableSlotCount ? (
                  <p className="text-sm text-emerald-200/90">
                    {slotDrafts.length || ctx.timetableSlotCount} teaching session
                    {(slotDrafts.length || ctx.timetableSlotCount) === 1 ? "" : "s"} found for this class and week.
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
              Consecutive periods for the same subject are grouped as double periods. You can rename each session.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {conflictNotice ? (
              <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                {conflictNotice}
              </div>
            ) : null}
            {slotDrafts.length === 0 ? (
              <p className="text-sm text-white/50">No timetable slots available.</p>
            ) : (
              slotDrafts.map((slot) => (
                <div
                  key={slot.slotDraftId}
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
                        {
                          setConflictNotice(null);
                          setSlotDrafts((prev) =>
                            prev.map((s) =>
                              s.slotDraftId === slot.slotDraftId
                                ? { ...s, include: checked === true }
                                : s,
                            ),
                          );
                        }
                      }
                      className="mt-1"
                    />
                    <div className="min-w-0 flex-1 space-y-2">
                      <p className="text-xs text-white/50">
                        {DAY_LABELS[slot.dayOfWeek] ?? "Day"} · {slot.scheduledDate} ·{" "}
                        {slot.startTime}–{slot.endTime} ·{" "}
                        {slot.isDoublePeriod
                          ? `Double period (${slot.periodCount} periods)`
                          : "Single period"}
                      </p>
                      <Input
                        value={slot.title}
                        onChange={(e) =>
                          setSlotDrafts((prev) =>
                            prev.map((s) =>
                              s.slotDraftId === slot.slotDraftId
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
              {selectedCount} of {slotDrafts.length} teaching session
              {slotDrafts.length === 1 ? "" : "s"} selected
            </p>
          </CardContent>
        </Card>
      ) : null}

      {step === "split" ? (
        <Card className="border border-white/10 bg-linear-to-br from-white/6 via-white/4 to-transparent shadow-lg shadow-black/20 backdrop-blur-xl">
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg text-white">
                  <Split className="h-5 w-5 text-teal-300" />
                  Content split
                </CardTitle>
                <p className="mt-1 text-xs text-white/50">
                  Split body, resources, and assessment across periods. Context and curriculum stay as week-level reference — they are not assigned per session.
                </p>
              </div>
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
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  {leoSplitApplied ? "Re-suggest with Leo" : "Suggest with Leo"}
                </Button>
              ) : null}
            </div>
            {leoSplitApplied ? (
              <div className="flex items-center gap-1.5 rounded-lg border border-violet-400/20 bg-violet-500/8 px-3 py-2 text-xs text-violet-200/80">
                <Sparkles className="h-3.5 w-3.5 shrink-0 text-violet-400" />
                Leo suggested this split. Review each session and adjust as needed.
              </div>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-4">
            {includedSlots.map((slot) => {
              const unassignedKeys = sectionKeys.filter((k) => !slot.noteSectionKeys.includes(k));
              const previewExpanded = expandedPreviews.has(slot.slotDraftId);
              return (
                <div
                  key={slot.slotDraftId}
                  className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3"
                >
                  {/* Period header */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-white/90">{slot.title}</span>
                    {slot.isDoublePeriod ? (
                      <span className="rounded-full border border-teal-400/30 bg-teal-500/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-teal-200">
                        Double period
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs text-white/45">
                    {DAY_LABELS[slot.dayOfWeek] ?? "Day"} · {slot.scheduledDate} · {slot.startTime}–{slot.endTime} · {slot.durationMinutes} min
                  </p>

                  {/* Teaching focus / focusSummary */}
                  <div className="space-y-1.5">
                    <Label className="text-[11px] uppercase tracking-wide text-white/40">
                      Teaching focus
                    </Label>
                    <Input
                      value={slot.focusSummary ?? ""}
                      onChange={(e) =>
                        setSlotDrafts((prev) =>
                          prev.map((s) =>
                            s.slotDraftId === slot.slotDraftId
                              ? { ...s, focusSummary: e.target.value }
                              : s,
                          ),
                        )
                      }
                      placeholder="What should students be able to do after this session?"
                      className="border-white/10 bg-black/20 text-sm text-white placeholder:text-white/30"
                    />
                  </div>

                  {/* Assigned section chips */}
                  <div className="space-y-2">
                    <Label className="text-[11px] uppercase tracking-wide text-white/40">
                      Splittable sections
                    </Label>
                    <div className="flex flex-wrap gap-2">
                      {slot.noteSectionKeys.map((key) => (
                        <div
                          key={key}
                          className="flex items-center gap-1 rounded-full border border-teal-400/25 bg-teal-500/10 pl-3 pr-1.5 py-1 text-xs text-teal-100"
                        >
                          <span>{key}</span>
                          {/* Move-to-session: only show if other sessions exist */}
                          {includedSlots.length > 1 ? (
                            <PremiumDropdownMenu>
                              <PremiumDropdownMenuTrigger asChild>
                                <button
                                  type="button"
                                  className="ml-0.5 rounded p-0.5 text-teal-300/60 hover:bg-teal-500/20 hover:text-teal-100"
                                  title="Move to another session"
                                >
                                  <ChevronRight className="h-3 w-3" />
                                </button>
                              </PremiumDropdownMenuTrigger>
                              <PremiumDropdownMenuContent align="start">
                                {includedSlots
                                  .filter((other) => other.slotDraftId !== slot.slotDraftId)
                                  .map((other) => (
                                    <PremiumDropdownMenuItem
                                      key={other.slotDraftId}
                                      onClick={() =>
                                        setSlotDrafts((prev) =>
                                          prev.map((s) => {
                                            if (s.slotDraftId === slot.slotDraftId) {
                                              return {
                                                ...s,
                                                noteSectionKeys: s.noteSectionKeys.filter(
                                                  (k) => k !== key,
                                                ),
                                              };
                                            }
                                            if (s.slotDraftId === other.slotDraftId) {
                                              return {
                                                ...s,
                                                noteSectionKeys: s.noteSectionKeys.includes(key)
                                                  ? s.noteSectionKeys
                                                  : [...s.noteSectionKeys, key],
                                              };
                                            }
                                            return s;
                                          }),
                                        )
                                      }
                                    >
                                      Move to {other.title}
                                    </PremiumDropdownMenuItem>
                                  ))}
                              </PremiumDropdownMenuContent>
                            </PremiumDropdownMenu>
                          ) : null}
                          <button
                            type="button"
                            className="ml-0.5 rounded p-0.5 text-teal-300/60 hover:bg-rose-500/20 hover:text-rose-300"
                            onClick={() =>
                              setSlotDrafts((prev) =>
                                prev.map((s) =>
                                  s.slotDraftId === slot.slotDraftId
                                    ? {
                                        ...s,
                                        noteSectionKeys: s.noteSectionKeys.filter((k) => k !== key),
                                      }
                                    : s,
                                ),
                              )
                            }
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                      {unassignedKeys.length > 0 ? (
                        <PremiumDropdownMenu>
                          <PremiumDropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/50 hover:bg-white/10 hover:text-white/80"
                            >
                              <Plus className="h-3 w-3" />
                              Add section
                              <ChevronDown className="h-3 w-3" />
                            </button>
                          </PremiumDropdownMenuTrigger>
                          <PremiumDropdownMenuContent align="start">
                            {unassignedKeys.map((key) => (
                              <PremiumDropdownMenuItem
                                key={key}
                                onClick={() =>
                                  setSlotDrafts((prev) =>
                                    prev.map((s) =>
                                      s.slotDraftId === slot.slotDraftId
                                        ? { ...s, noteSectionKeys: [...s.noteSectionKeys, key] }
                                        : s,
                                    ),
                                  )
                                }
                              >
                                {key}
                                {SECTION_KEY_DESCRIPTIONS[key] ? (
                                  <span className="ml-2 text-white/40">
                                    — {SECTION_KEY_DESCRIPTIONS[key]}
                                  </span>
                                ) : null}
                              </PremiumDropdownMenuItem>
                            ))}
                          </PremiumDropdownMenuContent>
                        </PremiumDropdownMenu>
                      ) : null}
                    </div>
                  </div>

                  {/* Section content preview (collapsible) */}
                  {slot.noteSectionKeys.length > 0 ? (
                    <div>
                      <button
                        type="button"
                        className="flex items-center gap-1 text-[11px] text-white/35 hover:text-white/60"
                        onClick={() =>
                          setExpandedPreviews((prev) => {
                            const next = new Set(prev);
                            if (next.has(slot.slotDraftId)) next.delete(slot.slotDraftId);
                            else next.add(slot.slotDraftId);
                            return next;
                          })
                        }
                      >
                        {previewExpanded ? (
                          <ChevronDown className="h-3 w-3" />
                        ) : (
                          <ChevronRight className="h-3 w-3" />
                        )}
                        {previewExpanded ? "Hide" : "Show"} section descriptions
                      </button>
                      {previewExpanded ? (
                        <ul className="mt-2 space-y-1">
                          {slot.noteSectionKeys.map((key) => (
                            <li key={key} className="text-xs text-white/45">
                              <span className="font-medium text-white/60">{key}:</span>{" "}
                              {SECTION_KEY_DESCRIPTIONS[key] ?? "Custom section."}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
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
              Generate rich blocks per period. From session 2 onwards, Leo opens with a quick review of the previous lesson — not a repeat. Edit anytime on each session page.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {leoEnabled ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={generateContent.isPending || includedSlots.length === 0}
                  onClick={() => void generateAllSessionContent()}
                  className="border-violet-400/30 bg-violet-500/10 text-violet-100"
                >
                  {generateContent.isPending ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Generate all with Leo
                </Button>
              ) : null}
              {includedSlots.map((slot, index) => (
                <Button
                  key={slot.slotDraftId}
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
                      s.slotDraftId === activeSlot.slotDraftId ? { ...s, contentBlocks: blocks } : s,
                    ),
                  )
                }
                leoEnabled={leoEnabled}
                leoLoading={generateContent.isPending}
                sessionTargets={includedSlots
                  .filter((s) => s.slotDraftId !== activeSlot.slotDraftId)
                  .map((s) => ({ id: s.slotDraftId, title: s.title }))}
                onMoveBlock={moveBlockBetweenSessions}
                onGenerateWithLeo={
                  leoEnabled
                    ? async () => {
                        const activeIndex = includedSlots.findIndex(
                          (s) => s.slotDraftId === activeSlot.slotDraftId,
                        );
                        const priorHandoffs: PriorSessionHandoff[] = includedSlots
                          .slice(0, Math.max(0, activeIndex))
                          .map((s) => ({
                            title: s.title,
                            focusSummary: s.focusSummary ?? null,
                            keyPointsSummary: summarizeContentBlocksForHandoff(s.contentBlocks),
                          }));
                        const blocks = await busyToast.promise(
                          generateContent.mutateAsync({
                            lessonNoteId: noteId,
                            session: buildSessionGenerationPayload(
                              activeSlot,
                              Math.max(0, activeIndex),
                              includedSlots,
                              priorHandoffs,
                            ),
                          }),
                          {
                            loading: "Generating content…",
                            success: "Blocks generated",
                            error: (e) => (e instanceof Error ? e.message : "Failed"),
                          },
                        );
                        setSlotDrafts((prev) =>
                          prev.map((s) =>
                            s.slotDraftId === activeSlot.slotDraftId
                              ? { ...s, contentBlocks: blocks }
                              : s,
                          ),
                        );
                      }
                    : undefined
                }
                schoolId={schoolId}
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
            {additionalClassGroupIds.length > 0 ? (
              <p className="text-sm text-violet-200/90">
                Shared with{" "}
                {additionalClassGroupIds
                  .map((id) => {
                    const match = ctx?.shareableClassGroups?.find((g) => g.classGroupId === id);
                    return match
                      ? `${match.gradeName ? `${match.gradeName} ` : ""}${match.classGroupName}`
                      : "class";
                  })
                  .join(", ")}
                . Each class gets its own timetable mapping and delivery tracking.
              </p>
            ) : null}
            <ul className="space-y-2">
              {slotDrafts
                .filter((s) => s.include)
                .map((s) => (
                  <li
                    key={s.slotDraftId}
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
            <Button
              type="button"
              variant="outline"
              disabled={previewSessions.length === 0}
              onClick={() => setShowWeekPreview(true)}
              className="border-violet-400/30 bg-violet-500/10 text-violet-100 hover:bg-violet-500/20"
            >
              <Eye className="mr-2 h-4 w-4" />
              Preview week (teaching view)
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {showWeekPreview ? (
        <LessonWeekPreviewPresenter
          weekTitle={planTitle.trim() || ctx?.lessonNote.topic || "Week plan"}
          weekLabel={ctx?.weekLabel}
          sessions={previewSessions}
          onClose={() => setShowWeekPreview(false)}
        />
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
              disabled={createMutation.isPending || isRedirecting}
              className="bg-teal-500/25 text-teal-100 hover:bg-teal-500/35"
            >
              {createMutation.isPending || isRedirecting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Check className="mr-2 h-4 w-4" />
              )}
              {isRedirecting ? "Opening lessons..." : "Create weekly lessons"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
