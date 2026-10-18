"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Eye, FileCheck2, Loader2, RefreshCw, Save, Send, ShieldCheck, ZoomIn, ZoomOut } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GlassPanel } from "@/components/ui/glass-panel";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { WorkspacePageHeader } from "@/components/ui/workspace-page-header";
import { WorkspacePageShell } from "@/components/ui/workspace-page-shell";
import { glassInsetClass, glassPrimaryButtonClass, glassSecondaryButtonClass } from "@/lib/ui/glass-surfaces";
import { AssessWorkspaceNav } from "@/components/admin/assess/AssessWorkspaceNav";

type QueueItem = {
  assignment: { id: string; deliveryId: string; packetId: string; candidate: { firstName: string; middleName: string | null; lastName: string; admissionNo: string | null } | null; blindMarking: boolean; status: string; assignedAt: string };
  status: string;
  draftVersion: number;
  totalMarks: number | null;
  unmarkedQuestionCount: number | null;
  submittedAt: string | null;
  eligibility: { eligible: boolean; reason: string | null; pageCount: number };
};
type Detail = {
  assignment: QueueItem["assignment"];
  eligibility: { eligible: boolean; reason: string | null; pages: Array<{ id: string; pageId: string; pageNumber: number | null }> };
  questions: Array<{ id: string; sectionTitle: string; order: number; prompt: string; plainTextPrompt: string | null; maximumMarks: number; expectedAnswer: string | null; markingGuide: string | null; subQuestions: Array<{ label: string; prompt: string; marks: number }> }>;
  evaluation: { id: string | null; status: string; draftVersion: number; questionScores: Array<{ questionId: string; score: number | null; feedback: string | null; maximumMarks: number }>; totalMarks: number | null; unmarkedQuestionCount: number; returnReason: string | null };
};
type QueueFilter = "all" | "in_progress" | "submitted" | "returned";

function idempotencyKey(prefix: string) { return prefix + ":" + crypto.randomUUID(); }
function candidateLabel(candidate: QueueItem["assignment"]["candidate"]) {
  return candidate ? [candidate.firstName, candidate.middleName, candidate.lastName].filter(Boolean).join(" ") : "Opaque script reference";
}
function readableStatus(status: string) { return status.replaceAll("_", " "); }

export function DigitalMarkingStudio() {
  const [queue, setQueue] = React.useState<QueueItem[]>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [detail, setDetail] = React.useState<Detail | null>(null);
  const [scores, setScores] = React.useState<Record<string, { score: string; feedback: string }>>({});
  const [loading, setLoading] = React.useState(true);
  const [detailLoading, setDetailLoading] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [savedMessage, setSavedMessage] = React.useState<string | null>(null);
  const [draftDirty, setDraftDirty] = React.useState(false);
  const [submitArmed, setSubmitArmed] = React.useState(false);
  const [questionIndex, setQuestionIndex] = React.useState(0);
  const [pageIndex, setPageIndex] = React.useState(0);
  const [previewScale, setPreviewScale] = React.useState<"fit" | "large">("fit");
  const [previewFailed, setPreviewFailed] = React.useState(false);
  const [queueFilter, setQueueFilter] = React.useState<QueueFilter>("all");

  const loadQueue = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/teacher/assess/marking-assignments", { cache: "no-store" });
      const json = await response.json().catch(() => null) as { success?: boolean; data?: QueueItem[]; error?: string } | null;
      if (!response.ok || !json?.success || !json.data) throw new Error(json?.error ?? "Unable to load marking queue");
      setQueue(json.data);
      setSelectedId((current) => current && json.data!.some((item) => item.assignment.id === current) ? current : json.data![0]?.assignment.id ?? null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load marking queue");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDetail = React.useCallback(async (assignmentId: string) => {
    setDetailLoading(true);
    setError(null);
    setSavedMessage(null);
    setDraftDirty(false);
    setSubmitArmed(false);
    setPageIndex(0);
    setPreviewFailed(false);
    try {
      const response = await fetch("/api/teacher/assess/marking-assignments/" + assignmentId, { cache: "no-store" });
      const json = await response.json().catch(() => null) as { success?: boolean; data?: Detail; error?: string } | null;
      if (!response.ok || !json?.success || !json.data) throw new Error(json?.error ?? "Unable to load the marking assignment");
      setDetail(json.data);
      setQuestionIndex(0);
      setScores(Object.fromEntries(json.data.evaluation.questionScores.map((entry) => [entry.questionId, { score: entry.score == null ? "" : String(entry.score), feedback: entry.feedback ?? "" }])));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load the marking assignment");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  React.useEffect(() => { void loadQueue(); }, [loadQueue]);
  React.useEffect(() => { if (selectedId) void loadDetail(selectedId); else { setDetail(null); setPageIndex(0); } }, [loadDetail, selectedId]);

  function updateScore(questionId: string, field: "score" | "feedback", value: string) {
    setScores((current) => ({ ...current, [questionId]: { score: current[questionId]?.score ?? "", feedback: current[questionId]?.feedback ?? "", [field]: value } }));
    setSavedMessage(null);
    setDraftDirty(true);
  }

  async function saveDraft() {
    if (!detail || !selectedId || !detail.eligibility.eligible) return;
    setBusy("save");
    setError(null);
    setSavedMessage(null);
    try {
      const response = await fetch("/api/teacher/assess/marking-assignments/" + selectedId + "/draft", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ expectedDraftVersion: detail.evaluation.draftVersion, questionScores: detail.questions.map((question) => ({ questionId: question.id, score: scores[question.id]?.score === "" || scores[question.id]?.score == null ? null : Number(scores[question.id]?.score), feedback: scores[question.id]?.feedback ?? "" })) }) });
      const json = await response.json().catch(() => null) as { success?: boolean; data?: { draftVersion: number; totalMarks: number | null; unmarkedQuestionCount: number; status: string }; error?: string } | null;
      if (!response.ok || !json?.success || !json.data) throw new Error(json?.error ?? "Unable to save marking progress");
      setDetail((current) => current ? { ...current, evaluation: { ...current.evaluation, draftVersion: json.data!.draftVersion, totalMarks: json.data!.totalMarks, unmarkedQuestionCount: json.data!.unmarkedQuestionCount, status: json.data!.status } } : current);
      setDraftDirty(false);
      setSavedMessage("Progress saved securely.");
      await loadQueue();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save marking progress");
    } finally {
      setBusy(null);
    }
  }

  async function submit() {
    if (!detail || !selectedId) return;
    if (!submitArmed) {
      setSubmitArmed(true);
      return;
    }
    setBusy("submit");
    setError(null);
    try {
      const response = await fetch("/api/teacher/assess/marking-assignments/" + selectedId + "/submit", { method: "POST", headers: { "x-idempotency-key": idempotencyKey("marking-submit") } });
      const json = await response.json().catch(() => null) as { success?: boolean; error?: string } | null;
      if (!response.ok || !json?.success) throw new Error(json?.error ?? "Unable to submit evaluation");
      setSubmitArmed(false);
      await loadDetail(selectedId);
      await loadQueue();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to submit evaluation");
    } finally {
      setBusy(null);
    }
  }

  const currentQuestion = detail?.questions[questionIndex] ?? null;
  const currentPage = detail?.eligibility.pages[pageIndex] ?? null;
  const evaluationLocked = Boolean(detail && ["submitted", "approved"].includes(detail.evaluation.status));
  const visibleQueue = queueFilter === "all" ? queue : queue.filter((item) => item.status === queueFilter);
  const scoredCount = detail?.questions.filter((question) => scores[question.id]?.score.trim() !== "").length ?? 0;
  const queueFilters: Array<{ id: QueueFilter; label: string; count: number }> = [
    { id: "all", label: "All assigned", count: queue.length },
    { id: "in_progress", label: "In progress", count: queue.filter((item) => item.status === "in_progress").length },
    { id: "submitted", label: "Submitted", count: queue.filter((item) => item.status === "submitted").length },
    { id: "returned", label: "Returned", count: queue.filter((item) => item.status === "returned").length },
  ];
  const previewHref = detail && selectedId && currentPage ? "/api/teacher/assess/marking-assignments/" + selectedId + "/evidence/" + currentPage.id + "/preview" : null;

  return <WorkspacePageShell>
    <WorkspacePageHeader title="My marking" subtitle="Open assigned scripts, mark verified pages and submit your work for independent review." icon={FileCheck2} actions={<Button type="button" variant="outline" className={glassSecondaryButtonClass} onClick={() => void loadQueue()} disabled={loading}><RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" /> Refresh</Button>} />
    <AssessWorkspaceNav audience="teacher" />
    {error ? <div role="alert" aria-live="polite" className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
    <div className="grid gap-5 xl:grid-cols-[minmax(260px,0.72fr)_minmax(0,1.8fr)]">
      <GlassPanel className="p-5">
        <div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="text-lg font-semibold text-(--ws-fg)">Assigned scripts</h2><p className="mt-1 text-sm text-(--ws-fg-60)">Only work assigned to you appears here.</p></div><ShieldCheck className="h-5 w-5 text-(--ws-cyan)" aria-hidden="true" /></div>
        <div className="mb-4 overflow-x-auto" role="group" aria-label="Marking queue status"><div className="flex min-w-max gap-1 rounded-xl border border-(--ws-line) bg-(--ws-fill) p-1">{queueFilters.map((filter) => <button key={filter.id} type="button" aria-pressed={queueFilter === filter.id} onClick={() => setQueueFilter(filter.id)} className={"min-h-9 rounded-lg px-3 py-1.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ws-cyan) " + (queueFilter === filter.id ? "bg-violet-50 text-violet-800 shadow-sm" : "text-(--ws-fg-60) hover:bg-violet-50 hover:text-violet-800")}>{filter.label} <span className="ml-1 text-(--ws-fg-50)">{filter.count}</span></button>)}</div></div>
        {loading ? <div className="flex items-center gap-2 text-sm text-(--ws-fg-60)" role="status"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading queue…</div> : null}
        {!loading && queue.length === 0 ? <div className={glassInsetClass + " p-4 text-sm leading-6 text-(--ws-fg-60)"}><p className="font-medium text-(--ws-fg)">Nothing is assigned to you yet.</p><p className="mt-1">A school administrator will assign a verified script here when it is ready for marking.</p></div> : null}
        {!loading && queue.length > 0 && visibleQueue.length === 0 ? <div className={glassInsetClass + " p-4 text-sm text-(--ws-fg-60)"}>No evaluations match this queue view.</div> : null}
        <div className="space-y-2">{visibleQueue.map((item) => <button type="button" key={item.assignment.id} onClick={() => setSelectedId(item.assignment.id)} aria-pressed={selectedId === item.assignment.id} className={"w-full rounded-xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ws-cyan) " + (selectedId === item.assignment.id ? "border-cyan-400 bg-cyan-50" : "border-(--ws-line) bg-(--ws-fill) hover:border-cyan-200 hover:bg-cyan-50/50")}><div className="flex items-start justify-between gap-2"><div><p className="font-medium text-(--ws-fg)">{item.assignment.blindMarking ? "Opaque script" : candidateLabel(item.assignment.candidate)}</p><p className="mt-1 text-xs text-(--ws-fg-50)">{item.assignment.packetId} · {item.eligibility.pageCount} verified pages</p></div><Badge variant="outline" className={item.status === "approved" ? "border-emerald-200 text-emerald-700" : item.status === "submitted" ? "border-violet-200 text-violet-700" : item.eligibility.eligible ? "border-cyan-200 text-cyan-700" : "border-amber-200 text-amber-700"}>{item.eligibility.eligible ? readableStatus(item.status) : "blocked"}</Badge></div><p className="mt-2 text-xs text-(--ws-fg-60)">{item.totalMarks == null ? "Not yet scored" : item.totalMarks + " marks"} · {item.unmarkedQuestionCount ?? "—"} unmarked</p></button>)}</div>
      </GlassPanel>

      <GlassPanel className="p-5">
        {detailLoading ? <div className="flex items-center gap-2 text-sm text-(--ws-fg-60)" role="status"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading script…</div> : null}
        {!detailLoading && !detail ? <div className={glassInsetClass + " p-6 text-sm leading-6 text-(--ws-fg-60)"}><p className="font-medium text-(--ws-fg)">Choose an assigned script</p><p className="mt-1">Its verified pages and question-by-question marking form will appear here.</p></div> : null}
        {detail ? <>
          <div className="flex flex-col gap-3 border-b border-(--ws-line) pb-4 lg:flex-row lg:items-start lg:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-semibold text-(--ws-fg)">{detail.assignment.blindMarking ? "Opaque examination script" : candidateLabel(detail.assignment.candidate)}</h2><Badge variant="outline" className="border-violet-200 text-violet-700">{readableStatus(detail.evaluation.status)}</Badge></div><p className="mt-1 text-sm text-(--ws-fg-60)">Packet {detail.assignment.packetId} · {detail.eligibility.pages.length} verified pages · draft v{detail.evaluation.draftVersion}</p></div><div className="text-left lg:text-right"><p className="text-xs uppercase tracking-wide text-(--ws-fg-50)">Progress</p><p className="text-lg font-semibold text-(--ws-fg)">{scoredCount}/{detail.questions.length} marked</p><p className="text-sm text-(--ws-fg-60)">Total {detail.evaluation.totalMarks ?? "—"}</p></div></div>
          {!detail.eligibility.eligible ? <div className="mt-4 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /><div><p className="font-medium">Marking is blocked pending reconciliation</p><p className="mt-1">{detail.eligibility.reason}</p></div></div> : null}
          {detail.evaluation.returnReason ? <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50 p-4 text-sm text-violet-800"><p className="font-medium">Returned for correction</p><p className="mt-1">{detail.evaluation.returnReason}</p></div> : null}
          <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.25fr)]">
            <section aria-labelledby="script-preview-heading" className="min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 id="script-preview-heading" className="text-sm font-semibold text-(--ws-fg)">Examination script</h3><p className="mt-1 text-xs text-(--ws-fg-60)">Private evidence · page {currentPage?.pageNumber ?? pageIndex + 1} of {detail.eligibility.pages.length}</p></div><div className="flex items-center gap-1"><Button type="button" size="sm" variant="outline" className={glassSecondaryButtonClass} onClick={() => setPreviewScale("fit")} aria-pressed={previewScale === "fit"}><ZoomOut className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" /> Fit</Button><Button type="button" size="sm" variant="outline" className={glassSecondaryButtonClass} onClick={() => setPreviewScale("large")} aria-pressed={previewScale === "large"}><ZoomIn className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" /> Large</Button></div></div>
              <div className="mt-3 rounded-xl border border-(--ws-line) bg-slate-100 p-2"><div className={"flex min-h-80 items-center justify-center overflow-auto rounded-lg bg-slate-200 " + (previewScale === "large" ? "max-h-[68vh]" : "max-h-[58vh]")}><div className={previewScale === "large" ? "min-w-[720px] p-3" : "w-full max-w-2xl p-3"}>{previewHref && !previewFailed ? <img src={previewHref} alt={"Private examination script " + (currentPage?.pageNumber == null ? "page " + (pageIndex + 1) : "page " + currentPage.pageNumber)} className="mx-auto h-auto w-full rounded-md bg-white object-contain shadow-sm" onError={() => setPreviewFailed(true)} /> : <div className="flex min-h-72 flex-col items-center justify-center gap-2 p-6 text-center text-sm text-(--ws-fg-60)"><Eye className="h-6 w-6 text-(--ws-fg-40)" aria-hidden="true" /><p>{previewFailed ? "The private preview could not be loaded. Use the page controls to retry or refresh the assignment." : "No verified page is available for preview."}</p></div>}</div></div></div>
              <div className="mt-3 flex items-center justify-between gap-2"><Button type="button" size="sm" variant="outline" className={glassSecondaryButtonClass} onClick={() => { setPageIndex((index) => Math.max(0, index - 1)); setPreviewFailed(false); }} disabled={pageIndex === 0}><ChevronLeft className="mr-1 h-4 w-4" aria-hidden="true" /> Previous page</Button><div className="flex max-w-[45%] gap-1 overflow-x-auto" role="list" aria-label="Script pages">{detail.eligibility.pages.map((page, index) => <button key={page.id} type="button" aria-label={"Open page " + (page.pageNumber ?? index + 1)} aria-current={pageIndex === index ? "page" : undefined} onClick={() => { setPageIndex(index); setPreviewFailed(false); }} className={"min-h-9 min-w-9 rounded-lg border px-2 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ws-cyan) " + (pageIndex === index ? "border-cyan-400 bg-cyan-50 text-cyan-800" : "border-(--ws-line) bg-(--ws-fill) text-(--ws-fg-70)")}>{page.pageNumber ?? index + 1}</button>)}</div><Button type="button" size="sm" variant="outline" className={glassSecondaryButtonClass} onClick={() => { setPageIndex((index) => Math.min(detail.eligibility.pages.length - 1, index + 1)); setPreviewFailed(false); }} disabled={pageIndex >= detail.eligibility.pages.length - 1}>Next page <ChevronRight className="ml-1 h-4 w-4" aria-hidden="true" /></Button></div>
            </section>

            <section aria-labelledby="marking-workspace-heading" className="min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 id="marking-workspace-heading" className="text-sm font-semibold text-(--ws-fg)">Marking workspace</h3><p className="mt-1 text-xs text-(--ws-fg-60)">Published questions and criteria remain read-only.</p></div><span className={"text-xs font-medium " + (draftDirty ? "text-(--ws-amber)" : "text-(--ws-emerald)")} aria-live="polite">{draftDirty ? "Unsaved changes" : savedMessage ?? "Draft loaded"}</span></div>
              <div className="mt-3 flex gap-1 overflow-x-auto rounded-xl border border-(--ws-line) bg-(--ws-fill) p-1" role="list" aria-label="Question navigation">{detail.questions.map((question, index) => { const marked = scores[question.id]?.score.trim() !== ""; return <button key={question.id} type="button" aria-label={"Open question " + (index + 1) + (marked ? ", marked" : ", unmarked")} aria-current={questionIndex === index ? "page" : undefined} onClick={() => setQuestionIndex(index)} className={"min-h-9 min-w-9 shrink-0 rounded-lg border px-2 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ws-cyan) " + (questionIndex === index ? "border-violet-400 bg-violet-50 text-violet-800" : marked ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-(--ws-line) bg-white text-(--ws-fg-70)")}>{index + 1}</button>; })}</div>
              <div className="mt-3 rounded-xl border border-(--ws-line) bg-(--ws-fill) p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-medium text-(--ws-fg)">Question {questionIndex + 1} of {detail.questions.length}</p><p className="text-xs text-(--ws-fg-60)">Published maximum: {currentQuestion?.maximumMarks ?? 0} marks</p></div><div className="flex gap-2"><Button type="button" size="sm" variant="outline" aria-label="Previous question" className={glassSecondaryButtonClass} onClick={() => setQuestionIndex((index) => Math.max(0, index - 1))} disabled={questionIndex === 0}><ChevronLeft className="h-4 w-4" aria-hidden="true" /></Button><Button type="button" size="sm" variant="outline" aria-label="Next question" className={glassSecondaryButtonClass} onClick={() => setQuestionIndex((index) => Math.min(detail.questions.length - 1, index + 1))} disabled={questionIndex >= detail.questions.length - 1}><ChevronRight className="h-4 w-4" aria-hidden="true" /></Button></div></div>{currentQuestion ? <div className="mt-4 space-y-4"><div className="rounded-xl bg-white p-4"><p className="text-xs uppercase tracking-wide text-(--ws-fg-50)">{currentQuestion.sectionTitle} · Question {currentQuestion.order + 1}</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-(--ws-fg)">{currentQuestion.plainTextPrompt || currentQuestion.prompt}</p>{currentQuestion.subQuestions.length ? <div className="mt-3 space-y-2 border-l-2 border-cyan-200 pl-3">{currentQuestion.subQuestions.map((sub) => <div key={sub.label} className="text-sm text-(--ws-fg-70)"><span className="font-medium">{sub.label}</span> {sub.prompt} <span className="text-xs text-(--ws-fg-50)">({sub.marks})</span></div>)}</div> : null}</div><div className="grid gap-4 lg:grid-cols-[150px_1fr]"><label className="text-sm font-medium text-(--ws-fg-70)">Awarded marks<Input aria-label={"Score for question " + (questionIndex + 1)} className="mt-2 bg-white" type="number" min={0} max={currentQuestion.maximumMarks} step="0.01" value={scores[currentQuestion.id]?.score ?? ""} onChange={(event) => updateScore(currentQuestion.id, "score", event.target.value)} disabled={evaluationLocked || !detail.eligibility.eligible} /></label><label className="text-sm font-medium text-(--ws-fg-70)">Feedback <Textarea aria-label={"Feedback for question " + (questionIndex + 1)} className="mt-2 min-h-24 bg-white" value={scores[currentQuestion.id]?.feedback ?? ""} onChange={(event) => updateScore(currentQuestion.id, "feedback", event.target.value)} disabled={evaluationLocked || !detail.eligibility.eligible} placeholder="Optional feedback for the reviewer" /></label></div><div className="rounded-xl border border-violet-200 bg-violet-50 p-3 text-sm text-violet-900"><p className="font-medium">Published marking criteria</p><p className="mt-1 whitespace-pre-wrap">{currentQuestion.markingGuide || "No marking guide was captured for this question."}</p>{currentQuestion.expectedAnswer ? <p className="mt-2 whitespace-pre-wrap"><span className="font-medium">Expected answer:</span> {currentQuestion.expectedAnswer}</p> : null}</div></div> : <div className={glassInsetClass + " mt-4 p-4 text-sm text-(--ws-fg-60)"}>This published assessment contains no questions available for marking.</div>}</div>
              <div className="mt-4 flex flex-wrap items-center gap-2"><Button type="button" className={glassPrimaryButtonClass} onClick={() => void saveDraft()} disabled={busy !== null || evaluationLocked || !detail.eligibility.eligible}>{busy === "save" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="mr-2 h-4 w-4" aria-hidden="true" />} Save progress</Button>{!evaluationLocked ? <Button type="button" variant={submitArmed ? "default" : "outline"} className={submitArmed ? "bg-violet-600 text-white hover:bg-violet-500" : glassSecondaryButtonClass} onClick={() => void submit()} disabled={busy !== null || !detail.eligibility.eligible || detail.evaluation.unmarkedQuestionCount > 0}>{busy === "submit" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="mr-2 h-4 w-4" aria-hidden="true" />} {submitArmed ? "Click again to confirm submission" : "Submit evaluation"}</Button> : <span className="inline-flex items-center gap-2 text-sm text-(--ws-emerald)"><CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Evaluation is read-only after submission</span>}{savedMessage ? <span className="text-sm text-(--ws-emerald)" role="status">{savedMessage}</span> : null}</div>
              <p className="mt-3 text-xs text-(--ws-fg-50)">Unmarked questions are not treated as zero. Submitted marking remains separate from Core academic results until an authorized administrator approves and sends it.</p>
            </section>
          </div>
        </> : null}
      </GlassPanel>
    </div>
  </WorkspacePageShell>;
}
