"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

type DetailJson =
  | {
      success: true;
      data: {
        lesson: {
          id: string;
          title: string;
          subjectName: string | null;
          scheduledAt: string | null;
          publishedAt: string | null;
        };
        parentSummaryHtml: string | null;
      };
    }
  | { success: false; error: string };

export default function ParentWardLessonDetailPage() {
  const params = useParams();
  const wardId = typeof params.id === "string" ? params.id : null;
  const lessonId = typeof params.lessonId === "string" ? params.lessonId : null;

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["parent-ward-lesson-detail", wardId, lessonId],
    queryFn: async () => {
      const res = await fetch(`/api/parent/wards/${wardId}/lessons/${lessonId}`, {
        cache: "no-store",
      });
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
          <p className="text-sm text-white/50">Written for families — not full lesson content</p>
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
        <Card className="border border-white/10 bg-white/5">
          <CardHeader>
            <CardTitle className="text-lg text-white">{data.lesson.title}</CardTitle>
            <div className="text-sm text-white/50">
              {[data.lesson.subjectName, data.lesson.publishedAt ? formatDate(data.lesson.publishedAt) : null]
                .filter(Boolean)
                .join(" · ")}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.parentSummaryHtml ? (
              <div
                className="parent-lesson-summary prose prose-invert max-w-none text-sm text-white/85 [&_a]:text-teal-300 [&_ul]:list-disc [&_ul]:pl-5"
                // Teacher-reviewed HTML from Leo; script tags stripped at save
                dangerouslySetInnerHTML={{ __html: data.parentSummaryHtml }}
              />
            ) : (
              <p className="text-sm text-white/55">
                Your teacher hasn&apos;t added a family-facing summary for this lesson yet.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
