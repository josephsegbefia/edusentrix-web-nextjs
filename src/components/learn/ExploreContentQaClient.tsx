"use client";

import * as React from "react";
import { Compass, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { GlassPanel } from "@/components/ui/glass-panel";
import { WorkspacePageHeader } from "@/components/ui/workspace-page-header";
import { WorkspacePageShell } from "@/components/ui/workspace-page-shell";
import { glassInsetClass } from "@/lib/ui/glass-surfaces";
import { cn } from "@/lib/utils";

type ExploreQaListItem = {
  adventureId: string;
  title: string;
  subjectName: string;
  classGroupName?: string | null;
  studentName?: string;
  sessionTitle?: string;
  sourceLessonTitle?: string;
  generatedAt?: string;
  updatedAt: string;
  safetyStatus?: string;
  adventureStatus?: string;
  reviewStatus?: string;
  reviewedStatus?: string;
  generatedBy?: string;
  studentsViewedCount?: number;
  studentsCompletedCount?: number;
  reportsCount?: number;
  introPreview?: string;
  quizSubmitted?: boolean;
  quizScorePercent?: number | null;
};

type ExploreQaDetail = ExploreQaListItem & {
  content: {
    intro: string;
    deepDiveExplanation?: {
      title: string;
      conceptBridge: string;
      deeperExplanation: string;
      realWorldConnection: string;
    };
    misconceptions?: Array<{
      misconception: string;
      leoCorrection: string;
    }>;
    readingTasks: Array<{ title: string; passage: string }>;
    funFacts: Array<{ headline: string; fact: string }>;
    endingQuiz: {
      questions: Array<{
        prompt: string;
        options: Array<{ id?: string; letter: string; label: string }>;
        correctOptionId: string;
        explanation: string;
      }>;
    };
  };
  safetyNotes?: string[];
  safetyChecks?: Array<{ name: string; passed: boolean; severity: string; note?: string }>;
  aiSummary?: string;
  reports?: Array<{
    id: string;
    action: string;
    reason: string | null;
    notes: string | null;
    createdAt: string;
  }>;
  studentSummary?: {
    viewedCount: number;
    completedCount: number;
    quizSubmittedCount: number;
    averageQuizScorePercent: number | null;
  };
  quizAttempt?: {
    scorePercent: number;
    correctCount: number;
    totalCount: number;
    submittedAt: string;
  } | null;
  source?: "lazy" | "legacy";
};

type ListResponse =
  | {
      success: true;
      data: { adventures: ExploreQaListItem[]; total: number; source?: "lazy" | "legacy" };
    }
  | { success: false; error: string };

type DetailResponse =
  | { success: true; data: ExploreQaDetail }
  | { success: false; error: string };

type ReviewResponse =
  | { success: true; data: { adventureId: string; status: string; reviewStatus: string } }
  | { success: false; error: string };

function formatDate(value?: string) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function statusBadgeClass(status: string) {
  if (status === "passed" || status === "approved" || status === "teacher_approved") {
    return "bg-teal-400/20 text-teal-100";
  }
  if (status === "hidden" || status === "blocked" || status === "rejected") {
    return "bg-rose-400/20 text-rose-100";
  }
  if (status === "teacher_review_required" || status === "reported") {
    return "bg-amber-400/20 text-amber-100";
  }
  return "bg-white/10 text-white/70";
}

export function ExploreContentQaClient({
  apiBase,
  backHref,
  backLabel,
  studentId,
}: {
  apiBase: "/api/admin/learn/explore-content" | "/api/teacher/learn/explore-content";
  backHref: string;
  backLabel: string;
  studentId?: string;
}) {
  const [items, setItems] = React.useState<ExploreQaListItem[]>([]);
  const [dataSource, setDataSource] = React.useState<"lazy" | "legacy">("lazy");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [detail, setDetail] = React.useState<ExploreQaDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [detailLoading, setDetailLoading] = React.useState(false);
  const [actionLoading, setActionLoading] = React.useState<string | null>(null);
  const router = useRouter();
  const canReview = apiBase.startsWith("/api/admin") || apiBase.startsWith("/api/teacher");
  const detailBaseHref = apiBase.startsWith("/api/admin")
    ? "/admin/learn/explore-content"
    : "/teacher/learn/explore-content";

  const reloadList = React.useCallback(async () => {
    const query = new URLSearchParams();
    if (studentId) query.set("studentId", studentId);
    const response = await fetch(`${apiBase}?${query.toString()}`, { cache: "no-store" });
    const payload = (await response.json()) as ListResponse;
    if (!response.ok || !payload.success) {
      throw new Error(payload.success ? "Failed to load." : payload.error);
    }
    setItems(payload.data.adventures);
    setDataSource(payload.data.source ?? "lazy");
    return payload.data.adventures;
  }, [apiBase, studentId]);

  React.useEffect(() => {
    let cancelled = false;
    async function loadList() {
      try {
        const adventures = await reloadList();
        if (!cancelled && adventures[0]) {
          setSelectedId(adventures[0].adventureId);
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load Explore content.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadList();
    return () => {
      cancelled = true;
    };
  }, [reloadList]);

  React.useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }

    let cancelled = false;
    async function loadDetail() {
      setDetailLoading(true);
      try {
        if (!selectedId) return;
        const response = await fetch(`${apiBase}/${encodeURIComponent(selectedId)}`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as DetailResponse;
        if (!response.ok || !payload.success) {
          throw new Error(payload.success ? "Failed to load detail." : payload.error);
        }
        if (!cancelled) setDetail(payload.data);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load adventure detail.");
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    }
    void loadDetail();
    return () => {
      cancelled = true;
    };
  }, [apiBase, selectedId]);

  const runReviewAction = async (
    action: "approve" | "mark_reviewed" | "hide" | "request_changes"
  ) => {
    if (!selectedId || !canReview) return;

    setActionLoading(action);
    try {
      const response = await fetch(
        `${apiBase}/${encodeURIComponent(selectedId)}/review`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        }
      );
      const payload = (await response.json()) as ReviewResponse;
      if (!response.ok || !payload.success) {
        throw new Error(payload.success ? "Review failed." : payload.error);
      }

      toast.success(
        action === "hide"
          ? "Adventure hidden from students."
          : action === "approve"
            ? "Adventure approved."
            : action === "request_changes"
              ? "Marked as needing changes."
              : "Marked as reviewed."
      );

      await reloadList();
      const detailResponse = await fetch(`${apiBase}/${encodeURIComponent(selectedId)}`, {
        cache: "no-store",
      });
      const detailPayload = (await detailResponse.json()) as DetailResponse;
      if (detailResponse.ok && detailPayload.success) {
        setDetail(detailPayload.data);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update review.");
    } finally {
      setActionLoading(null);
    }
  };

  const isLazy = dataSource === "lazy" || Boolean(items[0]?.safetyStatus);

  return (
    <div className="p-6 text-white md:p-8">
      <WorkspacePageShell>
        <WorkspacePageHeader
          title="Explore with Leo — content review"
          subtitle="Review class missions Leo generated: safety checks, student progress, and student reports."
          icon={Compass}
          backHref={backHref}
          backLabel={backLabel}
        />

        {loading ? (
          <GlassPanel className="p-8 text-center" glow="cyan">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-teal-200" />
            <p className="mt-3 text-sm text-white/55">Loading Explore missions...</p>
          </GlassPanel>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
            <GlassPanel className="p-4" glow="teal">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-white">Class missions</h2>
                <span className={cn("rounded-full px-2.5 py-1 text-xs", statusBadgeClass(isLazy ? "ready" : "legacy"))}>
                  {isLazy ? "Lazy AI" : "Legacy"}
                </span>
              </div>
              <div className="mt-3 max-h-[70vh] space-y-2 overflow-y-auto">
                {items.length ? (
                  items.map((item) => (
                    <div
                      key={item.adventureId}
                      className={cn(
                        glassInsetClass,
                        "w-full rounded-xl p-3 transition",
                        selectedId === item.adventureId && "ring-1 ring-teal-300/60"
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedId(item.adventureId)}
                        className="w-full text-left"
                      >
                      <p className="text-sm font-semibold text-white">{item.title}</p>
                      <p className="mt-1 text-xs text-white/55">
                        {item.subjectName}
                        {item.classGroupName ? ` · ${item.classGroupName}` : ""}
                        {item.studentName ? ` · ${item.studentName}` : ""}
                      </p>
                      <p className="mt-1 text-xs text-white/45">
                        Lesson: {item.sourceLessonTitle ?? item.sessionTitle ?? "—"}
                      </p>
                      {isLazy ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <span className={cn("rounded-full px-2 py-0.5 text-[10px]", statusBadgeClass(item.safetyStatus ?? ""))}>
                            Safety: {item.safetyStatus ?? "—"}
                          </span>
                          <span className={cn("rounded-full px-2 py-0.5 text-[10px]", statusBadgeClass(item.reviewStatus ?? ""))}>
                            Review: {item.reviewStatus ?? "—"}
                          </span>
                          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/65">
                            {item.studentsViewedCount ?? 0} viewed · {item.studentsCompletedCount ?? 0} done
                          </span>
                          {(item.reportsCount ?? 0) > 0 ? (
                            <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] text-amber-100">
                              {item.reportsCount} report{item.reportsCount === 1 ? "" : "s"}
                            </span>
                          ) : null}
                        </div>
                      ) : (
                        <p className="mt-1 text-xs text-white/45">
                          {item.generatedBy} · quiz{" "}
                          {item.quizSubmitted ? `${item.quizScorePercent ?? 0}%` : "not submitted"}
                        </p>
                      )}
                      <p className="mt-1 text-[10px] text-white/35">
                        Generated {formatDate(item.generatedAt ?? item.updatedAt)}
                      </p>
                      </button>
                      {isLazy ? (
                        <button
                          type="button"
                          onClick={() =>
                            router.push(`${detailBaseHref}/${encodeURIComponent(item.adventureId)}`)
                          }
                          className="mt-2 text-xs font-medium text-teal-200 underline hover:text-teal-100"
                        >
                          View full review
                        </button>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <p className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/55">
                    No Explore missions saved yet. Generate adventures from the mobile app or class lessons.
                  </p>
                )}
              </div>
            </GlassPanel>

            <GlassPanel className="p-5" glow="both">
              {detailLoading ? (
                <div className="py-10 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-teal-200" />
                </div>
              ) : detail ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold text-white">{detail.title}</h2>
                      <p className="mt-1 text-sm text-white/60">
                        {detail.subjectName}
                        {detail.classGroupName ? ` · ${detail.classGroupName}` : ""}
                        {detail.studentName ? ` · ${detail.studentName}` : ""}
                      </p>
                      <p className="mt-1 text-xs text-white/45">
                        Source lesson: {detail.sourceLessonTitle ?? detail.sessionTitle}
                      </p>
                      <p className="mt-1 text-xs text-white/45">
                        Generated {formatDate(detail.generatedAt ?? detail.updatedAt)}
                      </p>
                    </div>

                    {canReview && isLazy ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            router.push(
                              `${detailBaseHref}/${encodeURIComponent(detail.adventureId)}`
                            )
                          }
                          className="rounded-xl border border-teal-300/40 bg-teal-400/10 px-3 py-2 text-xs font-medium text-teal-100 hover:bg-teal-400/20"
                        >
                          Open full review page
                        </button>
                        <button
                          type="button"
                          disabled={!!actionLoading}
                          onClick={() => void runReviewAction("mark_reviewed")}
                          className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium text-white hover:bg-white/10 disabled:opacity-50"
                        >
                          {actionLoading === "mark_reviewed" ? "Saving..." : "Mark reviewed"}
                        </button>
                        <button
                          type="button"
                          disabled={!!actionLoading}
                          onClick={() => void runReviewAction("approve")}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-teal-400 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-teal-300 disabled:opacity-50"
                        >
                          <ShieldCheck className="h-3.5 w-3.5" />
                          {actionLoading === "approve" ? "Saving..." : "Approve"}
                        </button>
                        <button
                          type="button"
                          disabled={!!actionLoading}
                          onClick={() => void runReviewAction("request_changes")}
                          className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium text-white hover:bg-white/10 disabled:opacity-50"
                        >
                          {actionLoading === "request_changes" ? "Saving..." : "Request changes"}
                        </button>
                        <button
                          type="button"
                          disabled={!!actionLoading}
                          onClick={() => void runReviewAction("hide")}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-rose-300/30 bg-rose-400/15 px-3 py-2 text-xs font-medium text-rose-100 hover:bg-rose-400/25 disabled:opacity-50"
                        >
                          <EyeOff className="h-3.5 w-3.5" />
                          {actionLoading === "hide" ? "Saving..." : "Hide"}
                        </button>
                      </div>
                    ) : null}
                  </div>

                  {isLazy && detail.studentSummary ? (
                    <div className={cn(glassInsetClass, "grid gap-2 p-3 sm:grid-cols-4")}>
                      <Stat label="Viewed" value={detail.studentSummary.viewedCount} />
                      <Stat label="Completed" value={detail.studentSummary.completedCount} />
                      <Stat label="Quiz submitted" value={detail.studentSummary.quizSubmittedCount} />
                      <Stat
                        label="Avg quiz %"
                        value={
                          detail.studentSummary.averageQuizScorePercent != null
                            ? `${detail.studentSummary.averageQuizScorePercent}%`
                            : "—"
                        }
                      />
                    </div>
                  ) : null}

                  {isLazy && detail.safetyChecks?.length ? (
                    <Section title="Safety status">
                      <div className="space-y-2">
                        {detail.safetyChecks.map((check) => (
                          <p key={check.name} className="text-xs text-white/70">
                            {check.passed ? "✓" : "○"} {check.name} ({check.severity})
                            {check.note ? ` — ${check.note}` : ""}
                          </p>
                        ))}
                      </div>
                      {detail.safetyNotes?.map((note) => (
                        <p key={note} className="mt-2 text-xs text-teal-100/80">
                          {note}
                        </p>
                      ))}
                    </Section>
                  ) : null}

                  <Section title="Mission intro">{detail.content.intro}</Section>

                  {detail.content.deepDiveExplanation ? (
                    <Section title="Leo goes deeper">
                      <p className="font-medium text-white">{detail.content.deepDiveExplanation.title}</p>
                      <p className="mt-2">{detail.content.deepDiveExplanation.deeperExplanation}</p>
                      <p className="mt-2 text-teal-100/85">
                        {detail.content.deepDiveExplanation.realWorldConnection}
                      </p>
                    </Section>
                  ) : null}

                  {detail.content.misconceptions?.length ? (
                    <Section title="Common mistakes addressed">
                      <div className="space-y-2">
                        {detail.content.misconceptions.map((row) => (
                          <p key={row.misconception} className="text-sm">
                            <span className="text-amber-100">{row.misconception}</span>
                            <br />
                            <span className="text-white/75">→ {row.leoCorrection}</span>
                          </p>
                        ))}
                      </div>
                    </Section>
                  ) : null}

                  {detail.content.readingTasks.map((task) => (
                    <Section key={task.title} title={task.title}>
                      {task.passage}
                    </Section>
                  ))}

                  {detail.content.funFacts.map((fact) => (
                    <Section key={fact.headline + fact.fact.slice(0, 12)} title={fact.headline}>
                      {fact.fact}
                    </Section>
                  ))}

                  <Section title="Ending quiz (correct answers visible)">
                    <div className="space-y-3">
                      {detail.content.endingQuiz.questions.map((question, index) => (
                        <div key={question.prompt} className={cn(glassInsetClass, "p-3")}>
                          <p className="text-sm font-medium text-white">
                            {index + 1}. {question.prompt}
                          </p>
                          <ul className="mt-2 space-y-1 text-xs text-white/70">
                            {question.options.map((option) => (
                              <li key={option.letter}>
                                {option.letter}. {option.label}
                                {option.id === question.correctOptionId ? " ✓" : ""}
                              </li>
                            ))}
                          </ul>
                          <p className="mt-2 text-xs text-teal-100/80">{question.explanation}</p>
                        </div>
                      ))}
                    </div>
                  </Section>

                  {detail.reports?.length ? (
                    <Section title="Student reports">
                      <div className="space-y-2">
                        {detail.reports.map((report) => (
                          <p key={report.id} className="text-xs text-white/70">
                            {report.action}
                            {report.reason ? ` — ${report.reason}` : ""}
                            {report.notes ? ` (${report.notes})` : ""} ·{" "}
                            {formatDate(report.createdAt)}
                          </p>
                        ))}
                      </div>
                    </Section>
                  ) : null}

                  {detail.quizAttempt ? (
                    <p className="text-sm text-teal-100">
                      Legacy student score: {detail.quizAttempt.scorePercent}% (
                      {detail.quizAttempt.correctCount}/{detail.quizAttempt.totalCount})
                    </p>
                  ) : null}

                  {isLazy && detail.aiSummary ? (
                    <p className="text-xs text-white/40">AI summary: {detail.aiSummary}</p>
                  ) : null}
                </div>
              ) : (
                <p className="text-sm text-white/55">Select a mission to view the full content snapshot.</p>
              )}
            </GlassPanel>
          </div>
        )}

        {studentId ? (
          <p className="text-xs text-white/45">
            Filtered to one student.{" "}
            <Link href={backHref} className="text-teal-200 underline">
              Back
            </Link>
          </p>
        ) : null}
      </WorkspacePageShell>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-white/45">{label}</p>
      <p className="text-lg font-semibold text-white">{value}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className={cn(glassInsetClass, "p-3")}>
      <h3 className="text-sm font-semibold text-teal-100">{title}</h3>
      <p className="mt-2 whitespace-pre-wrap text-sm text-white/75">{children}</p>
    </div>
  );
}
