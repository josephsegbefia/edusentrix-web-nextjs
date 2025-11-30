// src/components/modals/CreateClassGroupsModal.tsx
"use client";

import * as React from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useGradeOptions } from "@/hooks/admin/useGradeOptions";
import { useSubjectOptions } from "@/hooks/admin/useSubjectOptions";
import { useBulkCreateClassGroups } from "@/hooks/admin/useBulkCreateClassGroups";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Strategy =
  | { kind: "letters"; from: string; to: string }
  | { kind: "numbers"; from: number; to: number }
  | { kind: "custom"; names: string[] };

type Form = {
  gradeIds: string[];
  strategyKind: "letters" | "numbers" | "custom";
  fromLetter?: string;
  toLetter?: string;
  fromNumber?: number;
  toNumber?: number;
  customNames?: string; // comma-separated
  subjectIds?: string[];
  capacity?: number;
};

type Props = { onClose: () => void };

export function CreateClassGroupsModal({ onClose }: Props) {
  const { data: grades = [] } = useGradeOptions();
  const { data: subjects = [] } = useSubjectOptions();
  const createGroups = useBulkCreateClassGroups();

  const { control, handleSubmit, setValue } = useForm<Form>({
    defaultValues: {
      gradeIds: [],
      strategyKind: "letters",
      fromLetter: "A",
      toLetter: "D",
      fromNumber: 1,
      toNumber: 3,
      customNames: "",
      subjectIds: [],
      capacity: undefined,
    },
  });

  const gradeIds = useWatch({ control, name: "gradeIds" });
  const strategyKind = useWatch({ control, name: "strategyKind" });

  function toPayload(values: Form) {
    let strategy: Strategy;
    if (values.strategyKind === "letters") {
      strategy = {
        kind: "letters",
        from: values.fromLetter ?? "A",
        to: values.toLetter ?? "A",
      };
    } else if (values.strategyKind === "numbers") {
      strategy = {
        kind: "numbers",
        from: Number(values.fromNumber ?? 1),
        to: Number(values.toNumber ?? 1),
      };
    } else {
      const names = (values.customNames ?? "")
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);
      strategy = { kind: "custom", names };
    }

    return {
      gradeIds: values.gradeIds,
      strategy,
      subjectIds:
        values.subjectIds && values.subjectIds.length
          ? values.subjectIds
          : undefined,
      capacity: values.capacity ? Number(values.capacity) : undefined,
    };
  }

  async function onSubmit(values: Form) {
    await createGroups.mutateAsync(toPayload(values));
    onClose();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Grades */}
      <div className="space-y-2">
        <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
          Grades *
        </Label>
        <div className="grid grid-cols-2 gap-2">
          {grades.map((g) => (
            <label
              key={g._id}
              className="flex items-center gap-2 rounded-md p-2 border border-white/10 bg-white/5 hover:bg-white/10 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={gradeIds?.includes(g._id) ?? false}
                onChange={(e) => {
                  const next = new Set(gradeIds ?? []);
                  if (e.target.checked) next.add(g._id);
                  else next.delete(g._id);
                  setValue("gradeIds", Array.from(next), {
                    shouldValidate: true,
                  });
                }}
                className="h-4 w-4 rounded border-white/20 bg-white/5 accent-brand cursor-pointer"
              />
              <span className="text-sm text-white/80">{g.name}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Strategy */}
      <div className="space-y-3">
        <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
          Naming Strategy
        </Label>

        <Controller
          control={control}
          name="strategyKind"
          render={({ field }) => (
            <div className="flex gap-2">
              {(["letters", "numbers", "custom"] as const).map((k) => (
                <label
                  key={k}
                  className={`flex-1 text-center rounded-lg border px-3 py-2 cursor-pointer transition ${
                    field.value === k
                      ? "border-brand bg-brand/20 text-brand"
                      : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/80"
                  }`}
                >
                  <input
                    type="radio"
                    value={k}
                    checked={field.value === k}
                    onChange={() => field.onChange(k)}
                    className="sr-only"
                  />
                  <span className="capitalize">{k}</span>
                </label>
              ))}
            </div>
          )}
        />

        {strategyKind === "letters" && (
          <div className="grid grid-cols-2 gap-2">
            <Controller
              control={control}
              name="fromLetter"
              render={({ field }) => (
                <Input
                  {...field}
                  placeholder="From (A)"
                  className="border border-white/10 bg-white/5 text-white"
                />
              )}
            />
            <Controller
              control={control}
              name="toLetter"
              render={({ field }) => (
                <Input
                  {...field}
                  placeholder="To (D)"
                  className="border border-white/10 bg-white/5 text-white"
                />
              )}
            />
          </div>
        )}

        {strategyKind === "numbers" && (
          <div className="grid grid-cols-2 gap-2">
            <Controller
              control={control}
              name="fromNumber"
              render={({ field }) => (
                <Input
                  type="number"
                  {...field}
                  value={field.value ?? ""}
                  placeholder="From (1)"
                  className="border border-white/10 bg-white/5 text-white"
                />
              )}
            />
            <Controller
              control={control}
              name="toNumber"
              render={({ field }) => (
                <Input
                  type="number"
                  {...field}
                  value={field.value ?? ""}
                  placeholder="To (3)"
                  className="border border-white/10 bg-white/5 text-white"
                />
              )}
            />
          </div>
        )}

        {strategyKind === "custom" && (
        <Controller
          control={control}
          name="customNames"
          render={({ field }) => (
            <Input
              {...field}
              value={field.value ?? ""}
              placeholder="Comma-separated (e.g., Rose, Sunflower)"
              className="border border-white/10 bg-white/5 text-white"
            />
          )}
        />
        )}
      </div>

      {/* Subjects (optional default for groups) */}
      <div className="space-y-2">
        <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
          Default Subjects for these Class Groups (optional)
        </Label>
        <div className="grid grid-cols-2 gap-2 max-h-40 overflow-auto pr-1">
          {subjects.map((s) => (
            <Controller
              key={s._id}
              control={control}
              name="subjectIds"
              render={({ field }) => {
                const checked = (field.value ?? []).includes(s._id);
                return (
                  <label className="flex items-center gap-2 rounded-md p-2 border border-white/10 bg-white/5 hover:bg-white/10 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        const set = new Set(field.value ?? []);
                        if (e.target.checked) set.add(s._id);
                        else set.delete(s._id);
                        field.onChange(Array.from(set));
                      }}
                      className="h-4 w-4 rounded border-white/20 bg-white/5 accent-brand cursor-pointer"
                    />
                    <span className="text-sm text-white/80">{s.name}</span>
                  </label>
                );
              }}
            />
          ))}
        </div>
      </div>

      {/* Optional capacity */}
      <div className="space-y-2">
        <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
          Capacity (optional)
        </Label>
        <Controller
          control={control}
          name="capacity"
          render={({ field }) => (
            <Input
              type="number"
              {...field}
              value={field.value ?? ""}
              placeholder="e.g., 35"
              className="border border-white/10 bg-white/5 text-white"
            />
          )}
        />
      </div>

      <div className="flex justify-end gap-2 pt-4 border-t border-white/10">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          className="border-white/10 bg-white/5 text-white hover:bg-white/10"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={createGroups.isPending || (gradeIds?.length ?? 0) === 0}
          className="bg-brand text-black hover:opacity-90"
        >
          {createGroups.isPending ? "Creating…" : "Create Class Groups"}
        </Button>
      </div>
    </form>
  );
}
