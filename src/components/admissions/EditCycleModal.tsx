"use client";

import * as React from "react";
import { CalendarRange, GraduationCap, Loader2 } from "lucide-react";
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
import { admissionsAdminFieldClass } from "@/components/admissions/admissions-admin-ui";
import { cn } from "@/lib/utils";
import { useBusyToast } from "@/hooks/useBusyToast";
import { useAcademicPeriods } from "@/hooks/admin/useAcademicPeriods";
import { useGradeOptions } from "@/hooks/admin/useGradeOptions";
import {
  type AdmissionCycleDTO,
  useUpdateAdmissionCycle,
} from "@/hooks/admissions/useAdmissionCycles";

type EditCycleModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Cycle to edit; when null the modal should stay closed. */
  cycle: AdmissionCycleDTO | null;
  onUpdated?: (cycle: AdmissionCycleDTO) => void;
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

function parseDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function EditCycleModal({
  open,
  onOpenChange,
  cycle,
  onUpdated,
}: EditCycleModalProps) {
  const busy = useBusyToast();
  const update = useUpdateAdmissionCycle();
  const { data: periodsData } = useAcademicPeriods();
  const { data: grades = [] } = useGradeOptions();
  const periods = periodsData?.periods ?? [];

  const [name, setName] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [slugTouched, setSlugTouched] = React.useState(false);
  const [acceptsFrom, setAcceptsFrom] = React.useState<Date | null>(null);
  const [acceptsUntil, setAcceptsUntil] = React.useState<Date | null>(null);
  const [decisionDueBy, setDecisionDueBy] = React.useState<Date | null>(null);
  const [targetPeriodId, setTargetPeriodId] = React.useState("");
  const [intakeGradeIds, setIntakeGradeIds] = React.useState<string[]>([]);
  const [waitlistEnabled, setWaitlistEnabled] = React.useState(true);
  const [errorText, setErrorText] = React.useState<string | null>(null);

  const archived = cycle?.status === "archived";

  React.useEffect(() => {
    if (!open || !cycle) return;
    setName(cycle.name);
    setSlug(cycle.slug);
    setSlugTouched(true);
    setAcceptsFrom(parseDate(cycle.acceptsApplicationsFrom) ?? new Date());
    setAcceptsUntil(parseDate(cycle.acceptsApplicationsUntil));
    setDecisionDueBy(parseDate(cycle.decisionDueBy));
    setTargetPeriodId(cycle.targetAcademicPeriodId ?? "");
    setIntakeGradeIds([...cycle.intakeGradeIds]);
    setWaitlistEnabled(cycle.waitlistEnabled);
    setErrorText(null);
  }, [open, cycle]);

  React.useEffect(() => {
    if (slugTouched) return;
    setSlug(slugify(name));
  }, [name, slugTouched]);

  const slugIsValid = SLUG_REGEX.test(slug);
  const canSubmit =
    Boolean(cycle) &&
    !archived &&
    name.trim().length >= 2 &&
    slugIsValid &&
    Boolean(acceptsFrom) &&
    !update.isPending;

  function toggleGrade(id: string) {
    setIntakeGradeIds((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]
    );
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErrorText(null);
    if (!canSubmit || !acceptsFrom || !cycle) return;
    try {
      const result = await busy.promise(
        update.mutateAsync({
          cycleId: cycle.id,
          patch: {
            name: name.trim(),
            slug,
            intakeGradeIds: intakeGradeIds.length ? intakeGradeIds : [],
            targetAcademicPeriodId: targetPeriodId || null,
            acceptsApplicationsFrom: acceptsFrom.toISOString(),
            acceptsApplicationsUntil: acceptsUntil
              ? acceptsUntil.toISOString()
              : null,
            decisionDueBy: decisionDueBy ? decisionDueBy.toISOString() : null,
            waitlistEnabled,
          },
        }),
        {
          loading: "Saving cycle…",
          success: "Cycle updated.",
          error: (e: Error) => e.message,
        }
      );
      onOpenChange(false);
      onUpdated?.(result.data);
    } catch (e) {
      setErrorText(e instanceof Error ? e.message : "Failed to update cycle");
    }
  }

  if (!cycle) return null;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Edit cycle settings"
      description="Name, slug, dates, and intake options. Form builder and status actions stay on the cycle page."
      className="sm:max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {archived ? (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">
            Archived cycles cannot be edited. Create a new cycle to run another
            intake, or ask your platform admin if you need this archive changed.
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="edit-cycle-name">Cycle name</Label>
            <Input
              id="edit-cycle-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. 2026/2027 Intake"
              required
              autoFocus
              disabled={archived}
              className={admissionsAdminFieldClass}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-cycle-slug">Public URL slug</Label>
            <Input
              id="edit-cycle-slug"
              value={slug}
              onChange={(event) => {
                setSlug(slugify(event.target.value));
                setSlugTouched(true);
              }}
              placeholder="e.g. 2026-2027"
              required
              disabled={archived}
              className={admissionsAdminFieldClass}
            />
            <p className="text-xs text-white/45">
              Public URL:{" "}
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
              disabled={archived}
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
              disabled={archived}
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
              disabled={archived}
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
              disabled={archived}
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
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-[0.18em] text-white/55">
              Capacity controls
            </Label>
            <label
              className={cn(
                "flex items-start gap-2 rounded-xl border border-white/10 bg-white/3 p-3",
                archived && "pointer-events-none opacity-50"
              )}
            >
              <Checkbox
                checked={waitlistEnabled}
                onCheckedChange={(value) => setWaitlistEnabled(Boolean(value))}
                className="mt-0.5"
                disabled={archived}
              />
              <div>
                <p className="text-sm font-medium text-white">Enable waitlist</p>
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
                    disabled={archived}
                    onClick={() => toggleGrade(grade._id)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                      isOn
                        ? "border-cyan-400/40 bg-cyan-500/15 text-cyan-100"
                        : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10",
                      archived && "pointer-events-none opacity-50"
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
            disabled={update.isPending}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={!canSubmit}>
            {update.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving
              </>
            ) : (
              "Save changes"
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
