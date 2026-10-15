"use client";

import * as React from "react";
import { AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, FileText, Loader2, Sparkles, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Candidate = { key: string; label: string; recommended: boolean };
type ReviewIssue = {
  issueId: string; type: string; severity: "review" | "blocking"; title: string; attentionReason: string | null; description: string; sourceValue: string | null;
  context: { gradeBand: string | null }; affectedCount: number; affectedTeachers: Array<{ rowRef: string; name: string; homeroom: string | null }>;
  candidates: Candidate[]; recommendedKey: string | null; resolved: boolean; updatedAt: string;
};
type ReviewDto = {
  compatibility: { outcome: string; reason: string };
  summary: { totalTeachers: number; readyTeachers: number; reviewTeachers: number; blockedTeachers: number; decisionCount: number; automaticMatches: number };
  columnMappings: Array<{ sourceHeader: string; canonicalField: string | null; source: string; confidence: number; status: string; explanation: string | null }>;
  columnMappingReviewRequired: boolean;
  activeIssues: ReviewIssue[]; resolvedIssues: ReviewIssue[];
  rows: Array<{ rowRef: string; name: string; homeroom: string | null; subjectProfile: string[]; assignments: string[]; attentionReason: string | null; status: string; issueCount: number }>;
  leoStatus: { status: string; available: boolean; message: string | null } | null;
};

export function TeacherImportReviewV2({ jobId, onContinue }: { jobId: string; onContinue: () => void }) {
  const [review, setReview] = React.useState<ReviewDto | null>(null);
  const [index, setIndex] = React.useState(0);
  const [busy, setBusy] = React.useState(false);
  const [showAll, setShowAll] = React.useState(false);
  const [instruction, setInstruction] = React.useState("");
  const [proposal, setProposal] = React.useState<{ proposalId: string; status: string; explanation: string | null; isReplacement?: boolean; preview: { summary: string; changes: string[]; warnings: string[]; affectedTeachers: string[]; requiresConfirmation: boolean } } | null>(null);
  const [assessment, setAssessment] = React.useState<{ summary: string; likelyInterpretation: string; explanation: string; confidence: string; suggestedActions: string[]; status: string } | null>(null);
  const [similarPreview, setSimilarPreview] = React.useState<{ proposalId: string; groupId: string; template: string; version: string; teachers: Array<{ rowRef: string; name: string; homeroom: string | null; subjectCount: number; signal: string }> } | null>(null);
  const [mappingDraft, setMappingDraft] = React.useState<Record<string, string>>({});
  const load = React.useCallback(async () => {
    const response = await fetch(`/api/admin/teachers/imports/${jobId}/review`, { cache: "no-store" });
    const json = await response.json();
    if (!response.ok || !json.success) throw new Error(json.error || "Could not load the review.");
    setReview(json.data as ReviewDto);
    const resumeIndex = json.data.attentionReview?.lastRowRef ? (json.data.activeIssues || []).findIndex((item: ReviewIssue) => item.affectedTeachers.some((teacher) => teacher.rowRef === json.data.attentionReview.lastRowRef)) : -1;
    setIndex(resumeIndex >= 0 ? resumeIndex : (current) => Math.min(current, Math.max(0, (json.data.activeIssues?.length || 1) - 1)));
  }, [jobId]);
  React.useEffect(() => { void load().catch((error) => toast.error(error instanceof Error ? error.message : "Could not load review.")); }, [load]);
  React.useEffect(() => { setAssessment(null); setProposal(null); setSimilarPreview(null); }, [review?.activeIssues[index]?.issueId]);
  React.useEffect(() => {
    if (!review) return;
    setMappingDraft(Object.fromEntries(review.columnMappings.map((mapping) => [mapping.sourceHeader, mapping.canonicalField || ""])));
  }, [review?.columnMappings]);

  const saveAction = async (issue: ReviewIssue, action: Record<string, unknown>) => {
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/teachers/imports/${jobId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issueAction: { issueId: issue.issueId, expectedUpdatedAt: issue.updatedAt, ...action } }),
      });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || "Could not save this decision.");
      await load();
      toast.success(`Decision saved for ${issue.affectedCount} ${issue.affectedCount === 1 ? "teacher" : "teachers"}.`);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not save this decision."); }
    finally { setBusy(false); }
  };
  const saveProgress = (nextIndex: number) => {
    const next = review?.activeIssues[nextIndex];
    setIndex(nextIndex);
    if (next) void fetch(`/api/admin/teachers/imports/${jobId}/review/progress`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lastRowRef: next.affectedTeachers[0]?.rowRef || null }) });
  };
  const reopen = async (issue: ReviewIssue) => {
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/teachers/imports/${jobId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reopenIssue: { issueId: issue.issueId, expectedUpdatedAt: issue.updatedAt } }) });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || "Could not reopen this decision.");
      await load();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not reopen this decision."); }
    finally { setBusy(false); }
  };
  const interpret = async (issue: ReviewIssue) => {
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/teachers/imports/${jobId}/review/interpret`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ issueId: issue.issueId, instruction }) });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || "Leo couldn't interpret that instruction right now.");
      if (json.data.status !== "interpreted") throw new Error(json.data.explanation || json.data.validation?.message || "Leo couldn't interpret that instruction right now.");
      setProposal(json.data); setInstruction("");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Leo couldn't interpret that instruction right now."); }
    finally { setBusy(false); }
  };
  const assess = async (issue: ReviewIssue) => {
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/teachers/imports/${jobId}/review/attention`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ issueId: issue.issueId }) });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || "Leo couldn't assess this attention item right now.");
      setAssessment(json.data);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Leo couldn't assess this attention item right now."); }
    finally { setBusy(false); }
  };
  const confirmProposal = async () => {
    if (!proposal) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/teachers/imports/${jobId}/review/confirm-instruction`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ instructionId: proposal.proposalId }) });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || "Could not confirm Leo's interpretation.");
      setProposal(null);
      const previewResponse = await fetch(`/api/admin/teachers/imports/${jobId}/review/similar?proposalId=${encodeURIComponent(proposal.proposalId)}`, { cache: "no-store" });
      const previewJson = await previewResponse.json();
      if (previewResponse.ok && previewJson.success && previewJson.data.count > 0) setSimilarPreview({ proposalId: proposal.proposalId, ...previewJson.data });
      else { await load(); toast.success("Leo interpretation confirmed and saved."); }
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not confirm Leo's interpretation."); }
    finally { setBusy(false); }
  };

  const saveColumnMappings = async () => {
    if (!review) return;
    const repeatable = new Set(["subjects", "gradeScopes", "classScopes", "explicitAssignments"]);
    const selected = Object.values(mappingDraft).filter(Boolean);
    const duplicate = selected.find((field, index) => !repeatable.has(field) && selected.indexOf(field) !== index);
    if (duplicate) {
      toast.error(`Only one source column can be mapped to ${fieldLabel(duplicate)}.`);
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/teachers/imports/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ columnMappings: review.columnMappings.map((mapping) => ({ sourceHeader: mapping.sourceHeader, canonicalField: mappingDraft[mapping.sourceHeader] || null })) }),
      });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || "Could not save column mappings.");
      await load();
      toast.success("Column mappings saved. Leo's proposals are now confirmed for this import.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not save column mappings."); }
    finally { setBusy(false); }
  };

  if (!review) return <div className="flex min-h-[280px] items-center justify-center text-(--ws-fg-60)"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Loading review</div>;
  if (review.compatibility.outcome === "restart_required") return <Notice tone="bad">{review.compatibility.reason} Upload the workbook again to begin a safe V2 review.</Notice>;
  const issue = review.activeIssues[index];
  if (!issue) return <div className="space-y-4">
    <ColumnMappingReview review={review} mappingDraft={mappingDraft} setMappingDraft={setMappingDraft} busy={busy} onSave={saveColumnMappings} />
    {showAll
      ? <><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-lg font-semibold">All imported teachers</h3><p className="text-sm text-(--ws-fg-60)">Read-only verification. Nothing changes until you continue.</p></div><Button variant="outline" onClick={() => setShowAll(false)}>Back to ready state</Button></div><AllTeachers rows={review.rows} /><div className="flex justify-end"><Button disabled={review.columnMappingReviewRequired} onClick={onContinue}>Continue</Button></div></>
      : <ReviewComplete review={review} onContinue={onContinue} onShowAll={() => setShowAll(true)} columnMappingReviewRequired={review.columnMappingReviewRequired} />}
  </div>;
  const position = index + 1;
  return <div className="space-y-5">
    <section className="rounded-2xl border border-(--ws-line) bg-(--ws-fill) p-5">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="h-4 w-4 text-(--ws-cyan)" />Leo reviewed {review.summary.totalTeachers} teachers</p><p className="mt-1 text-sm text-(--ws-fg-60)">{review.summary.automaticMatches} matches resolved automatically from your school data.</p></div><Button variant="outline" size="sm" onClick={() => setShowAll((value) => !value)}><Users className="mr-2 h-4 w-4" />{showAll ? "Back to decisions" : "View all teachers"}</Button></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3"><Metric label="Ready" value={review.summary.readyTeachers} tone="good" /><Metric label="Affected by decisions" value={review.summary.reviewTeachers} tone="warn" /><Metric label="Blocked" value={review.summary.blockedTeachers} tone="bad" /></div>
    </section>
    <ColumnMappingReview review={review} mappingDraft={mappingDraft} setMappingDraft={setMappingDraft} busy={busy} onSave={saveColumnMappings} />
    {showAll ? <AllTeachers rows={review.rows} /> : <>
      <div className="flex items-center justify-between text-sm"><span className="font-medium">Teacher {position} of {review.activeIssues.length} needing attention <span className="sr-only">(Decision {position} of {review.activeIssues.length})</span></span><span className="text-(--ws-fg-60)" aria-live="polite">{review.activeIssues.length} remaining</span></div>
      <div className="flex gap-1" aria-label={`Decision ${position} of ${review.activeIssues.length}`}>{review.activeIssues.map((item, itemIndex) => <span key={item.issueId} className={`h-1.5 flex-1 rounded-full ${itemIndex === index ? "bg-(--ws-cyan)" : "bg-(--ws-line)"}`} />)}</div>
      {similarPreview ? <SimilarConfirmation preview={similarPreview} busy={busy} onApply={async () => { setBusy(true); try { const response = await fetch(`/api/admin/teachers/imports/${jobId}/review/similar`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ proposalId: similarPreview.proposalId, groupId: similarPreview.groupId, expectedUpdatedAt: similarPreview.version }) }); const json = await response.json(); if (!response.ok || !json.success) throw new Error(json.error || "This similarity group changed. Refresh and review it again."); setSimilarPreview(null); await load(); toast.success(`Applied to ${json.data.appliedCount} similar teachers.${json.data.excludedCount ? ` ${json.data.excludedCount} still need individual review.` : ""}`); } catch (error) { toast.error(error instanceof Error ? error.message : "Could not apply to similar teachers."); } finally { setBusy(false); } }} onReview={async () => { setSimilarPreview(null); await load(); }} onCancel={async () => { setSimilarPreview(null); await load(); }} /> : proposal ? <ProposalConfirmation proposal={proposal} busy={busy} onConfirm={confirmProposal} onChange={() => setProposal(null)} /> : <IssueCard jobId={jobId} issue={issue} busy={busy} instruction={instruction} setInstruction={setInstruction} assessment={assessment} onAssess={() => assess(issue)} onAction={(action) => saveAction(issue, action)} onInterpret={() => interpret(issue)} onPlan={setProposal} />}
      <div className="flex flex-wrap justify-between gap-3"><Button variant="outline" disabled={busy || index === 0} onClick={() => saveProgress(Math.max(0, index - 1))}><ChevronLeft className="mr-1 h-4 w-4" />Previous</Button><div className="flex gap-2"><Button variant="ghost" disabled={busy} onClick={() => saveProgress(Math.min(review.activeIssues.length - 1, index + 1))}>Skip for now</Button><Button variant="outline" disabled={busy || index >= review.activeIssues.length - 1} onClick={() => saveProgress(Math.min(review.activeIssues.length - 1, index + 1))}>Next<ChevronRight className="ml-1 h-4 w-4" /></Button></div></div>
    </>}
    {review.resolvedIssues.length > 0 && <section className="rounded-xl border border-(--ws-line) p-4"><h3 className="text-sm font-semibold">Resolved decisions</h3><div className="mt-3 space-y-2">{review.resolvedIssues.map((resolved) => <div key={resolved.issueId} className="flex items-center justify-between gap-3 rounded-lg bg-(--ws-fill) px-3 py-2 text-sm"><span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-600" />{resolved.title}</span><Button size="sm" variant="ghost" disabled={busy} onClick={() => reopen(resolved)}>Reopen</Button></div>)}</div></section>}
  </div>;
}

function IssueCard({ jobId, issue, busy, instruction, setInstruction, assessment, onAssess, onAction, onInterpret, onPlan }: { jobId: string; issue: ReviewIssue; busy: boolean; instruction: string; setInstruction: (value: string) => void; assessment: { summary: string; likelyInterpretation: string; explanation: string; confidence: string; suggestedActions: string[]; status: string } | null; onAssess: () => void; onAction: (action: Record<string, unknown>) => void; onInterpret: () => void; onPlan: (value: { proposalId: string; status: string; explanation: string | null; preview: { summary: string; changes: string[]; warnings: string[]; affectedTeachers: string[]; requiresConfirmation: boolean } }) => void }) {
  const [choice, setChoice] = React.useState("");
  React.useEffect(() => setChoice(issue.recommendedKey || ""), [issue.issueId, issue.recommendedKey]);
  const [classes, setClasses] = React.useState<Array<{ key: string; label: string; occupied: boolean; recommended: boolean }>>([]); const [showClasses, setShowClasses] = React.useState(false);
  const blockingEmail = issue.severity === "blocking" && issue.type === "missing_required";
  const loadClasses = async () => { const response = await fetch(`/api/admin/teachers/imports/${jobId}/review/manual-homeroom?issueId=${encodeURIComponent(issue.issueId)}`); const json = await response.json(); if (!response.ok || !json.success) throw new Error(json.error || "Could not load classes."); setClasses(json.data); setShowClasses(true); };
  const previewHomeroom = async (classGroupKey: string | null, replace = false) => { const response = await fetch(`/api/admin/teachers/imports/${jobId}/review/manual-homeroom`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ issueId: issue.issueId, classGroupKey, replace }) }); const json = await response.json(); if (!response.ok || !json.success) throw new Error(json.error || "Could not preview this homeroom change."); if (json.data.status !== "interpreted") throw new Error(json.data.explanation || "Choose another class or explicitly replace its homeroom teacher."); onPlan(json.data); };
  return <section className={`rounded-2xl border p-5 ${issue.severity === "blocking" ? "border-rose-300 bg-rose-50 text-slate-950 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-(--ws-fg)" : "border-amber-300 bg-amber-50 text-slate-950 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-(--ws-fg)"}`}>
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide">{issue.severity === "blocking" ? "Blocked" : issue.context.gradeBand ? titleBand(issue.context.gradeBand) : "Needs your decision"}</p><h3 className="mt-1 text-lg font-semibold">{issue.title}</h3></div><span className="rounded-full border border-current/20 px-2 py-1 text-xs">{issue.affectedCount} {issue.affectedCount === 1 ? "teacher" : "teachers"} affected</span></div>
    <p className="mt-3 text-xs font-semibold uppercase tracking-wide opacity-70">Why this needs attention</p><p className="mt-1 text-sm leading-6 opacity-80">{issue.description}</p>
    {issue.type.startsWith("attention_") && <div className="mt-4 rounded-xl border border-(--ws-cyan)/30 bg-(--ws-cyan)/8 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="h-4 w-4 text-(--ws-cyan)" />Leo's assessment</p>{assessment?.status === "completed" && <span className="text-xs opacity-70">{assessment.confidence} confidence</span>}</div>{assessment ? <><p className="mt-2 text-sm font-medium">{assessment.summary}</p><p className="mt-2 text-sm opacity-80">{assessment.likelyInterpretation}</p><p className="mt-2 text-xs opacity-70">{assessment.explanation}</p>{assessment.suggestedActions.length > 0 && <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">{assessment.suggestedActions.map((action) => <li key={action}>{action}</li>)}</ul>}</> : <><p className="mt-2 text-sm opacity-80">Ask Leo for a bounded explanation of this pattern. Nothing will be changed automatically.</p><Button className="mt-3" variant="outline" disabled={busy} onClick={onAssess}>{busy ? "Assessing…" : "Ask Leo to explain"}</Button></>}</div>}
    {issue.affectedTeachers.length > 0 && <div className="mt-4 rounded-xl border border-current/15 bg-white/45 p-3 dark:bg-black/10"><p className="text-xs font-semibold">Teachers affected</p><ul className="mt-2 space-y-1 text-sm">{issue.affectedTeachers.slice(0, 6).map((teacher) => <li key={teacher.rowRef}>{teacher.name}{teacher.homeroom ? <span className="opacity-70"> — {teacher.homeroom}</span> : null}</li>)}{issue.affectedTeachers.length > 6 && <li className="opacity-70">and {issue.affectedTeachers.length - 6} more</li>}</ul></div>}
    {blockingEmail ? <EmailAction issue={issue} busy={busy} onAction={onAction} /> : <>
      {issue.candidates.length > 0 && <div className="mt-4"><label className="text-sm font-medium" htmlFor={`subject-${issue.issueId}`}>Choose a compatible school subject</label><select id={`subject-${issue.issueId}`} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 dark:border-(--ws-line) dark:bg-(--ws-fill) dark:text-(--ws-fg)" value={choice} onChange={(event) => setChoice(event.target.value)}>{issue.candidates.map((candidate) => <option key={candidate.key} value={candidate.key}>{candidate.recommended ? `Recommended — ${candidate.label}` : candidate.label}</option>)}</select><div className="mt-3 flex flex-wrap gap-2"><Button disabled={busy || !choice} onClick={() => onAction({ type: "select_subject", subjectOfferingId: choice })}>Use {choice === issue.recommendedKey ? "recommendation" : "selected subject"}</Button>{issue.type === "subject_unresolved" || issue.type === "semantic_substitution_review" ? <Button variant="outline" disabled={busy} onClick={() => onAction({ type: "ignore_subject" })}>Ignore {issue.sourceValue ? `“${issue.sourceValue}”` : "subject"}</Button> : null}</div></div>}
      {issue.type === "stage_mismatch" && <div className="mt-4"><p className="text-sm">The recognised subject association is already valid for this teacher’s known context. Keep it only if that is what the spreadsheet intended.</p><div className="mt-3 flex flex-wrap gap-2"><Button variant="outline" disabled={busy} onClick={() => onAction({ type: "keep_recognised_subject" })}>Keep recognised subject</Button><Button variant="outline" disabled={busy} onClick={() => onAction({ type: "ignore_subject" })}>Remove imported {issue.sourceValue ? `“${issue.sourceValue}”` : "subject"}</Button></div></div>}
      {issue.type.includes("homeroom") && <div className="mt-4 border-t border-current/15 pt-4"><div className="flex flex-wrap gap-2"><Button variant="outline" disabled={busy} onClick={() => loadClasses().catch((error) => toast.error(error.message))}>Choose another homeroom</Button><Button variant="outline" disabled={busy} onClick={() => previewHomeroom(null).catch((error) => toast.error(error.message))}>Do not assign homeroom</Button></div>{showClasses && <select className="mt-3 w-full rounded-lg border p-2 text-slate-950" defaultValue="" onChange={(event) => { const selected = classes.find((item) => item.key === event.target.value); if (selected) previewHomeroom(selected.key, selected.occupied).catch((error) => toast.error(error.message)); }}><option value="">Choose an active class</option>{classes.map((item) => <option key={item.key} value={item.key}>{item.recommended ? `Recommended — ${item.label}` : item.label}{item.occupied ? " — replace current homeroom teacher" : ""}</option>)}</select>}</div>}
      <div className="mt-5 border-t border-current/15 pt-4"><label htmlFor={`leo-${issue.issueId}`} className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="h-4 w-4" />Tell Leo what you mean</label><Textarea id={`leo-${issue.issueId}`} value={instruction} onChange={(event) => setInstruction(event.target.value)} className="mt-2 border-slate-300 bg-white text-slate-950 dark:border-(--ws-line) dark:bg-(--ws-fill) dark:text-(--ws-fg)" placeholder="Explain the intended meaning for this decision" /><p className="mt-2 text-xs opacity-70">Leo will propose a change for you to confirm. It will not apply anything automatically.</p><Button className="mt-2" variant="outline" disabled={!instruction.trim() || busy} onClick={onInterpret}>{busy ? "Interpreting…" : "Interpret with Leo"}</Button></div>
    </>}
  </section>;
}

function EmailAction({ issue, busy, onAction }: { issue: ReviewIssue; busy: boolean; onAction: (action: Record<string, unknown>) => void }) { const [email, setEmail] = React.useState(""); return <div className="mt-4"><label className="text-sm font-medium" htmlFor={`email-${issue.issueId}`}>Email address</label><input id={`email-${issue.issueId}`} type="email" className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-950 dark:border-(--ws-line) dark:bg-(--ws-fill) dark:text-(--ws-fg)" value={email} onChange={(event) => setEmail(event.target.value)} /><Button className="mt-3" disabled={busy || !email} onClick={() => onAction({ type: "set_email", email })}>Save and continue</Button></div>; }
function ProposalConfirmation({ proposal, busy, onConfirm, onChange }: { proposal: { explanation: string | null; isReplacement?: boolean; preview: { summary: string; changes: string[]; warnings: string[] } }; busy: boolean; onConfirm: () => void; onChange: () => void }) { return <section className={`rounded-2xl border p-5 ${proposal.isReplacement ? "border-rose-400/50 bg-rose-500/10" : "border-(--ws-cyan)/35 bg-(--ws-cyan)/8"}`}><p className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="h-4 w-4 text-(--ws-cyan)" />{proposal.isReplacement ? "Replace homeroom teacher?" : "I understood that you want to:"}</p><ul className="mt-3 space-y-2 text-sm">{proposal.preview.changes.map((change, index) => <li key={`${change}-${index}`}>✓ {change}</li>)}</ul>{proposal.preview.warnings.length > 0 && <ul className="mt-3 space-y-1 text-sm text-amber-700 dark:text-amber-300">{proposal.preview.warnings.map((warning) => <li key={warning}>! {warning}</li>)}</ul>}<p className="mt-3 text-sm text-(--ws-fg-60)">{proposal.preview.summary || proposal.explanation || "Please confirm these changes."}</p><p className="mt-2 text-xs text-(--ws-fg-60)">Nothing has changed yet.</p><div className="mt-4 flex gap-2"><Button variant={proposal.isReplacement ? "destructive" : "default"} disabled={busy} onClick={onConfirm}>{proposal.isReplacement ? "Confirm replacement" : "Confirm"}</Button><Button variant="outline" disabled={busy} onClick={onChange}>Go back</Button></div></section>; }
function SimilarConfirmation({ preview, busy, onApply, onReview, onCancel }: { preview: { groupId: string; template: string; teachers: Array<{ rowRef: string; name: string; homeroom: string | null; subjectCount: number; signal: string }>; }; busy: boolean; onApply: () => void; onReview: () => void; onCancel: () => void }) { return <section className="rounded-2xl border border-(--ws-cyan)/35 bg-(--ws-cyan)/8 p-5"><p className="flex items-center gap-2 text-sm font-semibold"><Users className="h-4 w-4 text-(--ws-cyan)" />Apply this interpretation to similar teachers?</p><p className="mt-2 text-sm opacity-80">The confirmed interpretation will be adapted to each teacher’s own subject profile and homeroom. Nothing else will be imported yet.</p><p className="mt-3 text-sm font-medium">EduSentrix found {preview.teachers.length} similar {preview.teachers.length === 1 ? "teacher" : "teachers"}.</p><div className="mt-3 max-h-52 space-y-2 overflow-auto">{preview.teachers.map((teacher) => <div key={teacher.rowRef} className="rounded-lg border border-current/10 bg-white/30 px-3 py-2 text-sm dark:bg-black/10"><p className="font-medium">{teacher.name} <span className="font-normal opacity-70">— {teacher.homeroom || "No homeroom"}</span></p><p className="text-xs opacity-70">{teacher.subjectCount} listed subjects · {teacher.signal}</p></div>)}</div><p className="mt-3 text-xs opacity-70">This review decision will be recorded separately for every affected teacher.</p><div className="mt-4 flex flex-wrap gap-2"><Button disabled={busy} onClick={onApply}>Apply to {preview.teachers.length} teachers</Button><Button variant="outline" disabled={busy} onClick={onReview}>Review individually</Button><Button variant="ghost" disabled={busy} onClick={onCancel}>Cancel</Button></div></section>; }
function ReviewComplete({ review, onContinue, onShowAll, columnMappingReviewRequired }: { review: ReviewDto; onContinue: () => void; onShowAll: () => void; columnMappingReviewRequired: boolean }) { return <section className="rounded-2xl border border-emerald-300 bg-emerald-50 p-6 text-center text-slate-950 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-(--ws-fg)"><CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" /><h3 className="mt-3 text-xl font-semibold">Your teacher import is ready</h3><p className="mt-2 text-sm opacity-80">{review.summary.readyTeachers} ready · {review.summary.reviewTeachers} need attention · {review.summary.blockedTeachers} blocked</p><p className="mt-2 text-sm opacity-80">{review.summary.automaticMatches} matches resolved automatically.</p>{columnMappingReviewRequired && <p className="mt-3 text-sm font-medium text-amber-800 dark:text-amber-200">Confirm the column mappings above before continuing.</p>}<div className="mt-5 flex justify-center gap-3"><Button disabled={columnMappingReviewRequired} onClick={onContinue}>Continue</Button><Button variant="outline" onClick={onShowAll}>Review all teachers</Button></div></section>; }
function ColumnMappingReview({ review, mappingDraft, setMappingDraft, busy, onSave }: { review: ReviewDto; mappingDraft: Record<string, string>; setMappingDraft: React.Dispatch<React.SetStateAction<Record<string, string>>>; busy: boolean; onSave: () => void }) {
  if (!review.columnMappings.length) return null;
  const fields = [
    ["firstName", "First name"], ["middleNames", "Middle names"], ["lastName", "Last name"], ["fullName", "Full name"], ["email", "Email"], ["phone", "Phone"], ["employeeId", "Employee ID"], ["department", "Department"], ["status", "Status"], ["subjects", "Subjects"], ["gradeScopes", "Grades taught"], ["classScopes", "Classes taught"], ["explicitAssignments", "Teaching assignments"], ["subjectOfferingIds", "Subject offering IDs"], ["homeroomGrade", "Homeroom grade"], ["homeroomClass", "Homeroom class"], ["homeroomClassGroupId", "Homeroom class-group ID"],
  ] as const;
  return <section className="rounded-2xl border border-(--ws-cyan)/35 bg-(--ws-cyan)/8 p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="h-4 w-4 text-(--ws-cyan)" />Leo column mapping</p><p className="mt-1 text-sm text-(--ws-fg-60)">Leo proposed these mappings from the header names only. Confirm or correct them before reviewing teachers.</p></div><span className="rounded-full border border-(--ws-line) px-2 py-1 text-xs">{review.columnMappings.filter((mapping) => mapping.source === "leo").length} Leo proposals</span></div><div className="mt-4 space-y-2">{review.columnMappings.map((mapping) => <div key={mapping.sourceHeader} className="grid gap-2 rounded-lg border border-(--ws-line) bg-(--ws-fill) p-3 sm:grid-cols-[1fr_1fr_auto]"><div className="min-w-0"><p className="truncate text-sm font-medium">{mapping.sourceHeader}</p><p className="mt-1 text-xs text-(--ws-fg-60)">{mapping.source === "leo" ? `Leo proposal · ${Math.round(mapping.confidence * 100)}% confidence` : mapping.status === "resolved" ? "Confirmed" : "Needs mapping"}{mapping.explanation ? ` · ${mapping.explanation}` : ""}</p></div><select className="rounded-lg border border-(--ws-line) bg-(--ws-popover) px-3 py-2 text-sm" value={mappingDraft[mapping.sourceHeader] || ""} onChange={(event) => setMappingDraft((current) => ({ ...current, [mapping.sourceHeader]: event.target.value }))}><option value="">Ignore this column</option>{fields.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><span className="self-center text-xs text-(--ws-fg-60)">{mapping.status === "resolved" ? "Confirmed" : "Review"}</span></div>)}</div>{review.columnMappingReviewRequired && <Button className="mt-4" disabled={busy} onClick={onSave}>{busy ? "Saving…" : "Confirm column mappings"}</Button>}</section>;
}
function fieldLabel(value: string) { return value.replaceAll(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase()); }
function AllTeachers({ rows }: { rows: ReviewDto["rows"] }) { return <section className="rounded-xl border border-(--ws-line) p-4"><h3 className="flex items-center gap-2 font-semibold"><FileText className="h-4 w-4" />All teachers</h3><p className="mt-1 text-xs text-(--ws-fg-60)">Ready means there are no outstanding import decisions; it does not mean a timetable is configured.</p><div className="mt-3 space-y-2">{rows.map((row) => <div key={row.rowRef} className="grid gap-3 rounded-lg bg-(--ws-fill) p-3 text-sm sm:grid-cols-[1.2fr_1fr_1fr_auto]"><div><p className="font-medium">{row.name}</p><p className="text-xs text-(--ws-fg-60)">{row.rowRef}</p></div><div><p><span className="font-medium">Homeroom:</span> {row.homeroom || "None"}</p><p className="mt-1"><span className="font-medium">Subjects:</span> {row.subjectProfile.slice(0, 3).join(", ") || "None"}{row.subjectProfile.length > 3 ? ` +${row.subjectProfile.length - 3}` : ""}</p></div><div><span className="font-medium">Assignments:</span> {row.assignments.slice(0, 2).join(", ") || "None"}{row.assignments.length > 2 ? ` +${row.assignments.length - 2}` : ""}</div><div><span className={row.status === "resolved" ? "text-emerald-600" : row.status === "blocked" ? "text-rose-600" : "text-amber-700 dark:text-amber-300"}>{row.status === "resolved" ? "Ready" : row.status === "blocked" ? "Blocked" : "Needs attention"}</span>{row.attentionReason && <p className="mt-1 text-xs text-(--ws-fg-60)">{row.attentionReason}</p>}</div></div>)}</div></section>; }
function Metric({ label, value, tone }: { label: string; value: number; tone: "good" | "warn" | "bad" }) { return <div className="rounded-xl border border-(--ws-line) bg-(--ws-popover) p-3"><p className="text-xs text-(--ws-fg-60)">{label}</p><p className={`mt-1 text-xl font-semibold ${tone === "good" ? "text-emerald-600" : tone === "warn" ? "text-amber-700 dark:text-amber-300" : "text-rose-600"}`}>{value}</p></div>; }
function Notice({ children, tone }: { children: React.ReactNode; tone: "bad" }) { return <div className="flex gap-2 rounded-xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100"><AlertCircle className="h-4 w-4 shrink-0" />{children}</div>; }
function titleBand(value: string) { return value.split("_").map((part) => part[0]?.toUpperCase() + part.slice(1)).join(" "); }
