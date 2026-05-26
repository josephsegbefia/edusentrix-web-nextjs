"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Legacy lesson detail page — redirects to the v2 session that was
 * created for this lesson during migration (via legacyLessonId bridge).
 * If no session is found, shows a migration notice.
 */
export default function TeacherLegacyLessonPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const lessonId = typeof params?.id === "string" ? params.id : null;

  const { data, isLoading } = useQuery({
    queryKey: ["teacher-lesson-v2-session", lessonId],
    queryFn: async () => {
      const res = await fetch(`/api/teacher/lessons/${lessonId}/v2-session`);
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        data?: { sessionId?: string };
        error?: string;
      } | null;
      return json ?? null;
    },
    enabled: Boolean(lessonId),
    staleTime: 30_000,
  });

  const sessionId = data?.success ? data.data?.sessionId : null;

  React.useEffect(() => {
    if (sessionId) {
      router.replace(`/teacher/lesson-sessions/${sessionId}`);
    }
  }, [sessionId, router]);

  if (isLoading) {
    return (
      <div className="space-y-4 p-6 md:p-8">
        <Skeleton className="h-12 w-64 rounded-xl bg-white/5" />
        <Skeleton className="h-40 rounded-2xl bg-white/5" />
      </div>
    );
  }

  if (sessionId) {
    return (
      <div className="p-6 text-sm text-white/60 md:p-8">
        Redirecting to session…
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 md:p-8">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="text-white/70 hover:text-white" asChild>
          <Link href="/teacher/lessons">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="text-xl font-semibold text-white">Legacy lesson</h1>
      </div>

      <Card className="border border-amber-500/30 bg-amber-500/5">
        <CardContent className="space-y-4 p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10">
              <Archive className="h-6 w-6 text-amber-300" />
            </div>
            <div>
              <p className="font-semibold text-amber-200">This lesson has not been migrated yet</p>
              <p className="text-sm text-amber-200/70">
                A week-plan session has not been created for this lesson.
              </p>
            </div>
          </div>
          <p className="text-sm text-white/60">
            Legacy lessons that were not migrated to the new week-plan system cannot be viewed
            here. Create a new week plan from the approved lesson note to build the equivalent
            session.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild className="bg-teal-500/20 text-teal-100 hover:bg-teal-500/30">
              <Link href="/teacher/lessons">
                <ArrowLeft className="mr-1.5 h-4 w-4" />
                Back to lessons
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="border-white/15 bg-white/5 text-white/80 hover:bg-white/10"
            >
              <Link href="/teacher/lesson-notes">
                Open lesson notes
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
