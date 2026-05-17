// src/components/modals/CreateClassGroupsModal.tsx
"use client";

import * as React from "react";
import { useGradeOptions } from "@/hooks/admin/useGradeOptions";
import { useBulkCreateClassGroups } from "@/hooks/admin/useBulkCreateClassGroups";
import { useSchool } from "@/hooks/admin/useSchool";
import { useSeedGrades } from "@/hooks/admin/useSeedGrades";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AlertCircle, Info, Layers3, Loader2, RefreshCw } from "lucide-react";
import { LeoIcon } from "@/components/icons/LeoIcon";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type Strategy =
  | { kind: "letters"; from: string; to: string }
  | { kind: "numbers"; from: number; to: number }
  | { kind: "custom"; names: string[] };

type DraftGradeConfig = { gradeId: string; strategy: Strategy };

type NamingPattern = "letters" | "numbers" | "themed" | "custom";

type WizardStep = 1 | 2 | 3;

type DraftResult = {
  leoSummary: string;
  gradeConfigs: DraftGradeConfig[];
};

type Props = { onClose: () => void };

const STEP_META: { step: WizardStep; label: string }[] = [
  { step: 1, label: "Basics" },
  { step: 2, label: "Grades" },
  { step: 3, label: "Review" },
];

const STREAM_NAMING_OPTION_HELP: Record<NamingPattern, string> = {
  letters:
    "Each parallel stream gets a letter suffix (A, B, C…). Example class group names: “KG1 A”, “KG1 B”. Clear and familiar for parents and teachers.",
  numbers:
    "Each stream gets a number suffix (1, 2, 3…). Example: “KG1 1”, “KG1 2”. Same structure as letters, but numeric.",
  themed:
    "Leo suggests short themed suffixes per stream (from your hint). Stream counts follow the numbers you set per grade on the Grades step. If AI isn’t configured, simple placeholder names are used instead.",
  custom:
    "You type suffixes separated by commas. They’re applied in order for each grade’s streams. If a grade needs more streams than you listed, extra names are filled in automatically (e.g. “Group 3”).",
};

const REVIEW_PATTERN_HELP: Record<"letters" | "numbers" | "custom", string> = {
  letters:
    "Stream suffixes are letters (A–Z range based on how many streams you set for this grade). Edit the count in the # column to change how many letters.",
  numbers:
    "Stream suffixes are numbers starting at 1. Change # to change how many numbered streams are created.",
  custom:
    "You control the exact suffix list (comma-separated). The plan will use these names for this grade’s streams.",
};

const CAPACITY_MODE_HELP = {
  uniform:
    "Apply one optional enrolment cap to every new class group created in this run. Leave blank for no limit on new groups (you can still edit individual classes later).",
  custom:
    "Set capacity per class group in the table (e.g. smaller KG streams, larger upper-primary). Leave a cell blank for no limit on that group. Editing stream counts or names above refreshes this list; new rows copy the “Same for all” value if set.",
} as const;

function OptionInfoIcon({ text, label }: { text: string; label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className="shrink-0 rounded p-0.5 text-white/35 outline-none hover:bg-white/10 hover:text-white/75 focus-visible:ring-1 focus-visible:ring-brand"
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <Info className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="left"
        align="center"
        className="z-400 max-w-xs border border-white/15 bg-zinc-950 px-3 py-2 text-xs leading-relaxed text-white/90 shadow-lg"
      >
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

function SelectLabelRow({
  label,
  hint,
}: {
  label: string;
  hint: React.ReactNode;
}) {
  return (
    <div className="mb-1.5 flex items-start justify-between gap-3">
      <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
        {label}
      </Label>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={`About: ${label}`}
            className="shrink-0 rounded p-1 text-white/35 hover:bg-white/10 hover:text-white/75 focus-visible:ring-1 focus-visible:ring-brand"
          >
            <Info className="h-4 w-4" strokeWidth={2} />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="left"
          className="z-400 max-w-sm border border-white/15 bg-zinc-950 px-3 py-2 text-xs leading-relaxed text-white/90 shadow-lg"
        >
          {hint}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

function strategyLetters(count: number): Strategy {
  const from = "A";
  const to = String.fromCharCode("A".charCodeAt(0) + Math.min(count, 26) - 1);
  return { kind: "letters", from, to };
}

function strategyNumbers(count: number): Strategy {
  return { kind: "numbers", from: 1, to: count };
}

function strategyCustomFromList(names: string[], count: number): Strategy {
  const base = names.filter(Boolean).slice(0, count);
  const out = [...base];
  while (out.length < count) {
    out.push(`Group ${out.length + 1}`);
  }
  return { kind: "custom", names: out };
}

function generateNamesFromStrategy(strategy: Strategy): string[] {
  if (strategy.kind === "letters") {
    const start = strategy.from.toUpperCase().charCodeAt(0);
    const end = strategy.to.toUpperCase().charCodeAt(0);
    if (isNaN(start) || isNaN(end) || end < start) return [];
    const out: string[] = [];
    for (let c = start; c <= end; c++) out.push(String.fromCharCode(c));
    return out;
  }
  if (strategy.kind === "numbers") {
    const out: string[] = [];
    for (let n = strategy.from; n <= strategy.to; n++) out.push(String(n));
    return out;
  }
  return strategy.names.map((n) => n.trim()).filter(Boolean);
}

type PlannedClassRow = { displayName: string; gradeId: string };

function plannedClassGroupRows(
  gradeConfigs: DraftGradeConfig[],
  gradeNameById: Map<string, string>
): PlannedClassRow[] {
  const rows: PlannedClassRow[] = [];
  for (const gc of gradeConfigs) {
    const gname = (gradeNameById.get(gc.gradeId) ?? "").trim();
    const parts = generateNamesFromStrategy(gc.strategy);
    for (const p of parts) {
      const displayName = `${gname} ${p}`.replace(/\s+/g, " ").trim();
      rows.push({ displayName, gradeId: gc.gradeId });
    }
  }
  return rows;
}

function streamCountFromStrategy(s: Strategy): number {
  if (s.kind === "letters") {
    const start = s.from.toUpperCase().charCodeAt(0);
    const end = s.to.toUpperCase().charCodeAt(0);
    if (isNaN(start) || isNaN(end) || end < start) return 0;
    return end - start + 1;
  }
  if (s.kind === "numbers") return Math.max(0, s.to - s.from + 1);
  return s.names.length;
}

function adjustStrategyCount(s: Strategy, n: number): Strategy {
  const count = Math.min(26, Math.max(1, n));
  if (s.kind === "letters") return strategyLetters(count);
  if (s.kind === "numbers") return strategyNumbers(count);
  const names = s.names;
  if (names.length >= count) return { kind: "custom", names: names.slice(0, count) };
  const pad = [...names];
  while (pad.length < count) pad.push(`Group ${pad.length + 1}`);
  return { kind: "custom", names: pad };
}

function customCsvFromStrategy(s: Strategy): string {
  if (s.kind !== "custom") return "";
  return s.names.join(", ");
}

function strategyFromRowPattern(
  pattern: "letters" | "numbers" | "custom",
  count: number,
  customCsv: string,
  previous: Strategy
): Strategy {
  const n = Math.min(26, Math.max(1, count));
  if (pattern === "letters") return strategyLetters(n);
  if (pattern === "numbers") return strategyNumbers(n);
  const list = customCsv
    .split(/[,;\n]/)
    .map((x) => x.trim())
    .filter(Boolean);
  if (list.length > 0) return strategyCustomFromList(list, n);
  if (previous.kind === "custom") return strategyCustomFromList(previous.names, n);
  return strategyCustomFromList([], n);
}

function previewLine(gradeName: string, strategy: Strategy): string {
  const parts = generateNamesFromStrategy(strategy);
  if (parts.length === 0) return "—";
  return parts.map((x) => `${gradeName} ${x}`).join(", ");
}

export function CreateClassGroupsModal({ onClose }: Props) {
  const {
    data: grades = [],
    isLoading: gradesLoading,
    isError: gradesIsError,
    refetch: refetchGrades,
  } = useGradeOptions();
  const { data: schoolRes } = useSchool();
  const createGroups = useBulkCreateClassGroups();
  const seedGrades = useSeedGrades();

  const [step, setStep] = React.useState<WizardStep>(1);
  const [namingPattern, setNamingPattern] = React.useState<NamingPattern>("letters");
  const [streamsPerGrade, setStreamsPerGrade] = React.useState(2);
  const [streamsByGrade, setStreamsByGrade] = React.useState<Record<string, number>>(
    {}
  );
  const [themedHint, setThemedHint] = React.useState(
    "flowers and plants — gentle, age-appropriate labels"
  );
  const [customSuffixes, setCustomSuffixes] = React.useState("Rose, Sunflower, Lily");
  const [selectedGradeIds, setSelectedGradeIds] = React.useState<string[]>([]);

  const [capacity, setCapacity] = React.useState("");
  const [capacityMode, setCapacityMode] = React.useState<"uniform" | "custom">(
    "uniform"
  );
  const [capacityByClassName, setCapacityByClassName] = React.useState<
    Record<string, string>
  >({});
  const [draft, setDraft] = React.useState<DraftResult | null>(null);
  const [draftLoading, setDraftLoading] = React.useState(false);
  const [draftError, setDraftError] = React.useState<string | null>(null);

  const gradeMap = React.useMemo(
    () => new Map(grades.map((g) => [g._id, g.name] as const)),
    [grades]
  );

  /** Selected grades in school order — avoids duplicate Radix Select values and orphan ids. */
  const selectedGradesOrdered = React.useMemo(() => {
    const seen = new Set<string>();
    const orderedIds: string[] = [];
    for (const raw of selectedGradeIds) {
      const id = String(raw).trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      orderedIds.push(id);
    }
    const want = new Set(orderedIds);
    return grades
      .filter((g) => want.has(String(g._id).trim()))
      .sort(
        (a, b) =>
          (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name)
      );
  }, [grades, selectedGradeIds]);

  const selectedGradeIdSet = React.useMemo(
    () =>
      new Set(
        selectedGradeIds.map((x) => String(x).trim()).filter(Boolean)
      ),
    [selectedGradeIds]
  );

  React.useEffect(() => {
    if (grades.length > 0 && selectedGradeIds.length === 0) {
      setSelectedGradeIds(grades.map((g) => String(g._id).trim()));
    }
  }, [grades, selectedGradeIds.length]);

  React.useEffect(() => {
    setStreamsByGrade((prev) => {
      const next = { ...prev };
      for (const id of selectedGradeIds) {
        const k = String(id).trim();
        if (!k) continue;
        if (next[k] == null || next[k] === undefined) next[k] = streamsPerGrade;
      }
      for (const key of Object.keys(next)) {
        if (!selectedGradeIdSet.has(key)) delete next[key];
      }
      return next;
    });
  }, [selectedGradeIds, selectedGradeIdSet, streamsPerGrade]);

  function buildStreamsPayload(): Record<string, number> {
    return Object.fromEntries(
      selectedGradesOrdered.map((g) => [
        g._id,
        streamsByGrade[g._id] ?? streamsPerGrade,
      ])
    );
  }

  async function requestDraft() {
    setDraftLoading(true);
    setDraftError(null);
    try {
      const res = await fetch("/api/admin/class-groups/leo-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          namingPattern,
          streamsPerGrade,
          streamsByGrade: buildStreamsPayload(),
          customSuffixes: namingPattern === "custom" ? customSuffixes : undefined,
          themedHint: namingPattern === "themed" ? themedHint : undefined,
          gradeIds: selectedGradesOrdered.map((g) => g._id),
          subjectMode: "none",
          schoolType: schoolRes?.data?.type ?? null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || res.statusText);
      setDraft({
        leoSummary: String(json.leoSummary ?? ""),
        gradeConfigs: Array.isArray(json.gradeConfigs) ? json.gradeConfigs : [],
      });
      const firstG = Array.isArray(json.gradeConfigs)
        ? json.gradeConfigs[0]?.gradeId
        : "";
      setStep(3);
    } catch (e: unknown) {
      setDraftError(e instanceof Error ? e.message : "Failed to build plan");
    } finally {
      setDraftLoading(false);
    }
  }

  function toggleGrade(id: string) {
    const k = String(id).trim();
    setSelectedGradeIds((prev) => {
      const norm = prev.map((x) => String(x).trim()).filter(Boolean);
      if (norm.includes(k)) return norm.filter((x) => x !== k);
      return [...norm, k];
    });
  }

  function selectAllGrades() {
    setSelectedGradeIds(grades.map((g) => String(g._id).trim()));
  }

  function applyDefaultStreamsToAll() {
    setStreamsByGrade((prev) => {
      const next = { ...prev };
      for (const g of selectedGradesOrdered) next[g._id] = streamsPerGrade;
      return next;
    });
  }

  async function seedGradeLevels() {
    await seedGrades.mutateAsync();
    await refetchGrades();
  }

  const reviewPlannedRows = React.useMemo(() => {
    if (!draft?.gradeConfigs?.length) return [];
    return plannedClassGroupRows(draft.gradeConfigs, gradeMap);
  }, [draft?.gradeConfigs, gradeMap]);

  React.useEffect(() => {
    if (capacityMode !== "custom" || reviewPlannedRows.length === 0) return;
    setCapacityByClassName((prev) => {
      const next = { ...prev };
      const valid = new Set(reviewPlannedRows.map((r) => r.displayName));
      const seed = capacity.trim();
      for (const r of reviewPlannedRows) {
        if (!(r.displayName in next)) next[r.displayName] = seed;
      }
      for (const k of Object.keys(next)) {
        if (!valid.has(k)) delete next[k];
      }
      return next;
    });
  }, [reviewPlannedRows, capacityMode]);

  async function onConfirmCreate() {
    if (!draft?.gradeConfigs?.length) return;
    try {
      const payload: {
        gradeConfigs: DraftGradeConfig[];
        capacity?: number | null;
        capacitiesByClassName?: Record<string, number | null>;
      } = {
        gradeConfigs: draft.gradeConfigs,
      };

      if (capacityMode === "uniform") {
        if (capacity.trim()) {
          const n = Number(capacity);
          if (Number.isFinite(n) && n >= 0) payload.capacity = n;
        }
      } else {
        payload.capacity = null;
        const capMap: Record<string, number | null> = {};
        for (const r of reviewPlannedRows) {
          const raw = (capacityByClassName[r.displayName] ?? "").trim();
          capMap[r.displayName] =
            raw === ""
              ? null
              : Number.isFinite(Number(raw)) && Number(raw) >= 0
                ? Number(raw)
                : null;
        }
        payload.capacitiesByClassName = capMap;
      }

      await createGroups.mutateAsync(payload);
      onClose();
    } catch {
      /* mutation toast */
    }
  }

  function patchDraftGrade(
    gradeId: string,
    updater: (gc: DraftGradeConfig) => DraftGradeConfig
  ) {
    setDraft((d) => {
      if (!d) return d;
      return {
        ...d,
        gradeConfigs: d.gradeConfigs.map((gc) =>
          gc.gradeId === gradeId ? updater(gc) : gc
        ),
      };
    });
  }

  const canNextFrom1 =
    streamsPerGrade >= 1 &&
    streamsPerGrade <= 26 &&
    (namingPattern !== "custom" ||
      customSuffixes.split(/[,;\n]/).some((s) => s.trim().length > 0));

  const canNextFrom2 =
    !gradesLoading &&
    selectedGradesOrdered.length > 0 &&
    selectedGradesOrdered.every((g) => {
      const n = streamsByGrade[g._id] ?? streamsPerGrade;
      return n >= 1 && n <= 26;
    });

  const reviewRowPattern = (s: Strategy) => rowPatternFromStrategy(s);

  return (
    <TooltipProvider delayDuration={280}>
    <div className="flex max-h-full flex-col space-y-5">
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 pb-4">
        {STEP_META.map(({ step: s, label }, i) => (
          <React.Fragment key={s}>
            {i > 0 ? (
              <span className="text-white/25" aria-hidden>
                /
              </span>
            ) : null}
            <span
              className={cn(
                "rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]",
                step === s
                  ? "bg-brand/20 text-brand ring-1 ring-brand/30"
                  : step > s
                    ? "text-white/45"
                    : "text-white/30"
              )}
            >
              {s} {label}
            </span>
          </React.Fragment>
        ))}
      </div>

      {step === 1 && (
        <>
          <LeoCallout>
            <p className="text-sm leading-relaxed text-white/85">
              Hi, I&apos;m <span className="font-semibold text-violet-200">Leo</span>.
              We&apos;ll set up <strong>class groups</strong> (parallel streams) for
              your grades—like <em>KG1 A</em> / <em>KG1 B</em>, or themed names such
              as <em>KG1 Rose</em>. Choose naming below; you can set{" "}
              <strong>different stream counts per grade</strong> on the next step.
            </p>
          </LeoCallout>

          <div className="space-y-2">
            <SelectLabelRow
              label="1. How should stream names work?"
              hint={
                <div className="space-y-2">
                  <p>
                    This controls the <strong>suffix</strong> for each parallel class
                    group (the part after the grade name, e.g. “A” or “Rose”).
                  </p>
                  <p className="text-white/75">
                    Hover or focus the ⓘ beside each choice in the menu for exactly
                    what gets created.
                  </p>
                </div>
              }
            />
            <PremiumSelect
              value={namingPattern}
              onValueChange={(v) => setNamingPattern(v as NamingPattern)}
            >
              <PremiumSelectTrigger className="w-full">
                <PremiumSelectValue placeholder="Naming pattern" />
              </PremiumSelectTrigger>
              <PremiumSelectContent className="z-300">
                <PremiumSelectItem value="letters">
                  <span className="flex w-full min-w-0 items-center gap-2 pr-0.5">
                    <span className="min-w-0 flex-1 truncate">
                      Letters (e.g. KG1 A, KG1 B)
                    </span>
                    <OptionInfoIcon
                      text={STREAM_NAMING_OPTION_HELP.letters}
                      label="About letter suffixes"
                    />
                  </span>
                </PremiumSelectItem>
                <PremiumSelectItem value="numbers">
                  <span className="flex w-full min-w-0 items-center gap-2 pr-0.5">
                    <span className="min-w-0 flex-1 truncate">
                      Numbers (e.g. KG1 1, KG1 2)
                    </span>
                    <OptionInfoIcon
                      text={STREAM_NAMING_OPTION_HELP.numbers}
                      label="About number suffixes"
                    />
                  </span>
                </PremiumSelectItem>
                <PremiumSelectItem value="themed">
                  <span className="flex w-full min-w-0 items-center gap-2 pr-0.5">
                    <span className="min-w-0 flex-1 truncate">
                      Themed — Leo suggests labels (flowers, virtues, colours…)
                    </span>
                    <OptionInfoIcon
                      text={STREAM_NAMING_OPTION_HELP.themed}
                      label="About themed names"
                    />
                  </span>
                </PremiumSelectItem>
                <PremiumSelectItem value="custom">
                  <span className="flex w-full min-w-0 items-center gap-2 pr-0.5">
                    <span className="min-w-0 flex-1 truncate">
                      Custom suffixes — I&apos;ll type them
                    </span>
                    <OptionInfoIcon
                      text={STREAM_NAMING_OPTION_HELP.custom}
                      label="About custom suffixes"
                    />
                  </span>
                </PremiumSelectItem>
              </PremiumSelectContent>
            </PremiumSelect>
          </div>

          <div className="space-y-2">
            <SelectLabelRow
              label="2. Default streams per grade"
              hint={
                <p>
                  Newly checked grades on the next step start with this stream
                  count. You can still set each grade differently there, or use
                  “Apply N to all” to reset every selected grade at once.
                </p>
              }
            />
            <Input
              type="number"
              min={1}
              max={26}
              value={streamsPerGrade}
              onChange={(e) =>
                setStreamsPerGrade(Number(e.target.value) || 1)
              }
              className="border border-white/10 bg-white/5 text-white"
            />
            <p className="text-xs text-white/45">
              Newly selected grades start with this count. Adjust individual grades
              on step 2, or use &quot;Apply default to all&quot; there.
            </p>
          </div>

          {namingPattern === "themed" ? (
            <div className="space-y-2">
              <SelectLabelRow
                label="Theme hint for Leo (optional)"
                hint={
                  <p>
                    Short guidance for themed suffixes (e.g. “local birds” or
                    “virtues”). Leo uses it together with each grade’s stream count.
                    If AI isn’t available, you’ll get simple placeholder names instead.
                  </p>
                }
              />
              <Input
                value={themedHint}
                onChange={(e) => setThemedHint(e.target.value)}
                placeholder="e.g. local flowers, moral virtues, colours…"
                className="border border-white/10 bg-white/5 text-white"
              />
            </div>
          ) : null}

          {namingPattern === "custom" ? (
            <div className="space-y-2">
              <SelectLabelRow
                label="Custom suffixes (comma-separated)"
                hint={
                  <p>
                    List the suffixes you want in order. They apply per grade based
                    on how many streams that grade has; extra streams get
                    auto-filled names if the list is too short.
                  </p>
                }
              />
              <Input
                value={customSuffixes}
                onChange={(e) => setCustomSuffixes(e.target.value)}
                placeholder="Rose, Sunflower, Lily"
                className="border border-white/10 bg-white/5 text-white"
              />
            </div>
          ) : null}
        </>
      )}

      {step === 2 && (
        <>
          <LeoCallout>
            <p className="text-sm leading-relaxed text-white/85">
              Pick which levels get class groups, and how many parallel streams each
              one needs — KG might use two streams while P6 uses four, all in one
              pass.
            </p>
          </LeoCallout>

          <SelectLabelRow
            label="Grades & stream counts"
            hint={
              <p>
                Check every level that should get new class groups. Each row has
                its own stream count so lower grades and JHS can differ. Grades
                are listed in your school’s usual order.
              </p>
            }
          />
          {gradesLoading ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center gap-2 text-sm text-white/70">
                <Loader2 className="h-4 w-4 animate-spin text-brand" />
                Loading grade levels…
              </div>
              <div className="mt-4 space-y-2">
                {[0, 1, 2].map((row) => (
                  <div
                    key={row}
                    className="h-12 animate-pulse rounded-lg border border-white/10 bg-white/5"
                  />
                ))}
              </div>
            </div>
          ) : gradesIsError ? (
            <div className="rounded-2xl border border-rose-400/25 bg-rose-500/10 p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-4 w-4 text-rose-200" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-rose-50">
                    Grade levels could not be loaded.
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-rose-100/75">
                    Class groups must belong to real grade levels. Try loading the
                    grades again before continuing.
                  </p>
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-4 border-rose-300/30 bg-rose-300/10 text-rose-50 hover:bg-rose-300/20"
                onClick={() => void refetchGrades()}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry
              </Button>
            </div>
          ) : grades.length === 0 ? (
            <div className="rounded-2xl border border-amber-300/25 bg-amber-400/10 p-4">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-300/25 bg-amber-300/10">
                  <Layers3 className="h-4 w-4 text-amber-100" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-amber-50">
                    No grade levels are set up yet.
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-amber-50/75">
                    Create the school&apos;s grade levels first, then this step will
                    show each level with its stream count.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      className="bg-amber-200 text-slate-950 hover:bg-amber-100"
                      disabled={seedGrades.isPending}
                      onClick={() => void seedGradeLevels()}
                    >
                      {seedGrades.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Layers3 className="mr-2 h-4 w-4" />
                      )}
                      Set up grade levels
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="border-white/10 bg-white/5 text-white hover:bg-white/10"
                      onClick={() => void refetchGrades()}
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Refresh
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={selectAllGrades}
                  className="border-white/10 bg-white/5 text-xs text-white hover:bg-white/10"
                >
                  Select all
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={applyDefaultStreamsToAll}
                  className="border-white/10 bg-white/5 text-xs text-white hover:bg-white/10"
                >
                  Apply {streamsPerGrade} to all
                </Button>
              </div>
              <div className="grid max-h-56 gap-2 overflow-auto pr-1">
                {grades.map((g) => (
                  <div
                    key={g._id}
                    className="flex flex-wrap items-center gap-3 rounded-md border border-white/10 bg-white/5 p-2"
                  >
                    <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedGradeIdSet.has(String(g._id).trim())}
                        onChange={() => toggleGrade(g._id)}
                        className="h-4 w-4 shrink-0 cursor-pointer rounded border-white/20 bg-white/5 accent-brand"
                      />
                      <span className="truncate text-sm text-white/80">{g.name}</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase tracking-wider text-white/40">
                        Streams
                      </span>
                      <Input
                        type="number"
                        min={1}
                        max={26}
                        disabled={!selectedGradeIdSet.has(String(g._id).trim())}
                        value={streamsByGrade[g._id] ?? streamsPerGrade}
                        onChange={(e) => {
                          const n = Number(e.target.value) || 1;
                          setStreamsByGrade((prev) => ({
                            ...prev,
                            [g._id]: Math.min(26, Math.max(1, n)),
                          }));
                        }}
                        className="h-9 w-16 border border-white/10 bg-white/5 text-center text-sm text-white disabled:opacity-40"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {step === 3 && draft && (
        <>
          <LeoCallout>
            <p className="text-sm leading-relaxed text-white/85">{draft.leoSummary}</p>
          </LeoCallout>

          <div className="space-y-2">
            <SelectLabelRow
              label="Edit plan — streams, naming, preview"
              hint={
                <p>
                  Adjust stream counts, naming pattern, or custom suffixes per grade
                  before saving. Changes update the preview column immediately. Use
                  the ⓘ in each pattern menu for what letters, numbers, or custom
                  lists do in this step.
                </p>
              }
            />
            <div className="overflow-hidden rounded-lg border border-white/10 bg-white/5">
              <div className="max-h-72 overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-1 bg-white/10 backdrop-blur-sm">
                    <tr className="border-b border-white/10">
                      <th className="p-2 text-left text-[10px] font-medium uppercase tracking-wider text-white/55">
                        Grade
                      </th>
                      <th className="p-2 text-left text-[10px] font-medium uppercase tracking-wider text-white/55">
                        #
                      </th>
                      <th className="p-2 text-left text-[10px] font-medium uppercase tracking-wider text-white/55">
                        Pattern
                      </th>
                      <th className="p-2 text-left text-[10px] font-medium uppercase tracking-wider text-white/55">
                        Custom
                      </th>
                      <th className="p-2 text-left text-[10px] font-medium uppercase tracking-wider text-white/55">
                        Preview
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {draft.gradeConfigs.map((gc) => {
                      const count = streamCountFromStrategy(gc.strategy);
                      const pattern = reviewRowPattern(gc.strategy);
                      const csv = customCsvFromStrategy(gc.strategy);
                      return (
                        <tr
                          key={gc.gradeId}
                          className="border-b border-white/5 last:border-b-0 align-top"
                        >
                          <td className="p-2 font-medium text-white">
                            {gradeMap.get(gc.gradeId) ?? gc.gradeId}
                          </td>
                          <td className="p-2">
                            <Input
                              type="number"
                              min={1}
                              max={26}
                              value={count || 1}
                              onChange={(e) => {
                                const n = Number(e.target.value) || 1;
                                patchDraftGrade(gc.gradeId, (row) => ({
                                  ...row,
                                  strategy: adjustStrategyCount(row.strategy, n),
                                }));
                              }}
                              className="h-9 w-14 border border-white/10 bg-white/5 text-center text-xs text-white"
                            />
                          </td>
                          <td className="p-2">
                            <PremiumSelect
                              value={pattern}
                              onValueChange={(v) => {
                                const p = v as "letters" | "numbers" | "custom";
                                patchDraftGrade(gc.gradeId, (row) => ({
                                  ...row,
                                  strategy: strategyFromRowPattern(
                                    p,
                                    streamCountFromStrategy(row.strategy) || 1,
                                    customCsvFromStrategy(row.strategy),
                                    row.strategy
                                  ),
                                }));
                              }}
                            >
                              <PremiumSelectTrigger className="h-9 min-w-28 text-xs">
                                <PremiumSelectValue />
                              </PremiumSelectTrigger>
                              <PremiumSelectContent className="z-300">
                                <PremiumSelectItem value="letters">
                                  <span className="flex w-full min-w-0 items-center gap-2 pr-0.5">
                                    <span className="min-w-0 flex-1 truncate">
                                      Letters
                                    </span>
                                    <OptionInfoIcon
                                      text={REVIEW_PATTERN_HELP.letters}
                                      label="Review: letters pattern"
                                    />
                                  </span>
                                </PremiumSelectItem>
                                <PremiumSelectItem value="numbers">
                                  <span className="flex w-full min-w-0 items-center gap-2 pr-0.5">
                                    <span className="min-w-0 flex-1 truncate">
                                      Numbers
                                    </span>
                                    <OptionInfoIcon
                                      text={REVIEW_PATTERN_HELP.numbers}
                                      label="Review: numbers pattern"
                                    />
                                  </span>
                                </PremiumSelectItem>
                                <PremiumSelectItem value="custom">
                                  <span className="flex w-full min-w-0 items-center gap-2 pr-0.5">
                                    <span className="min-w-0 flex-1 truncate">
                                      Custom list
                                    </span>
                                    <OptionInfoIcon
                                      text={REVIEW_PATTERN_HELP.custom}
                                      label="Review: custom pattern"
                                    />
                                  </span>
                                </PremiumSelectItem>
                              </PremiumSelectContent>
                            </PremiumSelect>
                          </td>
                          <td className="max-w-[140px] p-2">
                            {pattern === "custom" ? (
                              <Input
                                value={csv}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  patchDraftGrade(gc.gradeId, (row) => ({
                                    ...row,
                                    strategy: strategyFromRowPattern(
                                      "custom",
                                      streamCountFromStrategy(row.strategy) || 1,
                                      val,
                                      row.strategy
                                    ),
                                  }));
                                }}
                                className="h-9 border border-white/10 bg-white/5 text-xs text-white"
                              />
                            ) : (
                              <span className="text-[10px] text-white/35">—</span>
                            )}
                          </td>
                          <td className="p-2 text-[11px] leading-snug text-white/65">
                            {previewLine(
                              gradeMap.get(gc.gradeId) ?? "",
                              gc.strategy
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="space-y-3 rounded-lg border border-white/10 bg-black/15 p-3">
            <SelectLabelRow
              label="Capacity (optional)"
              hint={
                <div className="space-y-2">
                  <p>
                    <strong>Same for all</strong> sets one enrolment cap on every
                    new class group. <strong>Per class group</strong> lets you type
                    a different cap for each exact name in the plan (or leave blank
                    for no limit on that group).
                  </p>
                  <p className="text-white/75">
                    Use the ⓘ in the menu for more detail. In per-group mode, you
                    can fill every row from the shared value with one click.
                  </p>
                </div>
              }
            />
            <PremiumSelect
              value={capacityMode}
              onValueChange={(v) => {
                const m = v as "uniform" | "custom";
                if (m === "custom") {
                  setCapacityByClassName(
                    Object.fromEntries(
                      reviewPlannedRows.map((r) => [
                        r.displayName,
                        capacity.trim(),
                      ])
                    )
                  );
                }
                setCapacityMode(m);
              }}
            >
              <PremiumSelectTrigger className="w-full">
                <PremiumSelectValue placeholder="Capacity mode" />
              </PremiumSelectTrigger>
              <PremiumSelectContent className="z-300">
                <PremiumSelectItem value="uniform">
                  <span className="flex w-full min-w-0 items-center gap-2 pr-0.5">
                    <span className="min-w-0 flex-1 truncate">
                      Same capacity for every new class group
                    </span>
                    <OptionInfoIcon
                      text={CAPACITY_MODE_HELP.uniform}
                      label="About uniform capacity"
                    />
                  </span>
                </PremiumSelectItem>
                <PremiumSelectItem value="custom">
                  <span className="flex w-full min-w-0 items-center gap-2 pr-0.5">
                    <span className="min-w-0 flex-1 truncate">
                      Set capacity per class group
                    </span>
                    <OptionInfoIcon
                      text={CAPACITY_MODE_HELP.custom}
                      label="About per-group capacity"
                    />
                  </span>
                </PremiumSelectItem>
              </PremiumSelectContent>
            </PremiumSelect>

            <div className="space-y-2">
              <Label className="text-[10px] font-medium uppercase tracking-wider text-white/45">
                {capacityMode === "uniform"
                  ? "Capacity for all groups"
                  : "Default / fill value (optional)"}
              </Label>
              <div className="flex flex-wrap items-end gap-2">
                <Input
                  type="number"
                  min={0}
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                  placeholder="e.g. 35 — leave empty for no limit"
                  className="min-w-40 flex-1 border border-white/10 bg-white/5 text-white"
                />
                {capacityMode === "custom" ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-white/10 bg-white/5 text-xs text-white hover:bg-white/10"
                    onClick={() =>
                      setCapacityByClassName(
                        Object.fromEntries(
                          reviewPlannedRows.map((r) => [
                            r.displayName,
                            capacity.trim(),
                          ])
                        )
                      )
                    }
                  >
                    Apply to all rows
                  </Button>
                ) : null}
              </div>
            </div>

            {capacityMode === "custom" ? (
              <div className="overflow-hidden rounded-md border border-white/10 bg-white/5">
                <div className="max-h-52 overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 z-1 bg-white/10 backdrop-blur-sm">
                      <tr className="border-b border-white/10">
                        <th className="p-2 text-left text-[10px] font-medium uppercase tracking-wider text-white/55">
                          Class group
                        </th>
                        <th className="w-28 p-2 text-left text-[10px] font-medium uppercase tracking-wider text-white/55">
                          Capacity
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {reviewPlannedRows.map((r) => (
                        <tr
                          key={r.displayName}
                          className="border-b border-white/5 last:border-b-0"
                        >
                          <td className="p-2 text-xs text-white/80">
                            {r.displayName}
                          </td>
                          <td className="p-2">
                            <Input
                              type="number"
                              min={0}
                              value={capacityByClassName[r.displayName] ?? ""}
                              onChange={(e) =>
                                setCapacityByClassName((prev) => ({
                                  ...prev,
                                  [r.displayName]: e.target.value,
                                }))
                              }
                              placeholder="—"
                              className="h-8 border border-white/10 bg-white/5 text-xs text-white"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </div>
        </>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-white/10 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          className="border-white/10 bg-white/5 text-white hover:bg-white/10"
        >
          Cancel
        </Button>
        {step > 1 && step < 3 ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => setStep((s) => (s > 1 ? ((s - 1) as WizardStep) : s))}
            className="border-white/10 bg-white/5 text-white hover:bg-white/10"
          >
            Back
          </Button>
        ) : null}
        {step === 3 ? (
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep(2)}
              className="border-white/10 bg-white/5 text-white hover:bg-white/10"
            >
              Adjust grades
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDraft(null);
                setStep(1);
              }}
              className="border-white/10 bg-white/5 text-white hover:bg-white/10"
            >
              Start over
            </Button>
            <Button
              type="button"
              disabled={!draft?.gradeConfigs?.length || createGroups.isPending}
              onClick={() => void onConfirmCreate()}
              className="bg-brand text-black hover:opacity-90"
            >
              {createGroups.isPending ? "Saving…" : "Create class groups"}
            </Button>
          </>
        ) : step === 2 ? (
          <Button
            type="button"
            disabled={!canNextFrom2 || draftLoading}
            onClick={() => void requestDraft()}
            className="bg-brand text-black hover:opacity-90"
          >
            {draftLoading ? "Leo is planning…" : "Build plan & review"}
          </Button>
        ) : (
          <Button
            type="button"
            disabled={
              step === 1 && !canNextFrom1
            }
            onClick={() => setStep(2)}
            className="bg-brand text-black hover:opacity-90"
          >
            Continue
          </Button>
        )}
      </div>
    </div>
    </TooltipProvider>
  );
}

function rowPatternFromStrategy(s: Strategy): "letters" | "numbers" | "custom" {
  return s.kind;
}

function LeoCallout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 rounded-xl border border-violet-500/20 bg-violet-500/[0.07] p-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-violet-400/25 bg-violet-500/15">
        <LeoIcon className="h-5 w-5 text-violet-200" />
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
