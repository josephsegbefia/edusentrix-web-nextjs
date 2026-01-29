"use client";

import { Input } from "@/components/ui/input";

export type RubricCriterion = {
  title: string;
  description?: string;
  maxScore: number;
  weight?: number;
};

export type RubricScorerProps = {
  criteria: RubricCriterion[];
  scores: Record<string, number>;
  onChange: (scores: Record<string, number>) => void;
};

export function RubricScorer({ criteria, scores, onChange }: RubricScorerProps) {
  const updateScore = (index: number, value: string) => {
    const num = value === "" ? 0 : Number(value);
    const next = { ...scores, [String(index)]: Number.isNaN(num) ? 0 : num };
    onChange(next);
  };

  return (
    <div className="space-y-3">
      {criteria.map((criterion, index) => (
        <div key={`${criterion.title}-${index}`} className="rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-semibold text-white">{criterion.title}</div>
              {criterion.description && (
                <div className="text-xs text-white/50">{criterion.description}</div>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-white/60">
              <span>Max {criterion.maxScore}</span>
              <Input
                type="number"
                min={0}
                max={criterion.maxScore}
                value={scores[String(index)] ?? ""}
                onChange={(event) => updateScore(index, event.target.value)}
                className="h-8 w-20 border-white/10 bg-white/5 text-white/80"
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
