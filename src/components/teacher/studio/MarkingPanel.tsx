"use client";

import * as React from "react";
import { Save, Send, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FeedbackSnippets } from "./FeedbackSnippets";
import { RubricScorer, type RubricCriterion } from "./RubricScorer";

export type MarkingPanelProps = {
  maxScore: number;
  score: number | null;
  feedback: string;
  rubric?: { title: string; criteria: RubricCriterion[] } | null;
  rubricScores: Record<string, number>;
  onScoreChange: (value: number | null) => void;
  onFeedbackChange: (value: string) => void;
  onRubricScoresChange: (scores: Record<string, number>) => void;
  onSave: (publish?: boolean) => void;
  onReturn: (reason: string) => void;
};

export function MarkingPanel({
  maxScore,
  score,
  feedback,
  rubric,
  rubricScores,
  onScoreChange,
  onFeedbackChange,
  onRubricScoresChange,
  onSave,
  onReturn,
}: MarkingPanelProps) {
  const [returnReason, setReturnReason] = React.useState("");

  return (
    <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="space-y-2">
        <label className="text-xs uppercase tracking-[0.2em] text-white/40">Score</label>
        <Input
          type="number"
          min={0}
          max={maxScore}
          value={score ?? ""}
          onChange={(event) => {
            const value = event.target.value;
            onScoreChange(value === "" ? null : Number(value));
          }}
          className="border-white/10 bg-white/5 text-white/80"
        />
        <p className="text-xs text-white/50">Max score: {maxScore}</p>
      </div>

      {rubric && rubric.criteria.length > 0 && (
        <div className="space-y-2">
          <label className="text-xs uppercase tracking-[0.2em] text-white/40">
            Rubric - {rubric.title}
          </label>
          <RubricScorer
            criteria={rubric.criteria}
            scores={rubricScores}
            onChange={onRubricScoresChange}
          />
        </div>
      )}

      <div className="space-y-2">
        <label className="text-xs uppercase tracking-[0.2em] text-white/40">Feedback</label>
        <Textarea
          value={feedback}
          onChange={(event) => onFeedbackChange(event.target.value)}
          placeholder="Write feedback for the student"
          className="min-h-[120px] border-white/10 bg-white/5 text-white/80"
        />
      </div>

      <FeedbackSnippets onSelect={(snippet) => onFeedbackChange(`${feedback}${feedback ? " " : ""}${snippet}`)} />

      <div className="space-y-3">
        <label className="text-xs uppercase tracking-[0.2em] text-white/40">Return for redo</label>
        <Textarea
          value={returnReason}
          onChange={(event) => setReturnReason(event.target.value)}
          placeholder="Explain what needs to be fixed"
          className="min-h-[90px] border-white/10 bg-white/5 text-white/80"
        />
        <Button
          type="button"
          variant="ghost"
          onClick={() => onReturn(returnReason)}
          className="w-full text-rose-200 hover:bg-rose-500/10"
        >
          <Undo2 className="h-4 w-4" />
          Return to student
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="ghost"
          onClick={() => onSave(false)}
          className="w-full text-white/70 hover:bg-white/10 sm:w-auto"
        >
          <Save className="h-4 w-4" />
          Save draft
        </Button>
        <Button
          type="button"
          onClick={() => onSave(true)}
          className="w-full bg-indigo-500/20 text-indigo-100 hover:bg-indigo-500/30 sm:w-auto"
        >
          <Send className="h-4 w-4" />
          Publish grade
        </Button>
      </div>
    </div>
  );
}
