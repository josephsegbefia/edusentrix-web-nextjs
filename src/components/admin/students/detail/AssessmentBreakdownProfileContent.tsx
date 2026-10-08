"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { SubjectResultStatusBadge } from "@/components/admin/students/detail/SubjectResultStatusBadge";
import { glassInsetClass } from "@/lib/ui/glass-surfaces";
import {
  formatComponentSummary,
  formatEvidenceScore,
  groupBreakdownItemsByComponent,
  partitionBreakdownEvidence,
} from "@/lib/academics/profile/assessment-breakdown-view-utils";
import { formatSubjectResultScore } from "@/lib/academics/profile/subject-results-table-utils";
import type {
  AcademicProfileSubjectBreakdownDTO,
  AcademicProfileSubjectResultDTO,
} from "@/types/academics/student-academic-profile";
import { cn } from "@/lib/utils";
import { CONTRIBUTION_MODE_LABELS } from "@/constants/academics/assessment-engine";
import type { ContributionMode } from "@/types/academics/assessment-engine";

type Props = {
  breakdown: AcademicProfileSubjectBreakdownDTO;
  subjectContext?: AcademicProfileSubjectResultDTO | null;
  periodIsReleased?: boolean;
};

function EvidenceItemRow({
  item,
}: {
  item: AcademicProfileSubjectBreakdownDTO["items"][number];
}) {
  const statusLabel = item.isMissing
    ? "Missing"
    : item.isCounted
      ? "Counts"
      : "Does not count";

  return (
    <li className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-(--ws-line) bg-(--ws-fill) px-3 py-2 text-xs">
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="font-medium text-(--ws-fg-90)">{item.title}</p>
        <p className="text-[10px] uppercase tracking-wide text-(--ws-fg-40)">
          {item.assessmentType}
          {item.contributionMode
            ? ` · ${CONTRIBUTION_MODE_LABELS[item.contributionMode as ContributionMode] ?? item.contributionMode}`
            : null}
        </p>
        {item.exclusionReason ? (
          <p className="text-[11px] text-(--ws-amber)/80">{item.exclusionReason}</p>
        ) : null}
      </div>
      <div className="text-right">
        <p className="font-semibold tabular-nums text-(--ws-fg)">{formatEvidenceScore(item)}</p>
        <p
          className={cn(
            "text-[10px] font-medium uppercase tracking-wide",
            item.isCounted
              ? "text-(--ws-emerald)"
              : item.isMissing
                ? "text-(--ws-amber)"
                : "text-(--ws-fg-40)"
          )}
        >
          {statusLabel}
        </p>
      </div>
    </li>
  );
}

function ComponentSection({
  component,
  items,
}: {
  component: AcademicProfileSubjectBreakdownDTO["components"][number];
  items: AcademicProfileSubjectBreakdownDTO["items"];
}) {
  return (
    <div className={cn(glassInsetClass, "space-y-2 p-3")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-(--ws-fg)">
          {component.label}
          {component.weight > 0 ? (
            <span className="ml-1 text-(--ws-fg-50)">— {component.weight}%</span>
          ) : null}
        </h4>
        <span className="text-xs font-medium tabular-nums text-(--ws-cyan)">
          Component total: {formatComponentSummary(component)}
        </span>
      </div>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <EvidenceItemRow key={item.assessmentItemId} item={item} />
        ))}
      </ul>
    </div>
  );
}

function EvidenceListSection({
  title,
  items,
  emptyMessage,
}: {
  title: string;
  items: AcademicProfileSubjectBreakdownDTO["items"];
  emptyMessage?: string;
}) {
  if (items.length === 0 && !emptyMessage) {
    return null;
  }

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-(--ws-fg-90)">{title}</h4>
      {items.length === 0 ? (
        <p className="text-xs text-(--ws-fg-40)">{emptyMessage}</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((item) => (
            <EvidenceItemRow key={item.assessmentItemId} item={item} />
          ))}
        </ul>
      )}
    </div>
  );
}

export function AssessmentBreakdownProfileContent({
  breakdown,
  subjectContext,
  periodIsReleased = false,
}: Props) {
  const componentGroups = React.useMemo(
    () => groupBreakdownItemsByComponent(breakdown.items, breakdown.components),
    [breakdown.items, breakdown.components]
  );

  const partition = React.useMemo(
    () => partitionBreakdownEvidence(breakdown.items),
    [breakdown.items]
  );

  const finalScore =
    subjectContext?.roundedFinalScore ?? subjectContext?.finalScore ?? null;
  const gradeLabel = subjectContext?.gradeLabel ?? null;

  const useComponentGrouping = componentGroups.length > 0;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="border-(--ws-line) bg-linear-to-br from-emerald-500/10 to-transparent">
          <CardContent className="p-3">
            <p className="text-[10px] uppercase tracking-wide text-(--ws-fg-50)">Final score</p>
            <p className="text-lg font-semibold text-(--ws-fg)">
              {formatSubjectResultScore(finalScore)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-(--ws-line) bg-linear-to-br from-cyan-500/10 to-transparent">
          <CardContent className="p-3">
            <p className="text-[10px] uppercase tracking-wide text-(--ws-fg-50)">Grade</p>
            <p className="text-lg font-semibold text-(--ws-fg)">{gradeLabel ?? "—"}</p>
            {subjectContext?.descriptor ? (
              <p className="mt-0.5 text-[11px] text-(--ws-fg-50)">{subjectContext.descriptor}</p>
            ) : null}
          </CardContent>
        </Card>
        <Card className="border-(--ws-line) bg-linear-to-br from-violet-500/10 to-transparent">
          <CardContent className="flex flex-col gap-2 p-3">
            <p className="text-[10px] uppercase tracking-wide text-(--ws-fg-50)">Source</p>
            {subjectContext ? (
              <SubjectResultStatusBadge
                row={subjectContext}
                periodIsReleased={periodIsReleased || breakdown.isOfficial}
              />
            ) : (
              <span className="text-sm text-(--ws-fg-80)">
                {breakdown.isOfficial ? "Official" : "Provisional"}
              </span>
            )}
            {breakdown.dataSource === "legacy" ? (
              <span className="text-[11px] text-(--ws-amber)/80">Legacy gradebook data</span>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {breakdown.components.length > 0 ? (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-(--ws-fg-90)">Component breakdown</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {breakdown.components.map((component) => (
              <div
                key={component.componentKey}
                className={cn(glassInsetClass, "flex items-center justify-between px-3 py-2 text-xs")}
              >
                <span className="text-(--ws-fg-70)">
                  {component.label}
                  {component.weight > 0 ? ` (${component.weight}%)` : ""}
                </span>
                <span className="font-semibold tabular-nums text-(--ws-fg)">
                  {formatComponentSummary(component)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-(--ws-fg-90)">Assessment evidence</h3>

        {useComponentGrouping ? (
          componentGroups.map((group) => (
            <ComponentSection
              key={group.component.componentKey}
              component={group.component}
              items={group.items}
            />
          ))
        ) : (
          <>
            <EvidenceListSection
              title="Counted assessments"
              items={partition.counted}
              emptyMessage="No counted assessments for this subject."
            />
            <EvidenceListSection
              title="Non-counted assessments"
              items={partition.nonCounted}
            />
            <EvidenceListSection
              title="Missing required assessments"
              items={partition.missing}
            />
          </>
        )}
      </div>

      {breakdown.calculationExplanation ? (
        <div className={cn(glassInsetClass, "space-y-1 p-3")}>
          <h3 className="text-sm font-semibold text-(--ws-fg-90)">Calculation</h3>
          <p className="text-xs leading-relaxed text-(--ws-fg-60)">
            {breakdown.calculationExplanation}
          </p>
        </div>
      ) : null}

      {subjectContext?.remark ? (
        <div className={cn(glassInsetClass, "space-y-1 p-3")}>
          <h3 className="text-sm font-semibold text-(--ws-fg-90)">Teacher remark</h3>
          <p className="text-xs leading-relaxed text-(--ws-fg-70)">{subjectContext.remark}</p>
        </div>
      ) : null}
    </div>
  );
}
