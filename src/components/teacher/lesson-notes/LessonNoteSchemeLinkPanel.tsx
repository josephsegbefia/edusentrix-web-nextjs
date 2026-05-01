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

  const toggleItem = (id: string, checked: boolean) => {
    const next = new Set(itemIds);
    if (checked) next.add(id);
    else next.delete(id);
    onUpdate({ schemeItemIds: Array.from(next) });
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
          <span>Scheme of work linking is off for this school.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-white/10 bg-white/4 p-4">
      <div className="flex items-center gap-2">
        <ListTree className="h-4 w-4 text-emerald-300/90" />
        <div>
          <h3 className="text-sm font-semibold text-white">Scheme of work (optional)</h3>
          <p className="text-xs text-white/55">
            Align this note with an approved scheme and specific weekly items.
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
      {isLoading ? <p className="text-xs text-white/50">Loading schemes…</p> : null}

      <div className="space-y-2">
        <Label className="text-white/70">Scheme</Label>
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
            <PremiumSelectItem value="__none__">No scheme</PremiumSelectItem>
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
          <Label className="text-white/70">Scheme items</Label>
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
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      ) : null}

      {schemeId && !isLoading && itemsForScheme.length === 0 ? (
        <p className="text-xs text-white/50">No items in this scheme yet.</p>
      ) : null}
    </div>
  );
}
