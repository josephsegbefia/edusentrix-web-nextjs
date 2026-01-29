"use client";

import { MessageSquare } from "lucide-react";

const DEFAULT_SNIPPETS = [
  "Great effort, keep it up.",
  "Please show your working next time.",
  "Check your calculations in step 2.",
  "Well structured response.",
  "Try to explain your reasoning in more detail.",
];

export type FeedbackSnippetsProps = {
  onSelect: (snippet: string) => void;
  snippets?: string[];
};

export function FeedbackSnippets({ onSelect, snippets = DEFAULT_SNIPPETS }: FeedbackSnippetsProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-white">
        <MessageSquare className="h-4 w-4 text-white/40" />
        Feedback snippets
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {snippets.map((snippet) => (
          <button
            key={snippet}
            type="button"
            onClick={() => onSelect(snippet)}
            className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs text-white/70 hover:bg-white/20"
          >
            {snippet}
          </button>
        ))}
      </div>
    </div>
  );
}
