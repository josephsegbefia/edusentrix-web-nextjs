"use client";

import * as React from "react";
import { ListTree } from "lucide-react";
import { Label } from "@/components/ui/label";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import { Checkbox } from "@/components/ui/checkbox";
import { useLessonNoteSchemeSuggestions } from "@/hooks/teacher/useLessonNoteSchemeSuggestions";
import type { LessonNoteFormData } from "@/types/lesson-notes";
import { cn } from "@/lib/utils";

type Props = {
  formData: LessonNoteFormData;
  onUpdate: (updates: Partial<LessonNoteFormData>) => void;
};

export function LessonNoteSchemeLinkPanel({ formData, onUpdate }: Props) {
  const schemeId = formData.schemeId ?? null;
  const itemIds = formData.schemeItemIds ?? [];

  const { data, isLoading, error } = useLessonNoteSchemeSuggestions(
    {
      classGroupId: formData.classGroupId,
      subjectId: formData.subjectId,
      topic: formData.topic,
      selectedSchemeId: schemeId,
    },
    true
  );

  const itemsForScheme = React.useMemo(() => {
    if (!data?.items || !schemeId) return [];
    return data.items.filter((it) => it.schemeId === schemeId);
  }, [data?.items, schemeId]);

  const selectedItems = React.useMemo(
    () => itemsForScheme.filter((item) => itemIds.includes(item.id)),
    [itemIds, itemsForScheme]
  );

  const toggleItem = (id: string, checked: boolean) => {
    const next = new Set(itemIds);
    if (checked) next.add(id);
    else next.delete(id);
    onUpdate({ schemeItemIds: Array.from(next) });
  };

  const applySelectedRows = () => {
    const primary = selectedItems[0];
    if (!primary) return;

    const indicatorText = selectedItems
      .flatMap((item) => (item.indicator || "").split(/\n|,/))
      .map((s) => s.trim())
      .filter(Boolean);

    const resources = selectedItems
      .flatMap((item) => item.teachingResources || [])
      .map((s) => s.trim())
      .filter(Boolean);

    // Merge all learning objectives from selected rows (deduped).
    const incomingObjectives = selectedItems
      .flatMap((item) => item.learningObjectives ?? [])
      .map((s) => s.trim())
      .filter(Boolean);
    const existingOutcomes: string[] = (formData.curriculum?.learningOutcomes ?? []) as string[];
    const mergedOutcomes = Array.from(new Set([...existingOutcomes, ...incomingObjectives]));

    // Merge assessment ideas.
    const incomingAssessment = selectedItems
      .flatMap((item) => item.assessmentIdeas ?? [])
      .map((s) => s.trim())
      .filter(Boolean);
    const existingChecks: string[] = (formData.assessment?.inClassChecks ?? []) as string[];
    const mergedChecks = Array.from(new Set([...existingChecks, ...incomingAssessment]));

    // Teaching & learning activities from the primary row (first selected).
    const tla = primary.teachingLearningActivities?.trim() ?? "";
    const existingContent = (formData.body as Record<string, unknown> | undefined)?.content as string | undefined;
    const mergedContent = tla
      ? tla + (existingContent ? `\n\n${existingContent}` : "")
      : existingContent ?? "";

    onUpdate({
      topic: formData.topic.trim() ? formData.topic : primary.title || formData.topic,
      curriculum: {
        ...formData.curriculum,
        strand: primary.strand || formData.curriculum.strand,
        subStrand: primary.subStrand || formData.curriculum.subStrand,
        contentStandard: primary.contentStandard || formData.curriculum.contentStandard,
        indicators: indicatorText.length
          ? indicatorText.map((text) => ({ refNo: text, text }))
          : formData.curriculum.indicators,
        learningOutcomes: mergedOutcomes.length ? mergedOutcomes : existingOutcomes,
      },
      tlms: Array.from(new Set([...formData.tlms, ...resources])),
      references: Array.from(
        new Set(
          [...formData.references, primary.contentStandard, ...indicatorText].filter(
            Boolean,
          ) as string[],
        ),
      ),
      assessment: {
        ...(formData.assessment as Record<string, unknown> | undefined),
        inClassChecks: mergedChecks,
      },
      body: {
        ...(formData.body as Record<string, unknown> | undefined),
        ...(mergedContent ? { content: mergedContent } : {}),
      },
    });
  };

  if (!data?.enabled) {
    return (
      <div
        className={cn(
          "rounded-xl border border-white/10 bg-white/4 p-4",
          isLoading && "opacity-60"
        )}
      >
        <div className="flex items-center gap-2 text-sm text-white/70">
          <ListTree className="h-4 w-4 text-white/45" />
          <span>Scheme of Learning linking is off for this school.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-white/10 bg-white/4 p-4">
      <div className="flex items-center gap-2">
        <ListTree className="h-4 w-4 text-emerald-300/90" />
        <div>
          <h3 className="text-sm font-semibold text-white">Scheme of Learning (optional)</h3>
          <p className="text-xs text-white/55">
            Align this note with an approved Scheme of Learning and specific weekly rows.
            {data.requireSchemeLinkForLessonNotes ? (
              <span className="mt-1 block text-amber-200/90">
                Your school requires a scheme link before publish or submission.
              </span>
            ) : null}
          </p>
        </div>
      </div>

      {error ? (
        <p className="text-xs text-rose-300">{error.message}</p>
      ) : null}
      {isLoading ? <p className="text-xs text-white/50">Loading Schemes of Learning…</p> : null}

      <div className="space-y-2">
        <Label className="text-white/70">Scheme of Learning</Label>
        <PremiumSelect
          value={schemeId || "__none__"}
          onValueChange={(value) => {
            if (value === "__none__") {
              onUpdate({ schemeId: null, schemeItemIds: [] });
            } else {
              onUpdate({ schemeId: value, schemeItemIds: [] });
            }
          }}
        >
          <PremiumSelectTrigger>
            <PremiumSelectValue placeholder="No scheme linked" />
          </PremiumSelectTrigger>
          <PremiumSelectContent>
            <PremiumSelectItem value="__none__">No Scheme of Learning</PremiumSelectItem>
            {data?.schemes.map((s) => (
              <PremiumSelectItem key={s.id} value={s.id}>
                {s.title}
                <span className="ml-2 text-white/45">({s.status})</span>
              </PremiumSelectItem>
            ))}
          </PremiumSelectContent>
        </PremiumSelect>
      </div>

      {schemeId && itemsForScheme.length > 0 ? (
        <div className="space-y-2">
          <Label className="text-white/70">Scheme rows</Label>
          <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border border-white/10 p-2">
            {itemsForScheme.map((it) => {
              const checked = itemIds.includes(it.id);
              return (
                <label
                  key={it.id}
                  className="flex cursor-pointer items-start gap-2 rounded-md p-1.5 text-sm text-white/80 hover:bg-white/5"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(v) => toggleItem(it.id, v === true)}
                    className="mt-0.5"
                  />
                  <span>
                    {it.weekNumber != null ? `W${it.weekNumber} · ` : ""}
                    {it.title}
                    {it.subStrand ? (
                      <span className="mt-0.5 block text-xs text-white/45">{it.subStrand}</span>
                    ) : null}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      ) : null}

      {selectedItems.length > 0 ? (
        <div className="rounded-lg border border-emerald-300/15 bg-emerald-400/10 p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-emerald-100/70">
                Selected scheme row
              </p>
              <p className="mt-1 text-sm font-medium text-white">{selectedItems[0].title}</p>
              <div className="mt-2 space-y-1 text-xs text-white/60">
                {selectedItems[0].strand ? <p>Strand: {selectedItems[0].strand}</p> : null}
                {selectedItems[0].subStrand ? <p>Sub-strand: {selectedItems[0].subStrand}</p> : null}
                {selectedItems[0].contentStandard ? (
                  <p>Content standard: {selectedItems[0].contentStandard}</p>
                ) : null}
                {selectedItems[0].indicator ? <p>Indicators: {selectedItems[0].indicator}</p> : null}
                {selectedItems[0].learningObjectives?.length ? (
                  <p>Learning objectives: {selectedItems[0].learningObjectives.slice(0, 3).join("; ")}</p>
                ) : null}
                {selectedItems[0].teachingLearningActivities ? (
                  <p className="line-clamp-2">
                    Teaching &amp; learning activities: {selectedItems[0].teachingLearningActivities}
                  </p>
                ) : null}
                {selectedItems[0].teachingResources?.length ? (
                  <p>Resources: {selectedItems[0].teachingResources.join(", ")}</p>
                ) : null}
                {selectedItems[0].assessmentIdeas?.length ? (
                  <p>Assessment: {selectedItems[0].assessmentIdeas.join(", ")}</p>
                ) : null}
              </div>
            </div>
            <button
              type="button"
              onClick={applySelectedRows}
              className="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-400"
            >
              Apply to note
            </button>
          </div>
        </div>
      ) : null}

      {schemeId && !isLoading && itemsForScheme.length === 0 ? (
        <p className="text-xs text-white/50">No rows in this Scheme of Learning yet.</p>
      ) : null}
    </div>
  );
}
