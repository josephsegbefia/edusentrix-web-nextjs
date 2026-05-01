"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { BookOpen, ExternalLink, FolderOpen } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useStudentLessonResources } from "@/hooks/student/useStudentLessonResources";
import type { StudentLessonResourceRow } from "@/types/lesson-resources";

type Props = {
  lessonId: string;
};

export function StudentLessonResourcesList({ lessonId }: Props) {
  const { data, isLoading, error } = useStudentLessonResources(lessonId, true);
  const items = data?.data.items || [];

  if (isLoading) {
    return (
      <Card className="border border-slate-700/80 bg-slate-900/40">
        <CardContent className="py-10 text-center text-sm text-slate-500">
          Loading resources…
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border border-rose-500/30 bg-rose-500/10">
        <CardContent className="py-4 text-sm text-rose-100">{error.message}</CardContent>
      </Card>
    );
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <Card className="border border-slate-700/80 bg-slate-900/40">
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/15 text-sky-300">
            <FolderOpen className="h-4 w-4" />
          </div>
          <div>
            <CardTitle className="text-lg text-white">Resources</CardTitle>
            <p className="text-xs text-slate-500">Materials for this lesson</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((row) => (
          <ResourceRow key={row.id} row={row} />
        ))}
      </CardContent>
    </Card>
  );
}

function ResourceRow({ row }: { row: StudentLessonResourceRow }) {
  if (row.kind === "link") {
    return (
      <div className="rounded-2xl border border-slate-600/50 bg-slate-800/40 p-4">
        <div className="flex items-start gap-3">
          <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" />
          <div className="min-w-0 flex-1 space-y-1">
            <p className="font-medium text-slate-100">{row.title}</p>
            {row.description && (
              <p className="text-sm text-slate-400">{row.description}</p>
            )}
            <Button
              asChild
              size="sm"
              variant="outline"
              className="mt-2 border-slate-600 text-slate-200"
            >
              <a href={row.url} target="_blank" rel="noopener noreferrer">
                Open link
                <ExternalLink className="ml-2 h-3.5 w-3.5" />
              </a>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const hasBook = row.book != null;

  return (
    <div className="rounded-2xl border border-slate-600/50 bg-slate-800/40 p-4">
      <div className="flex gap-3">
        {hasBook && row.book?.coverImageUrl ? (
          <div className="relative h-20 w-14 shrink-0 overflow-hidden rounded-lg border border-slate-600/60 bg-slate-900">
            <Image
              src={row.book.coverImageUrl}
              alt={row.book.title || row.title}
              fill
              className="object-cover"
              sizes="56px"
            />
          </div>
        ) : (
          <div className="flex h-20 w-14 shrink-0 items-center justify-center rounded-lg border border-slate-600/60 bg-slate-900/80">
            <BookOpen className="h-6 w-6 text-slate-500" />
          </div>
        )}
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-medium text-slate-100">{row.title}</p>
          {hasBook && row.book?.author && (
            <p className="text-sm text-slate-400">{row.book.author}</p>
          )}
          {row.description && (
            <p className="text-sm text-slate-400">{row.description}</p>
          )}
          {!hasBook && (
            <p className="text-xs text-amber-200/80">
              This title is no longer in the active catalogue.
            </p>
          )}
          {hasBook && (
            <Button
              asChild
              size="sm"
              variant="outline"
              className="mt-2 border-slate-600 text-slate-200"
            >
              <Link href={row.libraryPath}>View in library</Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
