"use client";

import * as React from "react";
import { CalendarRange, FileText, GraduationCap, Loader2, Sparkles } from "lucide-react";
import { Modal } from "@/components/ui/responsive-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import { CustomDatePicker } from "@/components/ui/custom-date-picker";
import { LeoIcon } from "@/components/icons/LeoIcon";
import { admissionsAdminFieldClass } from "@/components/admissions/admissions-admin-ui";
import { cn } from "@/lib/utils";
import { useBusyToast } from "@/hooks/useBusyToast";
import { useAcademicPeriods } from "@/hooks/admin/useAcademicPeriods";
import { useGradeOptions } from "@/hooks/admin/useGradeOptions";
import {
  type AdmissionCycleDTO,
  useCreateAdmissionCycle,
} from "@/hooks/admissions/useAdmissionCycles";
import { useAdmissionCycleTemplates } from "@/hooks/admissions/useAdmissionTemplates";

type CreateCycleModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (cycle: AdmissionCycleDTO) => void;
};

const SLUG_REGEX = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;
const NO_PERIOD_VALUE = "__none__";

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function CreateCycleModal({
  open,
  onOpenChange,
  onCreated,
}: CreateCycleModalProps) {
  const busy = useBusyToast();
  const create = useCreateAdmissionCycle();
  const { data: periodsData } = useAcademicPeriods();
  const { data: grades = [] } = useGradeOptions();
  const { data: templatesData } = useAdmissionCycleTemplates();
  const periods = periodsData?.periods ?? [];
  const templates = templatesData?.data ?? [];

  const [name, setName] = React.useState("2026/2027 Intake");
  const [slug, setSlug] = React.useState("2026-2027");
  const [slugTouched, setSlugTouched] = React.useState(false);
  const [acceptsFrom, setAcceptsFrom] = React.useState<Date | null>(new Date());
  const [acceptsUntil, setAcceptsUntil] = React.useState<Date | null>(null);
  const [decisionDueBy, setDecisionDueBy] = React.useState<Date | null>(null);
  const [targetPeriodId, setTargetPeriodId] = React.useState<string>("");
  const [intakeGradeIds, setIntakeGradeIds] = React.useState<string[]>([]);
  const [waitlistEnabled, setWaitlistEnabled] = React.useState(true);
  const [templateId, setTemplateId] = React.useState<
    "blank" | "standard_primary" | "standard_shs"
  >("blank");
  const [errorText, setErrorText] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setName("2026/2027 Intake");
    setSlug("2026-2027");
    setSlugTouched(false);
    setAcceptsFrom(new Date());
    setAcceptsUntil(null);
    setDecisionDueBy(null);
    setTargetPeriodId("");
    setIntakeGradeIds([]);
    setWaitlistEnabled(true);
    setTemplateId("blank");
    setErrorText(null);
  }, [open]);

  React.useEffect(() => {
    if (slugTouched) return;
    setSlug(slugify(name));
  }, [name, slugTouched]);

  const slugIsValid = SLUG_REGEX.test(slug);
  const canSubmit =
    name.trim().length >= 2 &&
    slugIsValid &&
    Boolean(acceptsFrom) &&
    !create.isPending;

  function toggleGrade(id: string) {
    setIntakeGradeIds((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]
    );
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErrorText(null);
    if (!canSubmit || !acceptsFrom) return;
    try {
      const result = await busy.promise(
        create.mutateAsync({
          name: name.trim(),
          slug,
          intakeGradeIds: intakeGradeIds.length ? intakeGradeIds : undefined,
          targetAcademicPeriodId: targetPeriodId || null,
          acceptsApplicationsFrom: acceptsFrom.toISOString(),
          acceptsApplicationsUntil: acceptsUntil
            ? acceptsUntil.toISOString()
            : null,
          decisionDueBy: decisionDueBy ? decisionDueBy.toISOString() : null,
          waitlistEnabled,
          templateId,
        }),
        {
          loading: "Opening admission cycle…",
          success: "Cycle drafted. Customize the form, then publish.",
          error: (e: Error) => e.message,
        }
      );
      onOpenChange(false);
      onCreated?.(result.data);
    } catch (e) {
      setErrorText(e instanceof Error ? e.message : "Failed to create cycle");
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Open a new admission cycle"
      description="Cycles get their own public link and a default form Leo can extend. You can edit everything before publishing."
      className="sm:max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/3 p-3 text-xs text-white/65">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-black/30">
            <LeoIcon className="h-5 w-5" />
          </div>
          <p>
            Pick a template below to seed the form, or start from blank. You
            can rearrange or remove any question after.
          </p>
        </div>

        {templates.length > 0 ? (
          <fieldset className="space-y-2">
            <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-white/55">
              <Sparkles className="h-3 w-3" />
              Start from a template
            </Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {templates.map((tpl) => {
                const selected = tpl.id === templateId;
                return (
                  <button
                    type="button"
                    key={tpl.id}
                    onClick={() => setTemplateId(tpl.id)}
                    className={cn(
                      "flex flex-col items-start gap-1 rounded-2xl border p-3 text-left transition",
                      selected
                        ? "border-cyan-400/50 bg-cyan-500/10 text-cyan-50 ring-1 ring-cyan-400/30"
                        : "border-white/10 bg-white/3 text-white/85 hover:bg-white/5"
                    )}
                  >
                    <div className="flex w-full items-center justify-between gap-2">
                      <span className="text-sm font-semibold">{tpl.label}</span>
                      <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[10px] text-white/60">
                        <FileText className="h-3 w-3" />
                        {tpl.previewCounts.fields} fields ·{" "}
                        {tpl.previewCounts.documents} docs
                      </span>
                    </div>
                    <p className="text-xs leading-snug text-white/60">
                      {tpl.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </fieldset>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="cycle-name">Cycle name</Label>
            <Input
              id="cycle-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. 2026/2027 Intake"
              required
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cycle-slug">Public URL slug</Label>
            <Input
              id="cycle-slug"
              value={slug}
              onChange={(event) => {
                setSlug(slugify(event.target.value));
                setSlugTouched(true);
              }}
              placeholder="e.g. 2026-2027"
              required
              className={admissionsAdminFieldClass}
            />
            <p className="text-xs text-white/45">
              Forms a link like{" "}
              <code className="rounded bg-black/30 px-1 py-0.5 text-[11px] text-white/65">
                /apply/&lt;school&gt;/{slug || "your-slug"}
              </code>
            </p>
            {slug && !slugIsValid ? (
              <p className="text-xs text-rose-300">
                Use 1–40 lowercase letters, numbers and dashes.
              </p>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-white/55">
              <CalendarRange className="h-3 w-3" />
              Accepts from
            </Label>
            <CustomDatePicker
              value={acceptsFrom}
              onChange={setAcceptsFrom}
              placeholder="Pick a start date"
              triggerAriaLabel="Cycle start date"
            />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-white/55">
              <CalendarRange className="h-3 w-3" />
              Closes (optional)
            </Label>
            <CustomDatePicker
              value={acceptsUntil}
              onChange={setAcceptsUntil}
              placeholder="No close date"
              minDate={acceptsFrom ?? undefined}
              triggerAriaLabel="Cycle close date"
            />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-white/55">
              <CalendarRange className="h-3 w-3" />
              Decision deadline
            </Label>
            <CustomDatePicker
              value={decisionDueBy}
              onChange={setDecisionDueBy}
              placeholder="No deadline"
              minDate={acceptsFrom ?? undefined}
              triggerAriaLabel="Decision deadline"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Target academic period (optional)</Label>
            <PremiumSelect
              value={targetPeriodId || NO_PERIOD_VALUE}
              onValueChange={(value) =>
                setTargetPeriodId(value === NO_PERIOD_VALUE ? "" : value)
              }
            >
              <PremiumSelectTrigger className="w-full">
                <PremiumSelectValue placeholder="Pick a period" />
              </PremiumSelectTrigger>
              <PremiumSelectContent>
                <PremiumSelectItem value={NO_PERIOD_VALUE}>
                  Not yet decided
                </PremiumSelectItem>
                {periods.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-white/55">
                    No periods configured yet.
                  </div>
                ) : (
                  periods.map((period) => (
                    <PremiumSelectItem key={period._id} value={period._id}>
                      {period.yearLabel} • {period.term}
                    </PremiumSelectItem>
                  ))
                )}
              </PremiumSelectContent>
            </PremiumSelect>
            <p className="text-xs text-white/45">
              Tell Leo which year accepted students will join.
            </p>
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-[0.18em] text-white/55">
              Capacity controls
            </Label>
            <label className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/3 p-3">
              <Checkbox
                checked={waitlistEnabled}
                onCheckedChange={(value) => setWaitlistEnabled(Boolean(value))}
                className="mt-0.5"
              />
              <div>
                <p className="text-sm font-medium text-white">
                  Enable waitlist
                </p>
                <p className="text-xs text-white/55">
                  Lets you invite waitlisted families when seats open up.
                </p>
              </div>
            </label>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="flex items-center gap-1.5">
            <GraduationCap className="h-3.5 w-3.5 text-white/55" />
            Intake grades (optional)
          </Label>
          <p className="text-xs text-white/45">
            Pick the grades families can apply to. Leave empty to allow all
            active grades.
          </p>
          <div className="flex flex-wrap gap-2">
            {grades.length === 0 ? (
              <span className="text-sm text-white/55">
                No active grades configured yet.
              </span>
            ) : (
              grades.map((grade) => {
                const isOn = intakeGradeIds.includes(grade._id);
                return (
                  <button
                    type="button"
                    key={grade._id}
                    onClick={() => toggleGrade(grade._id)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                      isOn
                        ? "border-cyan-400/40 bg-cyan-500/15 text-cyan-100"
                        : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                    )}
                  >
                    {grade.name}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {errorText ? (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-100">
            {errorText}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-white/10 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={create.isPending}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={!canSubmit}>
            {create.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating
              </>
            ) : (
              "Create cycle"
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
