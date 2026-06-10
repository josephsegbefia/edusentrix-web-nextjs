"use client";

import * as React from "react";
import { Check, ClipboardCopy, NotebookPen } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { StudentNotebookNotesDto } from "@/types/lesson-content-blocks";

type Props = {
  notes: StudentNotebookNotesDto;
  title?: string;
  subtitle?: string;
};

export function StudentNotebookNotesView({
  notes,
  title = "Notes for your notebook",
  subtitle = "Copy these into your exercise book for revision.",
}: Props) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    const text = notes.contentHtml.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    void navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="border border-teal-500/25 bg-teal-500/5">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base text-white">
            <NotebookPen className="h-4 w-4 text-teal-300" />
            {title}
          </CardTitle>
          <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handleCopy}
          className="border-teal-500/30 bg-teal-500/10 text-teal-100 hover:bg-teal-500/20"
        >
          {copied ? (
            <Check className="mr-2 h-4 w-4 text-emerald-300" />
          ) : (
            <ClipboardCopy className="mr-2 h-4 w-4" />
          )}
          {copied ? "Copied" : "Copy all"}
        </Button>
      </CardHeader>
      <CardContent>
        <div
          className="prose prose-invert max-w-none rounded-xl border border-white/10 bg-slate-950/40 p-5 prose-h3:text-sm prose-h3:font-semibold prose-h3:text-white prose-p:text-sm prose-p:text-slate-200 prose-li:text-sm prose-li:text-slate-200 prose-strong:text-white"
          dangerouslySetInnerHTML={{ __html: notes.contentHtml }}
        />
      </CardContent>
    </Card>
  );
}
