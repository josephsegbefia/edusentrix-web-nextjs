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

type GradeConfig = {
  gradeId: string;
  count: number;
  pattern: "letters" | "numbers" | "custom";
  customNames?: string;
};

type Form = {
  gradeIds: string[];
  gradeConfigs: Record<string, GradeConfig>;
  defaultPattern: "letters" | "numbers" | "custom";
  defaultCount: number;
  subjectIds?: string[];
  capacity?: number;
};

type Props = { onClose: () => void };

export function CreateClassGroupsModal({ onClose }: Props) {
  const { data: grades = [] } = useGradeOptions();
  const { data: subjects = [] } = useSubjectOptions();
  const createGroups = useBulkCreateClassGroups();

  const { control, handleSubmit, setValue, watch } = useForm<Form>({
    defaultValues: {
      gradeIds: [],
      gradeConfigs: {},
      defaultPattern: "letters",
      defaultCount: 2,
      subjectIds: [],
      capacity: undefined,
    },
  });

  const gradeIds = useWatch({ control, name: "gradeIds" });
  const gradeConfigs = useWatch({ control, name: "gradeConfigs" });
  const defaultPattern = useWatch({ control, name: "defaultPattern" });
  const defaultCount = useWatch({ control, name: "defaultCount" });

  // Initialize configs when grades are selected
  React.useEffect(() => {
    if (gradeIds && gradeIds.length > 0) {
      const currentConfigs = gradeConfigs || {};
      const newConfigs: Record<string, GradeConfig> = { ...currentConfigs };

      gradeIds.forEach((gradeId) => {
        if (!newConfigs[gradeId]) {
          newConfigs[gradeId] = {
            gradeId,
            count: defaultCount,
            pattern: defaultPattern,
            customNames: "",
          };
        }
      });

      // Remove configs for deselected grades
      Object.keys(newConfigs).forEach((key) => {
        if (!gradeIds.includes(key)) {
          delete newConfigs[key];
        }
      });

      if (JSON.stringify(newConfigs) !== JSON.stringify(currentConfigs)) {
        setValue("gradeConfigs", newConfigs);
      }
    }
  }, [gradeIds, defaultPattern, defaultCount, gradeConfigs, setValue]);

  function generatePreview(config: GradeConfig, gradeName: string): string {
    if (!config || config.count <= 0) return "—";

    let names: string[] = [];
    if (config.pattern === "letters") {
      const start = "A".charCodeAt(0);
      for (let i = 0; i < config.count; i++) {
        names.push(String.fromCharCode(start + i));
      }
    } else if (config.pattern === "numbers") {
      for (let i = 1; i <= config.count; i++) {
        names.push(String(i));
      }
    } else {
      // Custom
      const custom = (config.customNames || "")
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);
      names = custom.slice(0, config.count);
      // Fill remaining with placeholders if needed
      while (names.length < config.count) {
        names.push(`Custom ${names.length + 1}`);
      }
    }

    return names.map((n) => `${gradeName} ${n}`).join(", ");
  }

  function toPayload(values: Form): {
    gradeConfigs: Array<{ gradeId: string; strategy: Strategy }>;
    subjectIds?: string[];
    capacity?: number | null;
  } {
    const configs = Object.values(values.gradeConfigs || {})
      .filter((config) => config && config.count > 0)
      .map((config) => {
        let strategy: Strategy;

        if (config.pattern === "letters") {
          const start = "A".charCodeAt(0);
          const end = start + config.count - 1;
          strategy = {
            kind: "letters",
            from: String.fromCharCode(start),
            to: String.fromCharCode(end),
          };
        } else if (config.pattern === "numbers") {
          strategy = {
            kind: "numbers",
            from: 1,
            to: config.count,
          };
        } else {
          // Custom
          const names = (config.customNames || "")
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean);
          strategy = {
            kind: "custom",
            names: names.slice(0, config.count),
          };
        }

        return {
          gradeId: config.gradeId,
          strategy,
        };
      });

    return {
      gradeConfigs: configs,
      subjectIds:
        values.subjectIds && values.subjectIds.length > 0
          ? values.subjectIds
          : undefined,
      capacity: values.capacity ? Number(values.capacity) : undefined,
    };
  }

  function applyToAll() {
    const currentConfigs = gradeConfigs || {};
    const newConfigs: Record<string, GradeConfig> = {};

    gradeIds.forEach((gradeId) => {
      newConfigs[gradeId] = {
        gradeId,
        count: defaultCount,
        pattern: defaultPattern,
        customNames: defaultPattern === "custom" ? "" : undefined,
      };
    });

    setValue("gradeConfigs", newConfigs);
  }

  async function onSubmit(values: Form) {
    try {
      const payload = toPayload(values);
      if (payload.gradeConfigs.length === 0) {
        return;
      }
      await createGroups.mutateAsync(payload);
      onClose();
    } catch (error) {
      // Error is handled by mutation's onError callback
      console.error("Failed to create class groups:", error);
    }
  }

  const selectedGrades = grades.filter((g) => gradeIds?.includes(g._id));

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-h-full">
      {/* Grades Selection */}
      <div className="space-y-2">
        <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
          Select Grades *
        </Label>
        <div className="grid grid-cols-2 gap-2 max-h-48 overflow-auto pr-1">
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

      {/* Default Settings & Apply to All */}
      {selectedGrades.length > 0 && (
        <div className="space-y-3 p-4 rounded-lg border border-white/10 bg-white/5">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
              Default Settings
            </Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={applyToAll}
              className="border-white/10 bg-white/5 text-white hover:bg-white/10 text-xs"
            >
              Apply to All
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-white/60">Pattern</Label>
              <Controller
                control={control}
                name="defaultPattern"
                render={({ field }) => (
                  <select
                    {...field}
                    className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand"
                  >
                    <option value="letters">Letters (A, B, C...)</option>
                    <option value="numbers">Numbers (1, 2, 3...)</option>
                    <option value="custom">Custom Names</option>
                  </select>
                )}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-white/60">Number of Classes</Label>
              <Controller
                control={control}
                name="defaultCount"
                render={({ field }) => (
                  <Input
                    type="number"
                    min="1"
                    max="26"
                    {...field}
                    value={field.value ?? 2}
                    onChange={(e) => field.onChange(Number(e.target.value) || 1)}
                    className="border border-white/10 bg-white/5 text-white"
                  />
                )}
              />
            </div>
          </div>
        </div>
      )}

      {/* Per-Grade Configuration Table */}
      {selectedGrades.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
            Configure Classes per Grade
          </Label>
          <div className="rounded-lg border border-white/10 bg-white/5 overflow-hidden">
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
              <table className="w-full">
                <thead className="sticky top-0 bg-white/10 backdrop-blur-sm z-10">
                  <tr className="border-b border-white/10">
                    <th className="text-left p-3 text-xs font-medium text-white/60 uppercase tracking-wider whitespace-nowrap">
                      Grade
                    </th>
                    <th className="text-left p-3 text-xs font-medium text-white/60 uppercase tracking-wider whitespace-nowrap">
                      Count
                    </th>
                    <th className="text-left p-3 text-xs font-medium text-white/60 uppercase tracking-wider whitespace-nowrap">
                      Pattern
                    </th>
                    <th className="text-left p-3 text-xs font-medium text-white/60 uppercase tracking-wider whitespace-nowrap">
                      Preview
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {selectedGrades.map((grade) => {
                    const config = gradeConfigs?.[grade._id] || {
                      gradeId: grade._id,
                      count: defaultCount,
                      pattern: defaultPattern,
                      customNames: "",
                    };
                    const preview = generatePreview(config, grade.name);

                    return (
                      <tr
                        key={grade._id}
                        className="border-b border-white/5 last:border-b-0 hover:bg-white/5 transition-colors"
                      >
                        <td className="p-3 whitespace-nowrap">
                          <span className="text-sm font-medium text-white">
                            {grade.name}
                          </span>
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <Input
                            type="number"
                            min="1"
                            max="26"
                            value={config.count || 1}
                            onChange={(e) => {
                              const newConfigs = { ...gradeConfigs };
                              newConfigs[grade._id] = {
                                ...config,
                                count: Number(e.target.value) || 1,
                              };
                              setValue("gradeConfigs", newConfigs);
                            }}
                            className="w-20 border border-white/10 bg-white/5 text-white text-sm"
                          />
                        </td>
                        <td className="p-3">
                          <div className="space-y-2 min-w-[140px]">
                            <select
                              value={config.pattern || "letters"}
                              onChange={(e) => {
                                const newConfigs = { ...gradeConfigs };
                                newConfigs[grade._id] = {
                                  ...config,
                                  pattern: e.target.value as
                                    | "letters"
                                    | "numbers"
                                    | "custom",
                                  customNames:
                                    e.target.value === "custom" ? "" : undefined,
                                };
                                setValue("gradeConfigs", newConfigs);
                              }}
                              className="w-full rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-white focus:outline-none focus:ring-2 focus:ring-brand"
                            >
                              <option value="letters">Letters</option>
                              <option value="numbers">Numbers</option>
                              <option value="custom">Custom</option>
                            </select>
                            {config.pattern === "custom" && (
                              <Input
                                placeholder="Rose, Sunflower..."
                                value={config.customNames || ""}
                                onChange={(e) => {
                                  const newConfigs = { ...gradeConfigs };
                                  newConfigs[grade._id] = {
                                    ...config,
                                    customNames: e.target.value,
                                  };
                                  setValue("gradeConfigs", newConfigs);
                                }}
                                className="w-full border border-white/10 bg-white/5 text-white text-xs"
                              />
                            )}
                          </div>
                        </td>
                        <td className="p-3">
                          <span className="text-xs text-white/60 line-clamp-2 block max-w-xs">
                            {preview}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Subjects (optional default for groups) */}
      <div className="space-y-2">
        <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
          Default Subjects for these Class Groups (optional)
        </Label>
        <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
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
              value={field.value ?? ""}
              onChange={(e) =>
                field.onChange(e.target.value ? Number(e.target.value) : undefined)
              }
              onBlur={field.onBlur}
              name={field.name}
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
          disabled={
            createGroups.isPending ||
            (gradeIds?.length ?? 0) === 0 ||
            Object.values(gradeConfigs || {}).every(
              (c) => !c || c.count <= 0
            )
          }
          className="bg-brand text-black hover:opacity-90"
        >
          {createGroups.isPending ? "Creating…" : "Create Class Groups"}
        </Button>
      </div>
    </form>
  );
}
