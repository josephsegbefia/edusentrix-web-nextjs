"use client";

import * as React from "react";
import {
  ArrowLeft,
  Compass,
  EyeOff,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { GlassPanel } from "@/components/ui/glass-panel";
import { WorkspacePageHeader } from "@/components/ui/workspace-page-header";
import { WorkspacePageShell } from "@/components/ui/workspace-page-shell";
import { glassInsetClass } from "@/lib/ui/glass-surfaces";
import { cn } from "@/lib/utils";

type ExploreQaDetail = {
  adventureId: string;
  title: string;
  subjectName: string;
  classGroupName: string;
  sourceLessonTitle: string;
  gradeLevel: string;
  missionType: string;
  generatedAt: string;
  safetyStatus: string;
  adventureStatus: string;
  reviewStatus: string;
  studentsViewedCount: number;
  studentsCompletedCount: number;
  reportsCount: number;
  contentSnapshotId: string;
  generationKey: string;
  aiSummary: string;
  aiMetadata?: {
    provider: string;
    model: string;
    promptVersion: string;
    generationPromptSummary: string;
  };
  sourceContext?: {
    lessonTitle: string;
    gradeLevel: string;
    classGroupId: string;
    subjectId: string;
    curriculum?: string;
  };
  safetyNotes: string[];
  safetyChecks: Array<{ name: string; passed: boolean; severity: string; note?: string }>;
  content: {
    intro: string;
    deepDiveExplanation?: {
      title: string;
      conceptBridge: string;
      deeperExplanation: string;
      realWorldConnection: string;
    };
    misconceptions?: Array<{ misconception: string; leoCorrection: string }>;
    tryItActivity?: { title: string; safetyLevel: string; instructions: string[] };
    parentConversationPrompt?: { title: string; prompt: string };
    readingTasks: Array<{ title: string; passage: string }>;
    funFacts: Array<{ headline: string; fact: string }>;
    endingQuiz: {
      questions: Array<{
        prompt: string;
        options: Array<{ letter: string; label: string; id?: string }>;
        correctOptionId: string;
        explanation: string;
      }>;
    };
  };
  reviewHistory?: Array<{
    id: string;
    action: string;
    notes: string | null;
    reviewerRole: string;
    createdAt: string;
  }>;
  reports: Array<{
    id: string;
    action: string;
    reason: string | null;
    notes: string | null;
    createdAt: string;
  }>;
  studentSummary: {
    viewedCount: number;
    completedCount: number;
    quizSubmittedCount: number;
    averageQuizScorePercent: number | null;
  };
  source?: "lazy" | "legacy";
};

type DetailResponse =
  | { success: true; data: ExploreQaDetail }
  | { success: false; error: string };

export function ExploreContentQaDetailClient({
  adventureId,
  apiBase,
  listHref,
  listLabel,
}: {
  adventureId: string;
  apiBase: "/api/admin/learn/explore-content" | "/api/teacher/learn/explore-content";
  listHref: string;
  listLabel: string;
}) {
  const router = useRouter();
  const [detail, setDetail] = React.useState<ExploreQaDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [actionLoading, setActionLoading] = React.useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = React.useState("");
  const canReview = apiBase.startsWith("/api/admin") || apiBase.startsWith("/api/teacher");

  const loadDetail = React.useCallback(async () => {
    const response = await fetch(`${apiBase}/${encodeURIComponent(adventureId)}`, {
      cache: "no-store",
    });
    const payload = (await response.json()) as DetailResponse;
    if (!response.ok || !payload.success) {
      throw new Error(payload.success ? "Failed to load." : payload.error);
    }
    setDetail(payload.data);
  }, [adventureId, apiBase]);

  React.useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        await loadDetail();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load adventure.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [loadDetail]);

  const runReview = async (action: string) => {
    setActionLoading(action);
    try {
      const response = await fetch(
        `${apiBase}/${encodeURIComponent(adventureId)}/review`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, notes: reviewNotes.trim() || undefined }),
        }
      );
      const payload = (await response.json()) as { success: boolean; error?: string };
      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? "Review action failed.");
      }
      toast.success("Review saved.");
      await loadDetail();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save review.");
    } finally {
      setActionLoading(null);
    }
  };

  const runRegenerate = async () => {
    setActionLoading("regenerate");
    try {
      const response = await fetch(
        `${apiBase}/${encodeURIComponent(adventureId)}/regenerate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "go_deeper" }),
        }
      );
      const payload = (await response.json()) as {
        success: boolean;
        error?: string;
        data?: { state: string; message: string };
      };
      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? "Regeneration failed.");
      }
      if (payload.data?.state === "ready") {
        toast.success(payload.data.message);
        await loadDetail();
      } else {
        toast.message(payload.data?.message ?? "Leo is regenerating this mission.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not regenerate.");
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="p-6 text-white md:p-8">
      <WorkspacePageShell>
        <WorkspacePageHeader
          title="Explore mission review"
          subtitle="Inspect the exact AI snapshot students see and take review actions."
          icon={Compass}
          backHref={listHref}
          backLabel={listLabel}
          actions={
            <button
              type="button"
              onClick={() => router.push(listHref)}
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white/80 hover:bg-white/10"
            >
              <ArrowLeft className="h-4 w-4" />
              All missions
            </button>
          }
        />

        {loading ? (
          <GlassPanel className="p-10 text-center" glow="cyan">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-teal-200" />
          </GlassPanel>
        ) : detail ? (
          <div className="space-y-5">
            <GlassPanel className="p-5" glow="both">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-2">
                  <h2 className="text-xl font-semibold text-white">{detail.title}</h2>
                  <p className="text-sm text-white/60">
                    {detail.subjectName} · {detail.classGroupName} · {detail.gradeLevel} ·{" "}
                    {detail.missionType.replaceAll("_", " ")}
                  </p>
                  <p className="text-xs text-white/45">
                    Source lesson: {detail.sourceLessonTitle} · Generated{" "}
                    {new Date(detail.generatedAt).toLocaleString()}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Badge label={`Safety: ${detail.safetyStatus}`} />
                    <Badge label={`Status: ${detail.adventureStatus}`} />
                    <Badge label={`Review: ${detail.reviewStatus}`} />
                    {detail.reportsCount > 0 ? (
                      <Badge label={`${detail.reportsCount} student reports`} tone="warn" />
                    ) : null}
                  </div>
                </div>

                {canReview && detail.source !== "legacy" ? (
                  <div className="flex max-w-sm flex-col gap-2">
                    <textarea
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                      placeholder="Optional review note for your team..."
                      className="min-h-[72px] rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/35"
                    />
                    <div className="flex flex-wrap gap-2">
                      <ActionBtn
                        label={actionLoading === "mark_reviewed" ? "Saving..." : "Mark reviewed"}
                        onClick={() => void runReview("mark_reviewed")}
                        disabled={!!actionLoading}
                      />
                      <ActionBtn
                        label={actionLoading === "approve" ? "Saving..." : "Approve"}
                        icon={<ShieldCheck className="h-3.5 w-3.5" />}
                        primary
                        onClick={() => void runReview("approve")}
                        disabled={!!actionLoading}
                      />
                      <ActionBtn
                        label="Request changes"
                        onClick={() => void runReview("request_changes")}
                        disabled={!!actionLoading}
                      />
                      <ActionBtn
                        label={actionLoading === "hide" ? "Saving..." : "Hide"}
                        icon={<EyeOff className="h-3.5 w-3.5" />}
                        danger
                        onClick={() => void runReview("hide")}
                        disabled={!!actionLoading}
                      />
                      <ActionBtn
                        label={actionLoading === "regenerate" ? "Regenerating..." : "Regenerate"}
                        icon={<RefreshCw className="h-3.5 w-3.5" />}
                        onClick={() => void runRegenerate()}
                        disabled={!!actionLoading}
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            </GlassPanel>

            <div className="grid gap-4 sm:grid-cols-4">
              <StatCard label="Students viewed" value={detail.studentSummary.viewedCount} />
              <StatCard label="Completed" value={detail.studentSummary.completedCount} />
              <StatCard label="Quiz submitted" value={detail.studentSummary.quizSubmittedCount} />
              <StatCard
                label="Avg quiz score"
                value={
                  detail.studentSummary.averageQuizScorePercent != null
                    ? `${detail.studentSummary.averageQuizScorePercent}%`
                    : "—"
                }
              />
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <Section title="Source lesson context">
                <p>Lesson: {detail.sourceContext?.lessonTitle ?? detail.sourceLessonTitle}</p>
                <p>Grade: {detail.sourceContext?.gradeLevel ?? detail.gradeLevel}</p>
                {detail.sourceContext?.curriculum ? (
                  <p>Curriculum: {detail.sourceContext.curriculum}</p>
                ) : null}
                <p className="text-xs text-white/45">Snapshot: {detail.contentSnapshotId}</p>
              </Section>

              <Section title="AI metadata">
                <p>Provider: {detail.aiMetadata?.provider ?? "—"}</p>
                <p>Model: {detail.aiMetadata?.model ?? "—"}</p>
                <p>Prompt version: {detail.aiMetadata?.promptVersion ?? "—"}</p>
                <p className="text-white/70">{detail.aiSummary}</p>
              </Section>
            </div>

            <Section title="Safety checks">
              {detail.safetyChecks.map((check) => (
                <p key={check.name} className="text-sm text-white/75">
                  {check.passed ? "✓" : "○"} {check.name} ({check.severity})
                  {check.note ? ` — ${check.note}` : ""}
                </p>
              ))}
              {detail.safetyNotes.map((note) => (
                <p key={note} className="text-sm text-teal-100/85">
                  {note}
                </p>
              ))}
            </Section>

            <Section title="Mission intro">{detail.content.intro}</Section>

            {detail.content.deepDiveExplanation ? (
              <Section title="Leo goes deeper">
                <p className="font-medium">{detail.content.deepDiveExplanation.title}</p>
                <p className="mt-2">{detail.content.deepDiveExplanation.deeperExplanation}</p>
                <p className="mt-2 text-teal-100/85">
                  {detail.content.deepDiveExplanation.realWorldConnection}
                </p>
              </Section>
            ) : null}

            {detail.content.misconceptions?.length ? (
              <Section title="Misconceptions addressed">
                {detail.content.misconceptions.map((row) => (
                  <p key={row.misconception} className="mb-2 text-sm">
                    <span className="text-amber-100">{row.misconception}</span>
                    <br />
                    <span className="text-white/75">→ {row.leoCorrection}</span>
                  </p>
                ))}
              </Section>
            ) : null}

            {detail.content.tryItActivity ? (
              <Section title="Try it activity">
                <p>
                  {detail.content.tryItActivity.title} ({detail.content.tryItActivity.safetyLevel})
                </p>
                <ul className="mt-2 list-disc pl-5 text-sm">
                  {detail.content.tryItActivity.instructions.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ul>
              </Section>
            ) : null}

            {detail.content.readingTasks.map((task) => (
              <Section key={task.title} title={task.title}>
                {task.passage}
              </Section>
            ))}

            {detail.content.funFacts.map((fact) => (
              <Section key={fact.headline} title={fact.headline}>
                {fact.fact}
              </Section>
            ))}

            <Section title="Ending quiz (answers visible)">
              {detail.content.endingQuiz.questions.map((q, index) => (
                <div key={q.prompt} className={cn(glassInsetClass, "mb-3 p-3")}>
                  <p className="font-medium">
                    {index + 1}. {q.prompt}
                  </p>
                  <ul className="mt-2 space-y-1 text-xs text-white/70">
                    {q.options.map((opt) => (
                      <li key={opt.letter}>
                        {opt.letter}. {opt.label}
                        {opt.id === q.correctOptionId ? " ✓" : ""}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-teal-100/80">{q.explanation}</p>
                </div>
              ))}
            </Section>

            {detail.reports.length ? (
              <Section title="Student reports">
                {detail.reports.map((report) => (
                  <p key={report.id} className="text-sm text-white/75">
                    {report.reason ?? report.action}
                    {report.notes ? ` — ${report.notes}` : ""} ·{" "}
                    {new Date(report.createdAt).toLocaleString()}
                  </p>
                ))}
              </Section>
            ) : null}

            {detail.reviewHistory?.length ? (
              <Section title="Review history">
                {detail.reviewHistory.map((row) => (
                  <p key={row.id} className="text-sm text-white/70">
                    {row.action} by {row.reviewerRole}
                    {row.notes ? ` — ${row.notes}` : ""} · {new Date(row.createdAt).toLocaleString()}
                  </p>
                ))}
              </Section>
            ) : null}
          </div>
        ) : (
          <GlassPanel className="p-6 text-sm text-white/55">
            Mission not found.{" "}
            <Link href={listHref} className="text-teal-200 underline">
              Back to list
            </Link>
          </GlassPanel>
        )}
      </WorkspacePageShell>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <GlassPanel className="p-4" glow="teal">
      <h3 className="text-sm font-semibold text-teal-100">{title}</h3>
      <div className="mt-2 space-y-2 whitespace-pre-wrap text-sm text-white/75">{children}</div>
    </GlassPanel>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className={cn(glassInsetClass, "p-3")}>
      <p className="text-[10px] uppercase tracking-wide text-white/45">{label}</p>
      <p className="text-lg font-semibold text-white">{value}</p>
    </div>
  );
}

function Badge({
  label,
  tone,
}: {
  label: string;
  tone?: "warn";
}) {
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-1 text-xs",
        tone === "warn" ? "bg-amber-400/20 text-amber-100" : "bg-white/10 text-white/70"
      )}
    >
      {label}
    </span>
  );
}

function ActionBtn({
  label,
  onClick,
  disabled,
  primary,
  danger,
  icon,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
  danger?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium disabled:opacity-50",
        primary && "bg-teal-400 text-slate-950 hover:bg-teal-300",
        danger && "border border-rose-300/30 bg-rose-400/15 text-rose-100",
        !primary && !danger && "border border-white/15 bg-white/5 text-white hover:bg-white/10"
      )}
    >
      {icon}
      {label}
    </button>
  );
}
