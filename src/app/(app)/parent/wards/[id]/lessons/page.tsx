"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, BookOpen, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useParentWardLessons } from "@/hooks/parent/useParentWardLessons";

export default function ParentWardLessonsPage() {
  const params = useParams();
  const wardId = typeof params.id === "string" ? params.id : null;
  const { data, isLoading, isError, error } = useParentWardLessons(wardId);

  if (!wardId) {
    return (
      <div className="p-6 text-sm text-white/60">
        Missing ward id.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 pb-16 md:p-8">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="text-white/70 hover:text-white" asChild>
          <Link href={`/parent/wards/${wardId}`}>
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-semibold text-white">Class lessons</h1>
          <p className="text-sm text-white/50">Published lessons for your child&apos;s class</p>
        </div>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      )}

      {isError && (
        <Card className="border-red-500/30 bg-red-950/20">
          <CardContent className="p-4 text-sm text-red-200">
            {error instanceof Error ? error.message : "Could not load lessons."}
          </CardContent>
        </Card>
      )}

      {!isLoading && data?.success && !data.data.visible && (
        <Card className="border border-white/10 bg-white/5">
          <CardContent className="p-6 text-sm text-white/70">
            Parent-facing lesson summaries are not enabled for your school. Administrators can turn
            this on under{" "}
            <span className="text-white/90 font-medium">Admin → Settings → Features</span>.
          </CardContent>
        </Card>
      )}

      {!isLoading && data?.success && data.data.visible && data.data.lessons.length === 0 && (
        <Card className="border border-white/10 bg-white/5">
          <CardContent className="flex flex-col items-center gap-2 p-10 text-center text-white/65">
            <BookOpen className="h-10 w-10 text-white/30" />
            <p>No published lessons yet for this class.</p>
          </CardContent>
        </Card>
      )}

      {!isLoading && data?.success && data.data.visible && data.data.lessons.length > 0 && (
        <div className="space-y-3">
          {data.data.lessons.map((row) => (
            <Link key={row.id} href={`/parent/wards/${wardId}/lessons/${row.id}`} className="block">
              <Card className="border border-white/10 bg-white/5 transition-colors hover:border-teal-500/30 hover:bg-white/[0.07]">
                <CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
                  <div className="space-y-1">
                    <CardTitle className="text-base text-white">{row.title}</CardTitle>
                    <div className="flex flex-wrap gap-2 text-xs text-white/50">
                      {row.subjectName ? <span>{row.subjectName}</span> : null}
                      {row.publishedAt ? (
                        <span>
                          Published{" "}
                          {new Date(row.publishedAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {row.hasParentSummary ? (
                      <Badge className="border-teal-400/40 bg-teal-500/15 text-teal-100">
                        Family summary
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-white/15 text-white/45">
                        No family summary yet
                      </Badge>
                    )}
                    <ChevronRight className="h-5 w-5 text-white/35" />
                  </div>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
