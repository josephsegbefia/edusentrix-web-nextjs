"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Loader2,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import { cn } from "@/lib/utils";

export type SupplyWizardFormOptions = {
  grades: { id: string; name: string }[];
  classGroups: { id: string; name: string; gradeId: string }[];
};

type AudienceMode = "whole_school" | "grades" | "class_groups" | "students";

const STEPS: { id: string; label: string }[] = [
  { id: "basics", label: "Basics" },
  { id: "schedule", label: "Schedule" },
  { id: "audience", label: "Who" },
  { id: "review", label: "Review" },
];

function toIsoOrNull(local: string): string | null {
  const t = local?.trim();
  if (!t) return null;
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function classGroupLabel(
  cg: { name: string; gradeId: string },
  grades: { id: string; name: string }[]
) {
  const g = grades.find((x) => x.id === cg.gradeId);
  return g ? `${g.name} · ${cg.name}` : cg.name;
}

type SupplyProgramWizardProps = {
  options: SupplyWizardFormOptions;
  onComplete: (programId: string) => void;
  onCancel: () => void;
};

export function SupplyProgramWizard({
  options,
  onComplete,
  onCancel,
}: SupplyProgramWizardProps) {
  const [currentStepIndex, setCurrentStepIndex] = React.useState(0);
  /** Furthest step the user has reached — enables jumping back via the step rail */
  const [maxReachedIndex, setMaxReachedIndex] = React.useState(0);

  const [name, setName] = React.useState("");
  const [periodLabel, setPeriodLabel] = React.useState("");
  const [description, setDescription] = React.useState("");

  const [validFromLocal, setValidFromLocal] = React.useState("");
  const [validToLocal, setValidToLocal] = React.useState("");
  const [purchaseByLocal, setPurchaseByLocal] = React.useState("");

  const [audienceMode, setAudienceMode] = React.useState<AudienceMode>(
    "whole_school"
  );
  const [gradeIds, setGradeIds] = React.useState<Set<string>>(() => new Set());
  const [classGroupIds, setClassGroupIds] = React.useState<Set<string>>(
    () => new Set()
  );
  const [studentIdsRaw, setStudentIdsRaw] = React.useState("");

  const [submitting, setSubmitting] = React.useState(false);

  const currentStep = STEPS[currentStepIndex]!;
  const isLast = currentStepIndex === STEPS.length - 1;

  const audienceIdsForApi = React.useMemo(() => {
    if (audienceMode === "whole_school") return [];
    if (audienceMode === "grades") return Array.from(gradeIds);
    if (audienceMode === "class_groups") return Array.from(classGroupIds);
    return studentIdsRaw
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }, [audienceMode, gradeIds, classGroupIds, studentIdsRaw]);

  const validationMessage = React.useMemo(() => {
    if (currentStep.id === "basics" && !name.trim()) {
      return "Enter a name for this supply program.";
    }
    if (currentStep.id === "audience") {
      if (audienceMode === "whole_school") return null;
      if (audienceIdsForApi.length === 0) {
        return "Select at least one target, or paste student IDs.";
      }
    }
    return null;
  }, [currentStep.id, name, audienceMode, audienceIdsForApi.length]);

  const canProceed = !validationMessage;

  function goNext() {
    if (!canProceed) return;
    setMaxReachedIndex((m) => Math.max(m, currentStepIndex + 1));
    setCurrentStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  }

  function goBack() {
    setCurrentStepIndex((i) => Math.max(0, i - 1));
  }

  function goToStep(index: number) {
    if (index <= maxReachedIndex) setCurrentStepIndex(index);
  }

  function toggleSet(
    set: Set<string>,
    id: string,
    setter: React.Dispatch<React.SetStateAction<Set<string>>>
  ) {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit() {
    if (!name.trim()) {
      toast.error("Enter a program name");
      return;
    }
    if (audienceMode !== "whole_school" && audienceIdsForApi.length === 0) {
      toast.error("Choose who this list applies to");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/supply-programs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          periodLabel: periodLabel.trim() || null,
          validFrom: toIsoOrNull(validFromLocal),
          validTo: toIsoOrNull(validToLocal),
          purchaseByDate: toIsoOrNull(purchaseByLocal),
          audienceMode,
          audienceIds: audienceIdsForApi,
          status: "draft",
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to create program");
      }
      toast.success("Draft program created");
      const id = json.data?.id as string | undefined;
      if (id) onComplete(id);
      else onCancel();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  }

  function renderStepBody() {
    switch (currentStep.id) {
      case "basics":
        return (
          <div className="space-y-6">
            <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4 text-sm text-white/80 leading-relaxed">
              <div className="flex items-center gap-2 font-medium text-indigo-200/95 mb-2">
                <Sparkles className="h-4 w-4 text-indigo-300" />
                What is a supply program?
              </div>
              <p>
                A supply program is a published list of store items for a period (e.g. a
                term). You target grades, classes, or individual students. Parents see
                what is required and optional, set their purchase order, and pay through
                the same Paystack flow as the school store.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label className="text-white/80">Program name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/35"
                  placeholder="e.g. Term 2 · Required supplies"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-white/80">Period label (optional)</Label>
                <Input
                  value={periodLabel}
                  onChange={(e) => setPeriodLabel(e.target.value)}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/35"
                  placeholder="e.g. Term 2 · 2025/26"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label className="text-white/80">Notes for staff (optional)</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="min-h-[100px] bg-white/5 border-white/10 text-white placeholder:text-white/35"
                  placeholder="Internal context — not shown to parents until you link lines and publish."
                />
              </div>
            </div>
          </div>
        );

      case "schedule":
        return (
          <div className="space-y-6">
            <p className="text-sm text-white/65 leading-relaxed">
              Optional dates help parents understand when this list is in effect and if
              there is a suggested purchase-by date. You can leave everything blank and
              set dates later.
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-white/80">Valid from</Label>
                <Input
                  type="datetime-local"
                  value={validFromLocal}
                  onChange={(e) => setValidFromLocal(e.target.value)}
                  className="bg-white/5 border-white/10 text-white scheme-dark"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-white/80">Valid to</Label>
                <Input
                  type="datetime-local"
                  value={validToLocal}
                  onChange={(e) => setValidToLocal(e.target.value)}
                  className="bg-white/5 border-white/10 text-white scheme-dark"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label className="text-white/80">Purchase by (reminder)</Label>
                <Input
                  type="datetime-local"
                  value={purchaseByLocal}
                  onChange={(e) => setPurchaseByLocal(e.target.value)}
                  className="bg-white/5 border-white/10 text-white scheme-dark max-w-md"
                />
              </div>
            </div>
          </div>
        );

      case "audience":
        return (
          <div className="space-y-6">
            <p className="text-sm text-white/65 leading-relaxed">
              Choose who should see this list when it is published. You can narrow to
              grades, classes, or specific students.
            </p>
            <div className="space-y-2 max-w-xl">
              <Label className="text-white/80">Audience type</Label>
              <PremiumSelect
                value={audienceMode}
                onValueChange={(v) => setAudienceMode(v as AudienceMode)}
              >
                <PremiumSelectTrigger className="w-full bg-white/5 border-white/10 text-white">
                  <PremiumSelectValue placeholder="Select audience" />
                </PremiumSelectTrigger>
                <PremiumSelectContent>
                  <PremiumSelectItem value="whole_school" description="All active students">
                    Whole school
                  </PremiumSelectItem>
                  <PremiumSelectItem value="grades" description="One or more grade levels">
                    Specific grades
                  </PremiumSelectItem>
                  <PremiumSelectItem
                    value="class_groups"
                    description="Named classes within grades"
                  >
                    Specific classes
                  </PremiumSelectItem>
                  <PremiumSelectItem
                    value="students"
                    description="Paste MongoDB student IDs"
                  >
                    Specific students
                  </PremiumSelectItem>
                </PremiumSelectContent>
              </PremiumSelect>
            </div>

            {audienceMode === "grades" ? (
              <div className="space-y-3">
                <Label className="text-white/80">Grades</Label>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {options.grades.map((g) => (
                    <label
                      key={g.id}
                      className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white/90 cursor-pointer hover:bg-white/10"
                    >
                      <Checkbox
                        checked={gradeIds.has(g.id)}
                        onCheckedChange={() => toggleSet(gradeIds, g.id, setGradeIds)}
                        className="border-white/25 data-[state=checked]:bg-brand data-[state=checked]:border-brand data-[state=checked]:text-black"
                      />
                      {g.name}
                    </label>
                  ))}
                </div>
                {options.grades.length === 0 ? (
                  <p className="text-sm text-amber-200/80">No grades found for this school.</p>
                ) : null}
              </div>
            ) : null}

            {audienceMode === "class_groups" ? (
              <div className="space-y-3">
                <Label className="text-white/80">Classes</Label>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 max-h-[280px] overflow-y-auto pr-1">
                  {options.classGroups.map((cg) => (
                    <label
                      key={cg.id}
                      className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white/90 cursor-pointer hover:bg-white/10"
                    >
                      <Checkbox
                        checked={classGroupIds.has(cg.id)}
                        onCheckedChange={() =>
                          toggleSet(classGroupIds, cg.id, setClassGroupIds)
                        }
                        className="border-white/25 data-[state=checked]:bg-brand data-[state=checked]:border-brand data-[state=checked]:text-black"
                      />
                      <span className="truncate">
                        {classGroupLabel(cg, options.grades)}
                      </span>
                    </label>
                  ))}
                </div>
                {options.classGroups.length === 0 ? (
                  <p className="text-sm text-amber-200/80">
                    No class groups found for this school.
                  </p>
                ) : null}
              </div>
            ) : null}

            {audienceMode === "students" ? (
              <div className="space-y-2">
                <Label className="text-white/80">Student IDs</Label>
                <Textarea
                  value={studentIdsRaw}
                  onChange={(e) => setStudentIdsRaw(e.target.value)}
                  className="min-h-[120px] font-mono text-sm bg-white/5 border-white/10 text-white placeholder:text-white/35"
                  placeholder="Paste one MongoDB ObjectId per line or comma-separated…"
                />
                <p className="text-xs text-white/45">
                  Use student IDs from your Students directory. IDs are validated when you
                  create the draft.
                </p>
              </div>
            ) : null}
          </div>
        );

      case "review":
        return (
          <div className="space-y-6">
            <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-4 text-sm">
              <div className="flex items-start gap-3">
                <ClipboardList className="h-5 w-5 text-brand shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-white">{name.trim() || "—"}</p>
                  {periodLabel.trim() ? (
                    <p className="text-white/55 mt-1">{periodLabel.trim()}</p>
                  ) : null}
                </div>
              </div>
              {description.trim() ? (
                <p className="text-white/60 border-t border-white/10 pt-3 whitespace-pre-wrap">
                  {description.trim()}
                </p>
              ) : null}
              <dl className="grid gap-2 border-t border-white/10 pt-3 text-white/75">
                <div className="flex justify-between gap-4">
                  <dt className="text-white/45">Schedule</dt>
                  <dd className="text-right">
                    {[validFromLocal, validToLocal, purchaseByLocal].some(Boolean)
                      ? [
                          validFromLocal && `From ${validFromLocal}`,
                          validToLocal && `To ${validToLocal}`,
                          purchaseByLocal && `Buy by ${purchaseByLocal}`,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "Not set"
                      : "Not set"}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-white/45">Audience</dt>
                  <dd className="text-right capitalize">
                    {audienceMode.replace("_", " ")}
                    {audienceMode !== "whole_school"
                      ? ` · ${audienceIdsForApi.length} target(s)`
                      : ""}
                  </dd>
                </div>
              </dl>
            </div>
            <p className="text-xs text-white/45">
              Next, add lines that map to store products. Publish when you are ready for
              parents to see the list.
            </p>
          </div>
        );

      default:
        return null;
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Create supply program</h2>
          <p className="text-sm text-white/55 mt-0.5">
            Step-by-step — same flow as lesson planning, tuned for lists and targeting.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-center gap-1 sm:gap-2 flex-wrap">
        {STEPS.map((step, index) => {
          const isPast = index < currentStepIndex;
          const isCurrent = currentStepIndex === index;
          const reachable = index <= maxReachedIndex;

          return (
            <React.Fragment key={step.id}>
              {index > 0 ? (
                <div
                  className={cn(
                    "h-px w-4 sm:w-8 transition-colors shrink-0",
                    isPast ? "bg-emerald-500/70" : "bg-white/10"
                  )}
                />
              ) : null}
              <button
                type="button"
                disabled={!reachable}
                onClick={() => goToStep(index)}
                className={cn(
                  "flex items-center gap-1.5 sm:gap-2 rounded-full px-2.5 sm:px-3 py-1.5 text-xs font-medium transition-all",
                  !reachable && "opacity-40 pointer-events-none",
                  isCurrent
                    ? "bg-indigo-500/30 text-indigo-200 ring-1 ring-indigo-400/50"
                    : isPast
                      ? "bg-emerald-500/20 text-emerald-200"
                      : "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60"
                )}
              >
                {isPast ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/10 text-[10px]">
                    {index + 1}
                  </span>
                )}
                <span className="hidden sm:inline">{step.label}</span>
              </button>
            </React.Fragment>
          );
        })}
      </div>

      <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
        <CardContent className="p-6">
          <div className="mb-4">
            <h3 className="text-base font-medium text-white">{currentStep.label}</h3>
            <p className="text-xs text-white/45 mt-1">
              Step {currentStepIndex + 1} of {STEPS.length}
            </p>
          </div>
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep.id}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.2 }}
            >
              {renderStepBody()}
            </motion.div>
          </AnimatePresence>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          {currentStepIndex > 0 ? (
            <Button
              type="button"
              variant="outline"
              onClick={goBack}
              className="border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Back
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              className="border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
            >
              Cancel
            </Button>
          )}
        </div>

        <div className="flex gap-2">
          {!isLast ? (
            <Button
              type="button"
              onClick={goNext}
              disabled={!canProceed}
              className="bg-indigo-500/20 text-indigo-100 hover:bg-indigo-500/30 disabled:opacity-50"
            >
              Next
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => void submit()}
              disabled={submitting || !name.trim()}
              className="bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30 disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Check className="mr-1 h-4 w-4" />
                  Create draft
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {!canProceed && validationMessage ? (
        <p className="text-center text-sm text-amber-400/85">{validationMessage}</p>
      ) : null}
    </div>
  );
}
