"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { StudentNotebookNotesView } from "@/components/lessons/StudentNotebookNotesView";
import type { StudentNotebookNotesDto } from "@/types/lesson-content-blocks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Legacy URL: /parent/wards/[id]/lessons/[lessonId]
 * This page bridges old lesson IDs (which may be legacy Lesson._id or session IDs)
 * to the session-based display. It queries the session detail API directly since
 * all lesson IDs are now session IDs after the v2 migration.
 */

type SummaryBlock = {
  id: string;
  type: string;
  title: string | null;
  bodyHtml: string;
};

type SessionSummaryData = {
  sessionId: string;
  title: string;
  scheduledDate: string;
  summaryBlocks: SummaryBlock[];
  planNotesExcerpt: string | null;
  notebookNotes?: StudentNotebookNotesDto | null;
};

type DetailJson =
  | { success: true; data: SessionSummaryData }
  | { success: false; error: string };

function formatDate(dateStr: string) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function ParentWardLessonDetailPage() {
  const params = useParams();
  const wardId = typeof params.id === "string" ? params.id : null;
  const lessonId = typeof params.lessonId === "string" ? params.lessonId : null;

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["parent-ward-lesson-session-detail", wardId, lessonId],
    queryFn: async () => {
      // Try the v2 session endpoint first (lesson IDs are now session IDs)
      const res = await fetch(
        `/api/parent/wards/${wardId}/lesson-sessions/${lessonId}`,
        { cache: "no-store" }
      );
      const json = (await res.json().catch(() => null)) as DetailJson | null;
      if (!res.ok || !json || !json.success) {
        const msg =
          json && "error" in json && typeof json.error === "string"
            ? json.error
            : "Failed to load lesson";
        throw new Error(msg);
      }
      return json.data;
    },
    enabled: Boolean(wardId && lessonId),
  });

  if (!wardId || !lessonId) {
    return <div className="p-6 text-sm text-white/60">Missing route parameters.</div>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 pb-16 md:p-8">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="text-white/70 hover:text-white" asChild>
          <Link href={`/parent/wards/${wardId}/lessons`}>
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-semibold text-white">Lesson summary</h1>
          <p className="text-sm text-white/50">Written for families</p>
        </div>
      </div>

      {isLoading && <Skeleton className="min-h-[200px] rounded-xl" />}

      {isError && (
        <Card className="border-red-500/30 bg-red-950/20">
          <CardContent className="p-4 text-sm text-red-200">
            {error instanceof Error ? error.message : "Error"}
          </CardContent>
        </Card>
      )}

      {data && (
        <div className="space-y-4">
          <Card className="border border-white/10 bg-white/5">
            <CardHeader>
              <CardTitle className="text-lg text-white">{data.title}</CardTitle>
              {data.scheduledDate && (
                <div className="text-sm text-white/50">{formatDate(data.scheduledDate)}</div>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {data.summaryBlocks.length > 0 ? (
                <div className="space-y-4">
                  {data.summaryBlocks.map((block) => (
                    <div key={block.id} className="space-y-1">
                      {block.title && (
                        <h3 className="text-sm font-semibold text-white/80">{block.title}</h3>
                      )}
                      <div
                        className="prose prose-sm prose-invert max-w-none text-white/75 [&_a]:text-teal-300 [&_ul]:pl-5"
                        dangerouslySetInnerHTML={{ __html: block.bodyHtml }}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-white/55">
                  Your teacher hasn&apos;t published a family-facing summary for this lesson yet.
                </p>
              )}

              {data.planNotesExcerpt && (
                <div className="mt-4 rounded-lg border border-white/10 bg-white/5 p-4">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-white/40">
                    Teacher&apos;s plan notes
                  </p>
                  <p className="text-sm text-white/65">{data.planNotesExcerpt}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {data.notebookNotes ? (
            <StudentNotebookNotesView
              notes={data.notebookNotes}
              title="Notebook notes from class"
              subtitle="What your child was asked to copy into their exercise book after this lesson."
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
