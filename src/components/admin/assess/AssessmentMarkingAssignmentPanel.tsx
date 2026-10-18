"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, Eye, Loader2, RefreshCw, ShieldCheck, UploadCloud, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GlassPanel } from "@/components/ui/glass-panel";
import { PremiumSelect, PremiumSelectContent, PremiumSelectItem, PremiumSelectTrigger, PremiumSelectValue } from "@/components/ui/premium-select";
import { Textarea } from "@/components/ui/textarea";
import { glassInsetClass, glassPrimaryButtonClass, glassSecondaryButtonClass } from "@/lib/ui/glass-surfaces";

type Script = { packetAssignmentId: string; packetId: string; pageCount: number; studentId: string; candidate: { firstName: string; middleName: string | null; lastName: string; admissionNo: string | null } | null };
type Marker = { teacherId: string; userId: string; name: string };
type Reviewer = { userId: string; name: string };
type Assignment = { id: string; packetAssignmentId: string; packetId: string; candidate: Script["candidate"]; markerUserId: string; markerName: string | null; status: string; blindMarking: boolean; assignedAt: string };
type ReviewerAssignment = { id: string; reviewerUserId: string; reviewerName: string | null; status: string };
type Review = { evaluationId: string; assignmentId: string; status: string; totalMarks: number | null; maximumMarks: number; submittedAt: string | null; candidate: Script["candidate"]; blindMarking: boolean; reviewer: ReviewerAssignment | null };
type HandoffReceipt = { id: string; status: string; coreAssessmentScoreId: string | null; appliedScore: number | null; appliedMaximumMarks: number; scalingMethod: string; outcomeIntegrityReference: string; completedAt: string | null };
type ApprovedResult = { evaluationId: string; outcomeId: string; assignmentId: string; totalMarks: number; maximumMarks: number; approvedAt: string; candidate: Script["candidate"]; blindMarking: boolean; handoff: { status: string; receiptId: string; coreAssessmentScoreId: string | null } | null };
type QueueData = { eligibleScripts: Script[]; markers: Marker[]; reviewers: Reviewer[]; assignments: Assignment[]; reviewQueue: Review[]; approvedResults: ApprovedResult[] };
type ReviewDetail = { assignment: Assignment; questions: Array<{ id: string; sectionTitle: string; order: number; prompt: string; maximumMarks: number; markingGuide: string | null }>; evaluation: { status: string; questionScores: Array<{ questionId: string; score: number | null; feedback: string | null }>; totalMarks: number | null; unmarkedQuestionCount: number; returnReason: string | null }; eligibility: { pages: Array<{ id: string; pageNumber: number | null }> }; moderation?: { reviewerAssignments: ReviewerAssignment[]; approvedOutcome: { id: string; integrityReference: string; totalMarks: number; maximumAvailableMarks: number } | null; handoffReceipt: HandoffReceipt | null } };

function key(prefix: string) { return `${prefix}:${crypto.randomUUID()}`; }
function label(candidate: Script["candidate"]) { return candidate ? `${candidate.firstName} ${candidate.middleName ? `${candidate.middleName} ` : ""}${candidate.lastName}` : "Candidate unavailable"; }

export function AssessmentMarkingAssignmentPanel({ deliveryId, focus = "marking" }: { deliveryId: string; focus?: "marking" | "approved-results" }) {
  const [data, setData] = React.useState<QueueData | null>(null);
  const [selectedMarker, setSelectedMarker] = React.useState("");
  const [selectedScript, setSelectedScript] = React.useState("");
  const [blindMarking, setBlindMarking] = React.useState(false);
  const [selectedReview, setSelectedReview] = React.useState<string | null>(null);
  const [selectedReviewer, setSelectedReviewer] = React.useState("");
  const [reviewDetail, setReviewDetail] = React.useState<ReviewDetail | null>(null);
  const [reviewReason, setReviewReason] = React.useState("");
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [handoffArmed, setHandoffArmed] = React.useState(false);
  const approvedOnly = focus === "approved-results";

  const load = React.useCallback(async () => {
    if (!deliveryId) { setData(null); return; }
    setError(null);
    try {
      const response = await fetch(`/api/admin/assess/marking-assignments?assessmentDeliveryVersionId=${encodeURIComponent(deliveryId)}`, { cache: "no-store" });
      const json = await response.json().catch(() => null) as { success?: boolean; data?: QueueData; error?: string } | null;
      if (!response.ok || !json?.success || !json.data) throw new Error(json?.error ?? "Unable to load marking work");
      setData(json.data);
      setSelectedScript((current) => current && json.data!.eligibleScripts.some((script) => script.packetAssignmentId === current) ? current : json.data!.eligibleScripts[0]?.packetAssignmentId ?? "");
      setSelectedMarker((current) => current && json.data!.markers.some((marker) => marker.userId === current) ? current : json.data!.markers[0]?.userId ?? "");
      setSelectedReviewer((current) => current && json.data!.reviewers.some((reviewer) => reviewer.userId === current) ? current : json.data!.reviewers[0]?.userId ?? "");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load marking work"); }
  }, [deliveryId]);

  React.useEffect(() => { void load(); setReviewDetail(null); setSelectedReview(null); }, [load]);

  async function assign() {
    if (!selectedScript || !selectedMarker) return;
    setBusy("assign"); setError(null);
    try {
      const response = await fetch("/api/admin/assess/marking-assignments", { method: "POST", headers: { "content-type": "application/json", "x-idempotency-key": key("marking-assignment") }, body: JSON.stringify({ packetAssignmentId: selectedScript, markerUserId: selectedMarker, blindMarking }) });
      const json = await response.json().catch(() => null) as { success?: boolean; error?: string } | null;
      if (!response.ok || !json?.success) throw new Error(json?.error ?? "Unable to assign script");
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to assign script"); }
    finally { setBusy(null); }
  }

  async function openReview(evaluationId: string) {
    setSelectedReview(evaluationId); setHandoffArmed(false); setBusy(`open:${evaluationId}`); setError(null);
    try {
      const response = await fetch(`/api/admin/assess/marking-evaluations/${evaluationId}`, { cache: "no-store" });
      const json = await response.json().catch(() => null) as { success?: boolean; data?: ReviewDetail; error?: string } | null;
      if (!response.ok || !json?.success || !json.data) throw new Error(json?.error ?? "Unable to open submitted marking");
      setReviewDetail(json.data); setReviewReason("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to open submitted marking"); }
    finally { setBusy(null); }
  }

  async function assignReviewer(review: Review) {
    if (!selectedReviewer) { setError("Select an authorized reviewer first."); return; }
    setBusy(`reviewer:${review.evaluationId}`); setError(null);
    try {
      const response = await fetch("/api/admin/assess/marking-review-assignments", { method: "POST", headers: { "content-type": "application/json", "x-idempotency-key": key("reviewer-assignment") }, body: JSON.stringify({ markingAssignmentId: review.assignmentId, reviewerUserId: selectedReviewer }) });
      const json = await response.json().catch(() => null) as { success?: boolean; error?: string } | null;
      if (!response.ok || !json?.success) throw new Error(json?.error ?? "Unable to assign reviewer");
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to assign reviewer"); }
    finally { setBusy(null); }
  }

  async function review(decision: "approve" | "return") {
    if (!selectedReview || reviewReason.trim().length < 3) { setError("Record a review reason before deciding."); return; }
    setBusy(`review:${decision}`); setError(null);
    try {
      const response = await fetch(`/api/admin/assess/marking-evaluations/${selectedReview}/review`, { method: "POST", headers: { "content-type": "application/json", "x-idempotency-key": key("marking-review") }, body: JSON.stringify({ decision, reason: reviewReason.trim() }) });
      const json = await response.json().catch(() => null) as { success?: boolean; error?: string } | null;
      if (!response.ok || !json?.success) throw new Error(json?.error ?? "Unable to record review decision");
      setReviewDetail(null); setSelectedReview(null); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to record review decision"); }
    finally { setBusy(null); }
  }

  async function handoff() {
    const outcomeId = reviewDetail?.moderation?.approvedOutcome?.id;
    if (!outcomeId) return;
    if (!handoffArmed) { setHandoffArmed(true); setError("Review the approved result, then click Send marks to Gradebook again to confirm."); return; }
    setHandoffArmed(false); setBusy("handoff"); setError(null);
    try {
      const response = await fetch(`/api/admin/assess/approved-outcomes/${outcomeId}/handoff`, { method: "POST", headers: { "x-idempotency-key": key("score-handoff") } });
      const json = await response.json().catch(() => null) as { success?: boolean; data?: HandoffReceipt; error?: string } | null;
      if (!response.ok || !json?.success || !json.data) throw new Error(json?.error ?? "Unable to send approved marks");
      setReviewDetail((current) => current?.moderation ? { ...current, moderation: { ...current.moderation, handoffReceipt: json.data! } } : current);
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to send approved marks"); }
    finally { setBusy(null); }
  }

  if (!deliveryId) return null;
  return (
    <GlassPanel id={approvedOnly ? "approved-results-panel" : "marking-panel"} className="p-5">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex items-center gap-2"><UserRound className="h-5 w-5 text-(--ws-cyan)" aria-hidden="true" /><h2 className="text-xl font-semibold text-(--ws-fg)">{approvedOnly ? "Mark and approve" : "Mark and review scripts"}</h2></div><p className="mt-1 max-w-2xl text-sm leading-6 text-(--ws-fg-60)">{approvedOnly ? "Review approved results and send them to the Core Gradebook only when the school is ready." : "Assign verified scripts to active teachers, then give submitted marking an independent review."}</p></div><Button type="button" size="sm" variant="outline" className={glassSecondaryButtonClass} onClick={() => void load()}><RefreshCw className="mr-2 h-3.5 w-3.5" aria-hidden="true" /> Refresh</Button></div>
      {error ? <div role="alert" aria-live="polite" className="mb-4 rounded-xl border border-rose-400/30 bg-rose-400/10 p-3 text-sm text-(--ws-rose)">{error}</div> : null}
      {reviewDetail?.moderation?.approvedOutcome ? <div className="mb-4 rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm text-(--ws-fg)"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-medium">Approved result: {reviewDetail.moderation.approvedOutcome.totalMarks}/{reviewDetail.moderation.approvedOutcome.maximumAvailableMarks}</p><p className="mt-1 text-xs text-(--ws-fg-60)">Integrity reference <code className="break-all">{reviewDetail.moderation.approvedOutcome.integrityReference}</code></p></div>{reviewDetail.moderation.handoffReceipt ? <span className="font-medium text-(--ws-emerald)">Gradebook handoff recorded</span> : <Button type="button" size="sm" className={glassPrimaryButtonClass} onClick={() => void handoff()} disabled={busy === "handoff"}><UploadCloud className="mr-2 h-3.5 w-3.5" aria-hidden="true" /> {busy === "handoff" ? "Sending…" : handoffArmed ? "Confirm send to Gradebook" : "Send marks to Gradebook"}</Button>}</div></div> : null}
      {!data ? <div className={glassInsetClass + " p-4 text-sm text-(--ws-fg-60)"} role="status">Loading marking work…</div> : <>
        {!approvedOnly ? <>
          <div className="grid gap-4 rounded-xl border border-(--ws-line) bg-(--ws-fill) p-4 lg:grid-cols-[1.2fr_1fr_auto_auto] lg:items-end"><label className="text-sm font-medium text-(--ws-fg-70)">Verified script<PremiumSelect value={selectedScript} onValueChange={setSelectedScript}><PremiumSelectTrigger className="mt-2"><PremiumSelectValue placeholder="Select a verified script" /></PremiumSelectTrigger><PremiumSelectContent>{data.eligibleScripts.map((script) => <PremiumSelectItem key={script.packetAssignmentId} value={script.packetAssignmentId}>{label(script.candidate)} · {script.packetId} · {script.pageCount} pages</PremiumSelectItem>)}</PremiumSelectContent></PremiumSelect></label><label className="text-sm font-medium text-(--ws-fg-70)">Marker<PremiumSelect value={selectedMarker} onValueChange={setSelectedMarker}><PremiumSelectTrigger className="mt-2"><PremiumSelectValue placeholder="Select an active teacher" /></PremiumSelectTrigger><PremiumSelectContent>{data.markers.map((marker) => <PremiumSelectItem key={marker.userId} value={marker.userId}>{marker.name}</PremiumSelectItem>)}</PremiumSelectContent></PremiumSelect></label><label className="flex items-center gap-2 pb-2 text-sm text-(--ws-fg-70)"><input type="checkbox" checked={blindMarking} onChange={(event) => setBlindMarking(event.target.checked)} /> Blind marking</label><Button type="button" className={glassPrimaryButtonClass} onClick={() => void assign()} disabled={!selectedScript || !selectedMarker || busy === "assign"}>{busy === "assign" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <ShieldCheck className="mr-2 h-4 w-4" aria-hidden="true" />} Assign script</Button></div>
          <p className="mt-3 text-xs leading-5 text-(--ws-fg-50)">Only active packet assignments with complete, verified private evidence are selectable. Blind marking changes the server projection; it cannot hide identifiers already visible on a physical page.</p>
          <div className="mt-5 grid gap-5 lg:grid-cols-2"><div><h3 className="mb-3 font-medium text-(--ws-fg)">Marker assignments</h3><div className="space-y-2">{data.assignments.length === 0 ? <div className={glassInsetClass + " p-4 text-sm text-(--ws-fg-60)"}>No scripts have been assigned for this paper yet.</div> : data.assignments.map((assignment) => <div key={assignment.id} className={glassInsetClass + " flex items-center justify-between gap-3 p-3"}><div><p className="font-medium text-(--ws-fg)">{assignment.blindMarking ? "Opaque script" : label(assignment.candidate)}</p><p className="text-xs text-(--ws-fg-50)">{assignment.markerName ?? assignment.markerUserId} · {assignment.packetId}</p></div><Badge variant="outline" className={assignment.status === "active" ? "border-cyan-400/30 text-(--ws-cyan)" : "border-(--ws-line) text-(--ws-fg-60)"}>{assignment.status}</Badge></div>)}</div></div><div><h3 className="mb-3 font-medium text-(--ws-fg)">Submitted marking</h3><div className="space-y-2">{data.reviewQueue.length === 0 ? <div className={glassInsetClass + " p-4 text-sm text-(--ws-fg-60)"}>No submitted marking needs review.</div> : data.reviewQueue.map((reviewItem) => <div key={reviewItem.evaluationId} className={glassInsetClass + " space-y-3 p-3"}><div className="flex items-center justify-between gap-3"><div><p className="font-medium text-(--ws-fg)">{reviewItem.blindMarking ? "Opaque script" : label(reviewItem.candidate)}</p><p className="text-xs text-(--ws-fg-50)">{reviewItem.totalMarks ?? "—"}/{reviewItem.maximumMarks} marks · {reviewItem.reviewer?.status === "active" ? `Reviewer: ${reviewItem.reviewer.reviewerName ?? reviewItem.reviewer.reviewerUserId}` : "Reviewer not assigned"}</p></div><Button type="button" size="sm" variant="outline" className={glassSecondaryButtonClass} onClick={() => void openReview(reviewItem.evaluationId)} disabled={busy === `open:${reviewItem.evaluationId}`}><Eye className="mr-2 h-3.5 w-3.5" aria-hidden="true" /> Review</Button></div><div className="flex flex-wrap items-end gap-2"><label className="min-w-56 text-xs font-medium text-(--ws-fg-70)">Independent reviewer<PremiumSelect value={selectedReviewer} onValueChange={setSelectedReviewer}><PremiumSelectTrigger className="mt-1 h-9"><PremiumSelectValue placeholder="Select reviewer" /></PremiumSelectTrigger><PremiumSelectContent>{data.reviewers.filter((reviewer) => reviewer.userId !== reviewItem.reviewer?.reviewerUserId).map((reviewer) => <PremiumSelectItem key={reviewer.userId} value={reviewer.userId}>{reviewer.name}</PremiumSelectItem>)}</PremiumSelectContent></PremiumSelect></label><Button type="button" size="sm" variant="outline" className={glassSecondaryButtonClass} onClick={() => void assignReviewer(reviewItem)} disabled={busy === `reviewer:${reviewItem.evaluationId}` || reviewItem.reviewer?.status === "active"}>{busy === `reviewer:${reviewItem.evaluationId}` ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <ShieldCheck className="mr-2 h-3.5 w-3.5" aria-hidden="true" />} Assign reviewer</Button></div></div>)}</div></div></div>
        </> : null}
        {approvedOnly ? <div id="approved-results" className="mt-2 scroll-mt-6"><div className="mb-3"><h3 className="font-medium text-(--ws-fg)">Approved results ready to send</h3><p className="mt-1 text-sm text-(--ws-fg-60)">Open a result to review its preserved marks and confirm the explicit Gradebook handoff.</p></div><div className="space-y-2">{data.approvedResults.length === 0 ? <div className={glassInsetClass + " p-4 text-sm text-(--ws-fg-60)"}>No approved results are ready for this paper.</div> : data.approvedResults.map((result) => <div key={result.outcomeId} className={glassInsetClass + " flex flex-wrap items-center justify-between gap-3 p-3"}><div><p className="font-medium text-(--ws-fg)">{result.blindMarking ? "Opaque script" : label(result.candidate)}</p><p className="text-xs text-(--ws-fg-50)">{result.totalMarks}/{result.maximumMarks} marks · {result.handoff?.coreAssessmentScoreId ? "Already sent to Gradebook" : "Ready for explicit handoff"}</p></div><Button type="button" size="sm" variant="outline" className={glassSecondaryButtonClass} onClick={() => void openReview(result.evaluationId)}><Eye className="mr-2 h-3.5 w-3.5" aria-hidden="true" /> Open result</Button></div>)}</div></div> : null}
        {reviewDetail ? <div className="mt-5 rounded-xl border border-(--ws-violet)/30 bg-(--ws-fill) p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold text-(--ws-fg)">{approvedOnly ? "Approved result review" : "Independent review"} · {reviewDetail.assignment.blindMarking ? "opaque script" : label(reviewDetail.assignment.candidate)}</h3><p className="mt-1 text-sm text-(--ws-fg-60)">Question-level marks remain preserved in the submitted revision. This view cannot silently edit them.</p></div><CheckCircle2 className="h-5 w-5 text-(--ws-violet)" aria-hidden="true" /></div><div className="mt-4 space-y-3">{reviewDetail.questions.map((question) => { const score = reviewDetail.evaluation.questionScores.find((entry) => entry.questionId === question.id); return <div key={question.id} className={glassInsetClass + " p-3"}><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-medium text-(--ws-fg)">Question {question.order + 1} · {question.maximumMarks} marks</p><p className="mt-1 whitespace-pre-wrap text-sm text-(--ws-fg-70)">{question.prompt}</p></div><Badge variant="outline" className="border-(--ws-violet)/40 text-(--ws-violet)">{score?.score ?? "—"}/{question.maximumMarks}</Badge></div>{score?.feedback ? <p className="mt-2 text-sm text-(--ws-fg-60)">Feedback: {score.feedback}</p> : null}<p className="mt-2 text-xs text-(--ws-fg-60)">Criteria: {question.markingGuide || "No guide captured"}</p></div>; })}</div>{!approvedOnly ? <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_auto]"><label className="sr-only" htmlFor="review-reason">Review reason</label><Textarea id="review-reason" value={reviewReason} onChange={(event) => setReviewReason(event.target.value)} placeholder="Approval rationale or required correction reason" maxLength={2000} className="bg-(--ws-fill)" /><Button type="button" className={glassPrimaryButtonClass} onClick={() => void review("approve")} disabled={busy?.startsWith("review:")}>{busy === "review:approve" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null} Approve</Button><Button type="button" variant="outline" className="border-amber-400/30 text-(--ws-amber) hover:bg-amber-400/10" onClick={() => void review("return")} disabled={busy?.startsWith("review:")}>{busy === "review:return" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <AlertTriangle className="mr-2 h-4 w-4" aria-hidden="true" />} Return</Button></div> : <p className="mt-4 text-sm text-(--ws-fg-60)">This result is already approved. Use Send marks to Gradebook above only after the school confirms the handoff.</p>}<div className="mt-3 flex flex-wrap gap-2">{reviewDetail.eligibility.pages.map((page) => <Button asChild key={page.id} type="button" size="sm" variant="outline" className={glassSecondaryButtonClass}><a href={`/api/admin/assess/evidence/${page.id}/preview`} target="_blank" rel="noreferrer"><Eye className="mr-2 h-3.5 w-3.5" aria-hidden="true" /> Evidence page {page.pageNumber ?? ""}</a></Button>)}</div></div> : null}
      </>}
    </GlassPanel>
  );
}
