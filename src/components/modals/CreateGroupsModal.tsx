// src/components/modals/SubjectsSetupModal.tsx
"use client";

import * as React from "react";
import { GHANA_BASIC_SUBJECTS } from "@/constants/ghana-basic-subjects";
import { useBulkCreateSubjects } from "@/hooks/admin/useBulkCreateSubjects";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Props = {
  onDone: () => void;
};

export function SubjectsSetupModal({ onDone }: Props) {
  const [selected, setSelected] = React.useState<string[]>(
    [...GHANA_BASIC_SUBJECTS] // pre-checked
  );
  const [custom, setCustom] = React.useState<string>("");
  const createSubjects = useBulkCreateSubjects();

  function toggle(name: string) {
    setSelected((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  }

  function addCustom() {
    const parts = custom
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    if (parts.length === 0) return;
    setSelected((prev) => Array.from(new Set([...prev, ...parts])));
    setCustom("");
  }

  async function handleCreate() {
    if (selected.length === 0) return;
    await createSubjects.mutateAsync(selected);
    onDone();
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <p className="text-sm text-white/80">
          We recommend the Ghana Basic Curriculum subjects. Uncheck any you
          don’t need and add your own before creating.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 max-h-[280px] overflow-auto pr-1">
        {GHANA_BASIC_SUBJECTS.map((name) => (
          <label
            key={name}
            className="flex items-center gap-2 rounded-md p-2 hover:bg-white/5 cursor-pointer border border-white/10 bg-white/5"
          >
            <input
              type="checkbox"
              checked={selected.includes(name)}
              onChange={() => toggle(name)}
              className="h-4 w-4 rounded border-white/20 bg-white/5 accent-brand cursor-pointer"
            />
            <span className="text-sm text-white/80">{name}</span>
          </label>
        ))}
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
          Add Custom Subjects (comma separated)
        </Label>
        <div className="flex items-center gap-2">
          <Input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="e.g., Music, Entrepreneurship"
            className="border border-white/10 bg-white/5 text-white placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand"
          />
          <Button
            type="button"
            onClick={addCustom}
            className="bg-brand text-black hover:opacity-90"
          >
            Add
          </Button>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onDone}
          className="border-white/10 bg-white/5 text-white hover:bg-white/10"
        >
          Skip
        </Button>
        <Button
          type="button"
          onClick={handleCreate}
          disabled={createSubjects.isPending || selected.length === 0}
          className="bg-brand text-black hover:opacity-90"
        >
          {createSubjects.isPending ? "Creating…" : "Create Subjects"}
        </Button>
      </div>
    </div>
  );
}
