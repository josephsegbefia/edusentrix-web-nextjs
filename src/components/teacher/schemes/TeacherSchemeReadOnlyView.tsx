"use client";

import Link from "next/link";
import { ChevronLeft, FileText } from "lucide-react";
import { useTeacherSchemeDetail, useTeacherSchemeItems } from "@/hooks/teacher/useTeacherSchemes";
import { SchemeStatusBadge } from "@/components/schemes/SchemeStatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type TeacherSchemeReadOnlyViewProps = {
  schemeId: string;
};

function formatDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString();
}

export function TeacherSchemeReadOnlyView({ schemeId }: TeacherSchemeReadOnlyViewProps) {
  const { data: scheme, isLoading: schemeLoading, error: schemeError } =
    useTeacherSchemeDetail(schemeId || null);
  const { data: items = [], isLoading: itemsLoading, error: itemsError } =
    useTeacherSchemeItems(schemeId || null);

  const loadError = schemeError?.message || itemsError?.message;

  if (!schemeId) {
    return <p className="text-sm text-white/70">Invalid scheme of learning.</p>;
  }

  return (
    <div className="space-y-5">
      <Button
        asChild
        variant="outline"
        className="border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
      >
        <Link href="/teacher/schemes">
          <ChevronLeft className="mr-1 h-4 w-4" />
          All Schemes of Learning
        </Link>
      </Button>

      {loadError ? <p className="text-sm text-rose-300">{loadError}</p> : null}

      <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent text-white shadow-lg shadow-black/20 backdrop-blur">
        <CardContent className="p-6">
          {schemeLoading ? (
            <p className="text-sm text-white/70">Loading scheme of learning...</p>
          ) : scheme ? (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-white/40">Read-only scheme</p>
                  <h1 className="mt-2 text-2xl font-semibold text-white">{scheme.title}</h1>
                  <p className="mt-2 text-sm text-white/60">
                    {scheme.gradeName || "Grade pending"} · {scheme.subjectName || "Subject pending"}
                    {scheme.academicPeriodLabel ? ` · ${scheme.academicPeriodLabel}` : ""}
                  </p>
                </div>
                <SchemeStatusBadge status={scheme.status} />
              </div>

              {scheme.description ? (
                <p className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm leading-6 text-white/70">
                  {scheme.description}
                </p>
              ) : null}

              <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100/90">
                This scheme is managed by your school admin. You can review the plan here, but uploads,
                edits, imports, approvals, and structural changes are admin-only.
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Weekly Plan</h2>
          <span className="text-xs text-white/45">{items.length} row{items.length === 1 ? "" : "s"}</span>
        </div>

        {itemsLoading ? (
          <p className="text-sm text-white/70">Loading weekly rows...</p>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-5 py-10 text-center">
            <FileText className="mx-auto h-9 w-9 text-white/25" />
            <p className="mt-3 text-sm text-white/60">No rows have been added to this scheme yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => {
              const start = formatDate(item.plannedStartDate);
              const end = formatDate(item.plannedEndDate);
              return (
                <article key={item.id} className="rounded-xl border border-white/10 bg-slate-950/35 p-4 text-white">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-white/55">
                          Week {item.weekNumber ?? "-"}
                        </span>
                        {start || end ? (
                          <span className="text-xs text-white/45">
                            {[start, end].filter(Boolean).join(" - ")}
                          </span>
                        ) : null}
                      </div>
                      <h3 className="mt-2 text-base font-semibold text-white">
                        {item.title || item.topic || "Untitled row"}
                      </h3>
                      {item.subtopic ? <p className="mt-1 text-sm text-white/55">{item.subtopic}</p> : null}
                      {item.learningObjective ? (
                        <p className="mt-2 text-sm leading-6 text-white/70">{item.learningObjective}</p>
                      ) : null}
                      {item.learningObjectives.length > 1 ? (
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-white/65">
                          {item.learningObjectives.map((objective) => (
                            <li key={objective}>{objective}</li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                    <div className="shrink-0 text-left text-xs text-white/45 sm:text-right">
                      {item.strand ? <p>{item.strand}</p> : null}
                      {item.subStrand ? <p>{item.subStrand}</p> : null}
                    </div>
                  </div>
                  {item.contentStandard ? (
                    <p className="mt-2 text-sm text-white/55">
                      <span className="text-white/40">Content standard: </span>
                      {item.contentStandard}
                    </p>
                  ) : null}
                  {item.indicator ? (
                    <p className="mt-2 whitespace-pre-wrap text-sm text-white/55">
                      <span className="text-white/40">Indicators: </span>
                      {item.indicator}
                    </p>
                  ) : null}
                  {item.teachingLearningActivities ||
                  item.teachingResources.length ||
                  item.assessmentIdeas.length ||
                  item.notes ? (
                    <div className="mt-4 grid gap-3 border-t border-white/10 pt-3 text-sm md:grid-cols-2 lg:grid-cols-4">
                      {item.teachingLearningActivities ? (
                        <div className="md:col-span-2">
                          <p className="text-xs uppercase tracking-wide text-white/40">
                            Teaching &amp; learning activities
                          </p>
                          <p className="mt-1 whitespace-pre-wrap text-white/65">
                            {item.teachingLearningActivities}
                          </p>
                        </div>
                      ) : null}
                      {item.teachingResources.length ? (
                        <div>
                          <p className="text-xs uppercase tracking-wide text-white/40">Resources</p>
                          <p className="mt-1 text-white/65">{item.teachingResources.join(", ")}</p>
                        </div>
                      ) : null}
                      {item.assessmentIdeas.length ? (
                        <div>
                          <p className="text-xs uppercase tracking-wide text-white/40">Assessment</p>
                          <p className="mt-1 text-white/65">{item.assessmentIdeas.join(", ")}</p>
                        </div>
                      ) : null}
                      {item.notes ? (
                        <div>
                          <p className="text-xs uppercase tracking-wide text-white/40">Notes</p>
                          <p className="mt-1 text-white/65">{item.notes}</p>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
