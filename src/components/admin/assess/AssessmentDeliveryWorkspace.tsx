"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Ban,
  Download,
  Eye,
  FileCheck2,
  GraduationCap,
  Loader2,
  LockKeyhole,
  PackageCheck,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GlassPanel } from "@/components/ui/glass-panel";
import { Input } from "@/components/ui/input";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import { WorkspacePageHeader } from "@/components/ui/workspace-page-header";
import { WorkspacePageShell } from "@/components/ui/workspace-page-shell";
import { useConfirmationDialog } from "@/hooks/useConfirmationDialog";
import { PAPER_WORKFLOW_STEPS, type AssessWorkflowFocus } from "@/lib/assess/assessment-ux-guidance";
import { glassInsetClass, glassPrimaryButtonClass, glassSecondaryButtonClass } from "@/lib/ui/glass-surfaces";
import { AssessmentEvidenceReconciliationPanel } from "./AssessmentEvidenceReconciliationPanel";
import { AssessmentMarkingAssignmentPanel } from "./AssessmentMarkingAssignmentPanel";
import { AssessWorkspaceNav } from "./AssessWorkspaceNav";

type Definition = {
  id: string;
  sourceExamPaperId: string;
  title: string;
  version: number;
  resultBinding: "none" | "score_bearing";
  assessmentPlanId: string | null;
  assessmentItemId: string | null;
  durationMinutes: number | null;
};
type Delivery = {
  id: string;
  deliveryKey: string;
  assessmentDefinitionVersionId: string;
  version: number;
  title: string;
  mode: "paper";
  status: string;
  resultBinding: "none" | "score_bearing";
  timing: { durationMinutes: number };
  accessibilityPolicy: { extraTimeMinutes: number; largePrint: boolean; readerOrScribe: boolean };
  createdAt: string;
  updatedAt: string;
};
type Packet = {
  id: string;
  packetId: string;
  assessmentDeliveryVersionId: string;
  fallbackCode: string;
  batchId: string;
  batchSequence: number;
  batchQuantity: number;
  status: "issued" | "voided";
  createdAt: string;
  issuedAt: string;
  voidReason: string | null;
  pageManifest: { pageNumber: number; expectedPageCount: number; fallbackCode: string }[];
};
type Batch = { batchId: string; quantity: number; deliveryId: string | null; createdAt: string | null; issuedCount: number; voidedCount: number; packetIds: string[] };
type Candidate = { id: string; firstName: string; middleName: string | null; lastName: string; admissionNo: string | null; gradeId: string; classGroupId: string; status: string; enrolledAt: string | null };
type Assignment = { id: string; deliveryId: string; packetId: string; studentId: string; status: "active" | "replaced"; assignedAt: string; replacedAt: string | null };
type Correction = { id: string; assignmentId: string; packetId: string; originalStudentId: string; proposedStudentId: string; reason: string; status: "pending" | "approved" | "rejected"; requestedAt: string; decisionReason: string | null };
type WorkspaceData = { definitions: Definition[]; deliveries: Delivery[]; packets: Packet[]; batches: Batch[] };
type SourcePaper = {
  paper: { id: string; title: string; status: string; totalMarks: number; durationMinutes?: number | null };
  sections: Array<{ id: string; title: string; marks: number }>;
  questions: Array<{ id: string; sectionId: string | null; marks: number }>;
};

const EMPTY_DATA: WorkspaceData = { definitions: [], deliveries: [], packets: [], batches: [] };
const STATUS_STYLES: Record<string, string> = {
  draft: "border-(--ws-line) bg-(--ws-fill) text-(--ws-fg-70)",
  review: "border-amber-500/30 bg-amber-500/10 text-(--ws-amber)",
  published: "border-emerald-500/30 bg-emerald-500/10 text-(--ws-emerald)",
  superseded: "border-(--ws-line) bg-(--ws-fill) text-(--ws-fg-50)",
  issued: "border-emerald-500/30 bg-emerald-500/10 text-(--ws-emerald)",
  voided: "border-rose-500/30 bg-rose-500/10 text-(--ws-rose)",
};

function deliveryContextHref(deliveryId: string, focus: AssessWorkflowFocus) {
  const query = new URLSearchParams({ delivery: deliveryId, focus });
  return "/admin/assessments/paper?" + query.toString() + "#" + focus;
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Recently updated"
    : date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function idempotencyKey(prefix: string) {
  return `${prefix}:${crypto.randomUUID()}`;
}

export function AssessmentDeliveryWorkspace() {
  const { confirm } = useConfirmationDialog();
  const [data, setData] = React.useState<WorkspaceData>(EMPTY_DATA);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedDefinition, setSelectedDefinition] = React.useState<Definition | null>(null);
  const [title, setTitle] = React.useState("");
  const [duration, setDuration] = React.useState("");
  const [selectedDeliveryId, setSelectedDeliveryId] = React.useState("");
  const [requestedDeliveryId, setRequestedDeliveryId] = React.useState<string | null>(null);
  const [contextFocus, setContextFocus] = React.useState<AssessWorkflowFocus | null>(null);
  const [packetQuantity, setPacketQuantity] = React.useState("1");
  const [batchLabel, setBatchLabel] = React.useState("");
  const [voidingPacket, setVoidingPacket] = React.useState<string | null>(null);
  const [voidReason, setVoidReason] = React.useState("");
  const [candidates, setCandidates] = React.useState<Candidate[]>([]);
  const [assignments, setAssignments] = React.useState<Assignment[]>([]);
  const [corrections, setCorrections] = React.useState<Correction[]>([]);
  const [candidateSearch, setCandidateSearch] = React.useState("");
  const [selectedPacketId, setSelectedPacketId] = React.useState("");
  const [selectedStudentId, setSelectedStudentId] = React.useState("");
  const [correctionTarget, setCorrectionTarget] = React.useState<Record<string, string>>({});
  const [correctionReason, setCorrectionReason] = React.useState<Record<string, string>>({});
  const [sourcePaper, setSourcePaper] = React.useState<SourcePaper | null>(null);
  const [sourceResultBinding, setSourceResultBinding] = React.useState<"none" | "score_bearing">("none");
  const [publishingDefinition, setPublishingDefinition] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const sourceExamPaperId = new URLSearchParams(window.location.search).get("sourceExamPaperId");
      const [deliveryResponse, packetResponse, sourcePaperResponse] = await Promise.all([
        fetch("/api/admin/assess/deliveries", { cache: "no-store" }),
        fetch("/api/admin/assess/packets", { cache: "no-store" }),
        sourceExamPaperId
          ? fetch(`/api/admin/examinations/${encodeURIComponent(sourceExamPaperId)}`, { cache: "no-store" })
          : Promise.resolve(null),
      ]);
      const deliveryJson = (await deliveryResponse.json().catch(() => null)) as { success?: boolean; data?: { definitions: Definition[]; deliveries: Delivery[] }; error?: string } | null;
      const packetJson = (await packetResponse.json().catch(() => null)) as { success?: boolean; data?: { packets: Packet[]; batches: Batch[] }; error?: string } | null;
      if (!deliveryResponse.ok || !deliveryJson?.success || !deliveryJson.data) throw new Error(deliveryJson?.error ?? "Unable to load paper preparation");
      if (!packetResponse.ok || !packetJson?.success || !packetJson.data) throw new Error(packetJson?.error ?? "Unable to load printable papers");
      setData({ ...deliveryJson.data, ...packetJson.data });
      if (sourcePaperResponse) {
        const sourceJson = (await sourcePaperResponse.json().catch(() => null)) as { success?: boolean; data?: SourcePaper; error?: string } | null;
        setSourcePaper(sourcePaperResponse.ok && sourceJson?.success && sourceJson.data ? sourceJson.data : null);
      } else {
        setSourcePaper(null);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load paper assessment work");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { void load(); }, [load]);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const deliveryId = params.get("delivery");
    const focus = params.get("focus");
    setRequestedDeliveryId(deliveryId);
    setContextFocus(focus && ["paper-delivery", "packets", "assignments", "evidence", "marking", "approved-results"].includes(focus) ? focus as AssessWorkflowFocus : null);
  }, []);

  React.useEffect(() => {
    if (!requestedDeliveryId || loading) return;
    const requested = data.deliveries.find((delivery) => delivery.id === requestedDeliveryId && ["published", "active"].includes(delivery.status));
    if (!requested) {
      setSelectedDeliveryId("");
      setError("That paper version is not available in the selected school.");
      setRequestedDeliveryId(null);
      return;
    }
    setSelectedDeliveryId(requested.id);
    setRequestedDeliveryId(null);
    if (contextFocus) window.requestAnimationFrame(() => document.getElementById(contextFocus)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, [contextFocus, data.deliveries, loading, requestedDeliveryId]);

  React.useEffect(() => {
    if (!selectedDeliveryId || requestedDeliveryId || loading) return;
    const url = new URL(window.location.href);
    url.searchParams.set("delivery", selectedDeliveryId);
    window.history.replaceState({}, "", url);
  }, [loading, requestedDeliveryId, selectedDeliveryId]);

  const loadAssignments = React.useCallback(async () => {
    if (!selectedDeliveryId) {
      setCandidates([]);
      setAssignments([]);
      setCorrections([]);
      return;
    }
    const query = new URLSearchParams({ assessmentDeliveryVersionId: selectedDeliveryId });
    if (candidateSearch.trim()) query.set("search", candidateSearch.trim());
    const response = await fetch(`/api/admin/assess/assignments?${query.toString()}`, { cache: "no-store" });
    const json = (await response.json().catch(() => null)) as { success?: boolean; data?: { candidates: Candidate[]; assignments: Assignment[]; corrections: Correction[] }; error?: string } | null;
    if (!response.ok || !json?.success || !json.data) throw new Error(json?.error ?? "Unable to load eligible students");
    setCandidates(json.data.candidates);
    setAssignments(json.data.assignments);
    setCorrections(json.data.corrections);
  }, [candidateSearch, selectedDeliveryId]);

  React.useEffect(() => { void loadAssignments().catch((cause) => setError(cause instanceof Error ? cause.message : "Unable to load eligible students")); }, [loadAssignments]);

  function beginCreate(definition: Definition) {
    setSelectedDefinition(definition);
    setTitle(`${definition.title} · Paper delivery`);
    setDuration(String(definition.durationMinutes ?? 90));
    setError(null);
  }

  function updateDeliveryContext(deliveryId: string) {
    setSelectedDeliveryId(deliveryId);
    setContextFocus(null);
    const url = new URL(window.location.href);
    if (deliveryId) url.searchParams.set("delivery", deliveryId); else url.searchParams.delete("delivery");
    url.searchParams.delete("focus");
    url.hash = "";
    window.history.replaceState({}, "", url);
  }

  async function createDraft(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedDefinition) return;
    setBusy("create");
    setError(null);
    try {
      const response = await fetch("/api/admin/assess/deliveries", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ assessmentDefinitionVersionId: selectedDefinition.id, title, durationMinutes: Number(duration), resultBinding: selectedDefinition.resultBinding, assessmentPlanId: selectedDefinition.assessmentPlanId, assessmentItemId: selectedDefinition.assessmentItemId }) });
      const json = (await response.json().catch(() => null)) as { success?: boolean; error?: string } | null;
      if (!response.ok || !json?.success) throw new Error(json?.error ?? "Unable to create paper draft");
      setSelectedDefinition(null);
      await load();
      await loadAssignments();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to create paper draft");
    } finally {
      setBusy(null);
    }
  }

  async function assignPacket(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedPacketId || !selectedStudentId) return;
    setBusy("assign");
    setError(null);
    try {
      const response = await fetch("/api/admin/assess/assignments", { method: "POST", headers: { "content-type": "application/json", "x-idempotency-key": idempotencyKey("paper-assignment") }, body: JSON.stringify({ packetId: selectedPacketId, studentId: selectedStudentId }) });
      const json = (await response.json().catch(() => null)) as { success?: boolean; error?: string } | null;
      if (!response.ok || !json?.success) throw new Error(json?.error ?? "Unable to assign paper");
      setSelectedPacketId("");
      setSelectedStudentId("");
      await loadAssignments();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to assign paper");
    } finally {
      setBusy(null);
    }
  }

  async function requestCorrection(assignment: Assignment) {
    const proposedStudentId = correctionTarget[assignment.id];
    const reason = correctionReason[assignment.id]?.trim();
    if (!proposedStudentId || !reason) {
      setError("Select a replacement student and provide a correction reason.");
      return;
    }
    setBusy(`correct:${assignment.id}`);
    setError(null);
    try {
      const response = await fetch(`/api/admin/assess/assignments/${assignment.id}/correction`, { method: "POST", headers: { "content-type": "application/json", "x-idempotency-key": idempotencyKey("paper-correction") }, body: JSON.stringify({ proposedStudentId, reason }) });
      const json = (await response.json().catch(() => null)) as { success?: boolean; error?: string } | null;
      if (!response.ok || !json?.success) throw new Error(json?.error ?? "Unable to request correction");
      setCorrectionTarget((current) => ({ ...current, [assignment.id]: "" }));
      setCorrectionReason((current) => ({ ...current, [assignment.id]: "" }));
      await loadAssignments();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to request correction");
    } finally {
      setBusy(null);
    }
  }

  async function reviewCorrection(correction: Correction, decision: "approve" | "reject") {
    setBusy(`review:${correction.id}`);
    setError(null);
    try {
      const response = await fetch(`/api/admin/assess/corrections/${correction.id}/review`, { method: "POST", headers: { "content-type": "application/json", "x-idempotency-key": idempotencyKey("paper-correction-review") }, body: JSON.stringify({ decision, decisionReason: decision === "approve" ? "Verified by independent school administrator" : "Correction evidence was not sufficient" }) });
      const json = (await response.json().catch(() => null)) as { success?: boolean; error?: string } | null;
      if (!response.ok || !json?.success) throw new Error(json?.error ?? "Unable to review correction");
      await loadAssignments();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to review correction");
    } finally {
      setBusy(null);
    }
  }

  async function transition(delivery: Delivery, action: "review" | "publish") {
    setBusy(`${action}:${delivery.id}`);
    setError(null);
    try {
      const current = data.deliveries.filter((candidate) => candidate.deliveryKey === delivery.deliveryKey && ["published", "active", "emergency_paused"].includes(candidate.status)).sort((left, right) => right.version - left.version)[0];
      const response = await fetch(`/api/admin/assess/deliveries/${delivery.id}/${action}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(action === "publish" ? { expectedCurrentVersionId: current?.id ?? null } : {}) });
      const json = (await response.json().catch(() => null)) as { success?: boolean; error?: string } | null;
      if (!response.ok || !json?.success) throw new Error(json?.error ?? `Unable to ${action} paper`);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : `Unable to ${action} paper`);
    } finally {
      setBusy(null);
    }
  }

  async function generatePackets(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedDeliveryId) return;
    setBusy("generate-packets");
    setError(null);
    try {
      const response = await fetch("/api/admin/assess/packets", { method: "POST", headers: { "content-type": "application/json", "x-idempotency-key": idempotencyKey("paper-packet") }, body: JSON.stringify({ assessmentDeliveryVersionId: selectedDeliveryId, quantity: Number(packetQuantity), batchLabel: batchLabel || null }) });
      const json = (await response.json().catch(() => null)) as { success?: boolean; error?: string } | null;
      if (!response.ok || !json?.success) throw new Error(json?.error ?? "Unable to generate papers");
      setBatchLabel("");
      setPacketQuantity("1");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to generate papers");
    } finally {
      setBusy(null);
    }
  }

  async function voidPacket(packet: Packet) {
    const reason = voidReason.trim();
    if (!reason) {
      setError("Enter a reason before voiding a paper.");
      return;
    }
    setBusy(`void:${packet.packetId}`);
    setError(null);
    try {
      const response = await fetch(`/api/admin/assess/packets/${packet.packetId}/void`, { method: "POST", headers: { "content-type": "application/json", "x-idempotency-key": idempotencyKey("void-paper-packet") }, body: JSON.stringify({ reason }) });
      const json = (await response.json().catch(() => null)) as { success?: boolean; error?: string } | null;
      if (!response.ok || !json?.success) throw new Error(json?.error ?? "Unable to void paper");
      setVoidingPacket(null);
      setVoidReason("");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to void paper");
    } finally {
      setBusy(null);
    }
  }

  async function publishSourceDefinition() {
    if (!sourcePaper) return;
    if (sourceResultBinding === "score_bearing") {
      setError("Score-bearing publication needs an exact existing assessment plan and item binding. The Assess bridge will not infer or create those records.");
      return;
    }
    const decision = await confirm({
      title: "Publish an immutable paper definition?",
      description: "This freezes the reviewed Core examination into a versioned Premium Assess snapshot. Later Core edits will not change this published paper. No delivery or Gradebook handoff will be created yet.",
      confirmLabel: "Publish definition",
      cancelLabel: "Keep editing",
    });
    if (decision !== "confirm") return;
    setPublishingDefinition(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/assess/definitions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ examPaperId: sourcePaper.paper.id, resultBinding: sourceResultBinding, assessmentPlanId: null, assessmentItemId: null }),
      });
      const json = (await response.json().catch(() => null)) as { success?: boolean; error?: string } | null;
      if (!response.ok || !json?.success) throw new Error(json?.error ?? "Unable to publish the immutable paper definition");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to publish the immutable paper definition");
    } finally {
      setPublishingDefinition(false);
    }
  }

  const eligibleDeliveries = data.deliveries.filter((delivery) => ["published", "active"].includes(delivery.status));
  const selectedDelivery = eligibleDeliveries.find((delivery) => delivery.id === selectedDeliveryId) ?? null;
  const activeFocus: AssessWorkflowFocus = contextFocus ?? (selectedDeliveryId ? "packets" : "paper-delivery");
  const selectedStep = PAPER_WORKFLOW_STEPS.find((step) => step.id === activeFocus) ?? PAPER_WORKFLOW_STEPS[0];
  const canOpenStep = (focus: AssessWorkflowFocus) => focus === "paper-delivery" || Boolean(selectedDelivery);
  const sourceQuestionMarks = sourcePaper?.questions.reduce((total, question) => total + question.marks, 0) ?? null;
  const sourceMarksMismatch = sourcePaper ? sourceQuestionMarks !== sourcePaper.paper.totalMarks : false;
  const sourceAlreadyPublished = sourcePaper ? data.definitions.some((definition) => definition.sourceExamPaperId === sourcePaper.paper.id) : false;
  const sourcePublicationPanel = sourcePaper ? (
    <GlassPanel className="border-(--ws-violet)/30 p-5" glow="none">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-(--ws-violet)">Core to Assess bridge</p>
            <Badge variant="outline" className={sourcePaper.paper.status === "completed" || sourcePaper.paper.status === "approved" ? "border-emerald-400/30 bg-emerald-400/10 text-(--ws-emerald)" : "border-amber-400/30 bg-amber-400/10 text-(--ws-amber)"}>
              {sourcePaper.paper.status.replace("_", " ")}
            </Badge>
          </div>
          <h2 className="mt-1 text-xl font-semibold text-(--ws-fg)">{sourcePaper.paper.title}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-(--ws-fg-60)">Core completion is not publication. Review this source paper, choose the reporting mode, and explicitly freeze a Premium Assess definition before creating a delivery.</p>
          {sourceMarksMismatch ? <p role="alert" className="mt-3 rounded-xl border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-sm text-(--ws-rose)">Readiness blocked: the source paper has {sourcePaper.paper.totalMarks} maximum marks but its questions total {sourceQuestionMarks}. Resolve the Core paper before publication.</p> : null}
        </div>
        <div className="w-full max-w-sm space-y-3">
          <label className="block text-sm text-(--ws-fg-70)">
            <span className="mb-1.5 block text-xs font-medium">Result mode</span>
            <PremiumSelect value={sourceResultBinding} onValueChange={(value) => setSourceResultBinding(value as "none" | "score_bearing")}>
              <PremiumSelectTrigger><PremiumSelectValue /></PremiumSelectTrigger>
              <PremiumSelectContent>
                <PremiumSelectItem value="none" description="Assessment stays outside canonical Gradebook results.">Non-reporting</PremiumSelectItem>
                <PremiumSelectItem value="score_bearing" description="Requires an exact existing plan and item binding.">Score-bearing</PremiumSelectItem>
              </PremiumSelectContent>
            </PremiumSelect>
          </label>
          {sourceResultBinding === "score_bearing" ? <p className="text-xs leading-5 text-(--ws-fg-50)">Score-bearing publication is intentionally unavailable from this bridge until the matching existing plan and item can be selected and validated. Nothing is inferred.</p> : <p className="text-xs leading-5 text-(--ws-fg-50)">The current bridge supports an attachment-free, non-reporting snapshot. It does not alter Core marks or publish automatically.</p>}
          <Button type="button" className={glassPrimaryButtonClass + " w-full"} onClick={() => void publishSourceDefinition()} disabled={publishingDefinition || sourceAlreadyPublished || sourceMarksMismatch || sourcePaper.paper.status === "draft" || sourcePaper.paper.status === "submitted" || sourceResultBinding === "score_bearing"}>
            {publishingDefinition ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <ShieldCheck className="mr-2 h-4 w-4" aria-hidden="true" />}
            {sourceAlreadyPublished ? "Definition already published" : "Publish immutable definition"}
          </Button>
        </div>
      </div>
    </GlassPanel>
  ) : null;

  return (
    <WorkspacePageShell>
      <WorkspacePageHeader title="Paper exams" subtitle="Prepare, print and complete a paper examination one step at a time." icon={FileCheck2} actions={<Button type="button" variant="outline" className={glassSecondaryButtonClass} onClick={() => void load()} disabled={loading}><RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" /> Refresh</Button>} />
      <AssessWorkspaceNav deliveryId={selectedDeliveryId || null} />
      {activeFocus === "paper-delivery" ? sourcePublicationPanel : null}
      {selectedDelivery ? <GlassPanel className="p-4" glow="none"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-(--ws-fg-50)">Selected examination</p><Badge variant="outline" className={STATUS_STYLES[selectedDelivery.status] ?? STATUS_STYLES.draft}>{selectedDelivery.status}</Badge></div><h2 className="mt-1 truncate text-xl font-semibold text-(--ws-fg)">{selectedDelivery.title}</h2><p className="mt-1 text-sm text-(--ws-fg-60)">Paper version {selectedDelivery.version} · {selectedDelivery.timing.durationMinutes} minutes · {selectedDelivery.resultBinding === "score_bearing" ? "marks can be sent to the Gradebook" : "does not report to the Gradebook"}</p></div><label className="min-w-60 text-xs font-medium text-(--ws-fg-70)">Change examination<PremiumSelect value={selectedDeliveryId} onValueChange={updateDeliveryContext}><PremiumSelectTrigger className="mt-1"><PremiumSelectValue /></PremiumSelectTrigger><PremiumSelectContent>{eligibleDeliveries.map((delivery) => <PremiumSelectItem key={delivery.id} value={delivery.id}>{delivery.title} · v{delivery.version}</PremiumSelectItem>)}</PremiumSelectContent></PremiumSelect></label></div></GlassPanel> : null}
      <section aria-labelledby="paper-journey-heading" className="rounded-2xl border border-(--ws-line) bg-(--ws-fill) p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-(--ws-violet)">Paper assessment journey</p><h2 id="paper-journey-heading" className="mt-1 text-lg font-semibold text-(--ws-fg)">{selectedStep.label}</h2><p className="mt-1 text-sm text-(--ws-fg-60)">{selectedStep.description}</p></div><span className="text-xs text-(--ws-fg-50)">{selectedDelivery ? `Selected: ${selectedDelivery.title}` : "Choose an examination first"}</span></div><ol className="mt-4 grid gap-2 sm:grid-cols-3 xl:grid-cols-6" aria-label="Paper assessment steps">{PAPER_WORKFLOW_STEPS.map((step, index) => { const available = canOpenStep(step.id); const current = step.id === activeFocus; const content = <><span className={"inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold " + (current ? "bg-violet-600 text-white" : available ? "bg-(--ws-fill-strong) text-(--ws-violet)" : "bg-(--ws-fill) text-(--ws-fg-40)")}>{index + 1}</span><span className="min-w-0"><span className="block text-xs font-medium">{step.shortLabel}</span><span className="mt-0.5 block text-[11px] text-(--ws-fg-50)">{available ? current ? "Current step" : "Open" : "Needs paper"}</span></span></>; return <li key={step.id}>{available ? <Link href={selectedDelivery ? deliveryContextHref(selectedDelivery.id, step.id) : "/admin/assessments/paper?focus=" + step.id + "#" + step.id} aria-current={current ? "step" : undefined} className={"flex min-h-14 items-center gap-2 rounded-xl border px-3 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ws-cyan) " + (current ? "border-(--ws-violet)/40 bg-(--ws-fill-strong) text-(--ws-violet)" : "border-(--ws-line) bg-(--ws-fill) text-(--ws-fg-70) hover:border-(--ws-line-strong) hover:bg-(--ws-fill-strong)")}>{content}</Link> : <span aria-disabled="true" title="Choose and publish a paper version first" className="flex min-h-14 items-center gap-2 rounded-xl border border-(--ws-line) bg-(--ws-fill) px-3 py-2 text-left text-(--ws-fg-40)">{content}</span>}</li>; })}</ol></section>
      {error ? <div role="alert" aria-live="polite" className="rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-(--ws-rose)">{error}</div> : null}
      {!selectedDelivery && activeFocus !== "paper-delivery" ? <GlassPanel className="p-6" glow="none"><div className="max-w-2xl"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-(--ws-violet)">Choose an examination first</p><h2 className="mt-1 text-xl font-semibold text-(--ws-fg)">This step is ready after you publish a paper</h2><p className="mt-2 text-sm leading-6 text-(--ws-fg-60)">Go back to Prepare paper, choose an eligible examination and publish its paper version. The later steps will then use that selected delivery.</p><Button asChild className={glassPrimaryButtonClass}><Link href="/admin/assessments/paper?focus=paper-delivery#paper-delivery">Prepare a paper<Send className="ml-2 h-4 w-4" aria-hidden="true" /></Link></Button></div></GlassPanel> : null}

      {activeFocus === "paper-delivery" ? <>
        <div id="paper-delivery" className="grid scroll-mt-6 gap-5 xl:grid-cols-[1.1fr_0.9fr]"><GlassPanel className="p-5"><div className="mb-4 flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-(--ws-violet)">Step 1</p><h2 className="mt-1 text-xl font-semibold text-(--ws-fg)">Choose an examination</h2><p className="mt-1 text-sm text-(--ws-fg-60)">Start from an examination whose questions have already been reviewed and published in Core.</p></div><GraduationCap className="h-5 w-5 text-(--ws-violet)" aria-hidden="true" /></div>{loading ? <div className="flex items-center gap-2 text-sm text-(--ws-fg-60)" role="status"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading examinations…</div> : null}{!loading && data.definitions.length === 0 ? <div className={glassInsetClass + " p-4 text-sm text-(--ws-fg-60)"}><p className="font-medium text-(--ws-fg)">No published examinations are ready yet.</p><p className="mt-1">Create the examination in Core, add and review its questions, then return here to prepare papers.</p><Button asChild className={glassPrimaryButtonClass + " mt-4"}><Link href="/admin/examinations">Create examination<Send className="ml-2 h-4 w-4" aria-hidden="true" /></Link></Button></div> : null}<div className="space-y-3">{data.definitions.map((definition) => <div key={definition.id} className={glassInsetClass + " flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"}><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-medium text-(--ws-fg)">{definition.title}</h3><Badge variant="outline" className="border-emerald-400/30 bg-emerald-400/10 text-(--ws-emerald)">Published v{definition.version}</Badge></div><p className="mt-1 text-xs text-(--ws-fg-60)">{definition.resultBinding === "score_bearing" ? "Marks can be sent to the Gradebook after independent review" : "This paper will not report to the Gradebook"}</p></div><Button type="button" size="sm" className={glassPrimaryButtonClass} onClick={() => beginCreate(definition)}><Plus className="mr-2 h-4 w-4" aria-hidden="true" /> Prepare paper</Button></div>)}</div></GlassPanel><GlassPanel className="p-5"><div className="mb-4 flex items-start gap-3"><LockKeyhole className="h-5 w-5 text-(--ws-violet)" aria-hidden="true" /><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-(--ws-violet)">Step 2</p><h2 className="mt-1 text-xl font-semibold text-(--ws-fg)">Prepare and review the paper</h2><p className="mt-1 text-sm text-(--ws-fg-60)">Set delivery details, submit the paper for review, then publish it before printing.</p></div></div>{selectedDefinition ? <form className="space-y-4" onSubmit={createDraft}><div className={glassInsetClass + " p-3 text-sm text-(--ws-fg-70)"}>Examination: <span className="font-medium text-(--ws-fg)">{selectedDefinition.title}</span><span className="mt-1 block text-xs text-(--ws-fg-50)">Paper delivery only · the source examination remains unchanged</span></div><label className="block text-sm text-(--ws-fg-70)">Paper title<Input className="mt-2" value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={220} /></label><label className="block text-sm text-(--ws-fg-70)">Time allowed in minutes<Input className="mt-2" type="number" min={1} max={720} value={duration} onChange={(event) => setDuration(event.target.value)} required /></label><p className="text-xs leading-5 text-(--ws-fg-50)">After creating the draft, use the paper history below to submit it for review and publish it. Only published papers can be printed.</p><div className="flex flex-wrap gap-2"><Button type="submit" className={glassPrimaryButtonClass} disabled={busy === "create"}>{busy === "create" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <Plus className="mr-2 h-4 w-4" aria-hidden="true" />} Create paper draft</Button><Button type="button" variant="outline" className={glassSecondaryButtonClass} onClick={() => setSelectedDefinition(null)}>Cancel</Button></div></form> : <div className={glassInsetClass + " p-4 text-sm text-(--ws-fg-60)"}>Choose an examination on the left to prepare its paper version.</div>}</GlassPanel></div>
        <GlassPanel className="p-5"><div className="mb-4 flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-(--ws-fg-50)">Paper history</p><h2 className="mt-1 text-xl font-semibold text-(--ws-fg)">Review and publish</h2><p className="mt-1 text-sm text-(--ws-fg-60)">Draft and published versions stay separate so a printed paper never changes underneath you.</p></div><Send className="h-5 w-5 text-(--ws-cyan)" aria-hidden="true" /></div>{data.deliveries.length === 0 ? <div className={glassInsetClass + " p-4 text-sm text-(--ws-fg-60)"}>No paper versions have been prepared yet.</div> : <div className="space-y-3">{data.deliveries.map((delivery) => <div key={delivery.id} className={glassInsetClass + " flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between"}><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-medium text-(--ws-fg)">{delivery.title}</h3><Badge variant="outline" className={STATUS_STYLES[delivery.status] ?? STATUS_STYLES.draft}>{delivery.status}</Badge><span className="text-xs text-(--ws-fg-50)">version {delivery.version}</span></div><p className="mt-1 text-xs text-(--ws-fg-50)">{delivery.timing.durationMinutes} minutes · updated {formatDate(delivery.updatedAt)}</p></div><div className="flex flex-wrap gap-2">{["published", "active"].includes(delivery.status) ? <><Button asChild type="button" size="sm" variant="outline" className={glassSecondaryButtonClass}><Link href={deliveryContextHref(delivery.id, "packets")}><PackageCheck className="mr-2 h-3.5 w-3.5" aria-hidden="true" /> Print papers</Link></Button><Button asChild type="button" size="sm" variant="outline" className={glassSecondaryButtonClass}><Link href={`/api/admin/assess/deliveries/${delivery.id}/preview`} target="_blank"><Eye className="mr-2 h-3.5 w-3.5" aria-hidden="true" /> Review paper</Link></Button></> : null}{delivery.status === "draft" ? <Button type="button" size="sm" variant="outline" className={glassSecondaryButtonClass} onClick={() => void transition(delivery, "review")} disabled={busy === `review:${delivery.id}`}><Send className="mr-2 h-3.5 w-3.5" aria-hidden="true" /> Submit for review</Button> : null}{delivery.status === "review" ? <Button type="button" size="sm" className={glassPrimaryButtonClass} onClick={() => void transition(delivery, "publish")} disabled={busy === `publish:${delivery.id}`}>{busy === `publish:${delivery.id}` ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <ShieldCheck className="mr-2 h-3.5 w-3.5" aria-hidden="true" />} Publish paper</Button> : null}</div></div>)}</div>}</GlassPanel>
      </> : null}

      {activeFocus === "packets" && selectedDelivery ? <section id="packets" className="scroll-mt-6"><GlassPanel className="p-5"><div className="mb-5 flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-(--ws-violet)">Step 3</p><h2 className="mt-1 text-xl font-semibold text-(--ws-fg)">Print secure papers</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-(--ws-fg-60)">Generate candidate-safe papers for <span className="font-medium text-(--ws-fg)">{selectedDelivery.title}</span>. Papers are issued without candidate identity; QR and fallback markers only point to server records.</p></div><PackageCheck className="h-5 w-5 text-(--ws-violet)" aria-hidden="true" /></div><form className="grid gap-4 rounded-xl border border-(--ws-line) bg-(--ws-fill) p-4 lg:grid-cols-[1fr_130px_1fr_auto] lg:items-end" onSubmit={generatePackets}><label className="block text-sm text-(--ws-fg-70)">Paper version<PremiumSelect value={selectedDeliveryId} onValueChange={updateDeliveryContext}><PremiumSelectTrigger className="mt-2 bg-(--ws-fill)"><PremiumSelectValue /></PremiumSelectTrigger><PremiumSelectContent>{eligibleDeliveries.map((delivery) => <PremiumSelectItem key={delivery.id} value={delivery.id}>{delivery.title} · v{delivery.version}</PremiumSelectItem>)}</PremiumSelectContent></PremiumSelect></label><label className="block text-sm text-(--ws-fg-70)">Quantity<Input className="mt-2 bg-(--ws-fill)" type="number" min={1} max={100} value={packetQuantity} onChange={(event) => setPacketQuantity(event.target.value)} required /></label><label className="block text-sm text-(--ws-fg-70)">Batch label (optional)<Input className="mt-2 bg-(--ws-fill)" value={batchLabel} onChange={(event) => setBatchLabel(event.target.value)} maxLength={160} placeholder="Mid-term papers" /></label><Button type="submit" className={glassPrimaryButtonClass} disabled={!selectedDeliveryId || busy === "generate-packets"}>{busy === "generate-packets" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <PackageCheck className="mr-2 h-4 w-4" aria-hidden="true" />} Generate papers</Button></form><p className="mt-3 text-xs text-(--ws-fg-50)">The server preflights the candidate-safe PDF before issuing it. Reprint keeps the same paper identity.</p><div className="mt-5 space-y-3">{data.packets.length === 0 ? <div className={glassInsetClass + " p-4 text-sm text-(--ws-fg-60)"}><p className="font-medium text-(--ws-fg)">No papers have been generated for this school yet.</p><p className="mt-1">Set a quantity above to create the first printable batch.</p></div> : data.packets.map((packet) => <div key={packet.packetId} className={glassInsetClass + " flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between"}><div><div className="flex flex-wrap items-center gap-2"><span className="font-medium text-(--ws-fg)">{packet.packetId}</span><Badge variant="outline" className={STATUS_STYLES[packet.status]}>{packet.status}</Badge><span className="text-xs text-(--ws-fg-50)">Batch {packet.batchId} · {packet.batchSequence}/{packet.batchQuantity}</span></div><p className="mt-1 text-xs text-(--ws-fg-50)">{packet.pageManifest.length} pages · fallback {packet.fallbackCode} · issued {formatDate(packet.issuedAt)}</p>{packet.voidReason ? <p className="mt-1 text-xs text-(--ws-rose)">Void reason: {packet.voidReason}</p> : null}</div><div className="flex flex-wrap gap-2">{packet.status === "issued" ? <><Button asChild type="button" size="sm" variant="outline" className={glassSecondaryButtonClass}><Link href={`/api/admin/assess/packets/${packet.packetId}/pdf?mode=download`}><Download className="mr-2 h-3.5 w-3.5" aria-hidden="true" /> Download PDF</Link></Button><Button asChild type="button" size="sm" variant="outline" className={glassSecondaryButtonClass}><Link href={`/api/admin/assess/packets/${packet.packetId}/pdf?mode=reprint`}><Printer className="mr-2 h-3.5 w-3.5" aria-hidden="true" /> Reprint</Link></Button><Button type="button" size="sm" variant="outline" className="border-rose-400/30 text-(--ws-rose) hover:bg-rose-400/10" onClick={() => { setVoidingPacket(packet.packetId); setVoidReason(""); }}><Ban className="mr-2 h-3.5 w-3.5" aria-hidden="true" /> Void paper</Button></> : null}</div>{voidingPacket === packet.packetId ? <div className="flex flex-col gap-2 lg:col-span-2 lg:flex-row"><label className="sr-only" htmlFor={`void-reason-${packet.packetId}`}>Reason for voiding {packet.packetId}</label><Input id={`void-reason-${packet.packetId}`} value={voidReason} onChange={(event) => setVoidReason(event.target.value)} placeholder="Reason for voiding" maxLength={1000} /><Button type="button" size="sm" className="bg-rose-600 text-white hover:bg-rose-500" onClick={() => void voidPacket(packet)} disabled={busy === `void:${packet.packetId}`}>Confirm void</Button><Button type="button" size="sm" variant="outline" className={glassSecondaryButtonClass} onClick={() => setVoidingPacket(null)}>Cancel</Button></div> : null}</div>)}</div></GlassPanel></section> : null}

      {activeFocus === "assignments" && selectedDelivery ? <section id="assignments" className="scroll-mt-6"><GlassPanel className="p-5"><div className="mb-5 flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-(--ws-violet)">Step 4</p><h2 className="mt-1 text-xl font-semibold text-(--ws-fg)">Assign papers to students</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-(--ws-fg-60)">Only active students matching this paper’s school, grade, class and enrollment rules are available.</p></div><UserRound className="h-5 w-5 text-(--ws-violet)" aria-hidden="true" /></div><form className="grid gap-4 rounded-xl border border-(--ws-line) bg-(--ws-fill) p-4 lg:grid-cols-[1fr_1fr_auto] lg:items-end" onSubmit={assignPacket}><label className="block text-sm text-(--ws-fg-70)">Issued paper<PremiumSelect value={selectedPacketId} onValueChange={setSelectedPacketId}><PremiumSelectTrigger className="mt-2 bg-(--ws-fill)"><PremiumSelectValue placeholder="Select a paper" /></PremiumSelectTrigger><PremiumSelectContent>{data.packets.filter((packet) => packet.status === "issued" && !assignments.some((assignment) => assignment.packetId === packet.id && assignment.status === "active")).map((packet) => <PremiumSelectItem key={packet.id} value={packet.id}>{packet.packetId} · {packet.fallbackCode}</PremiumSelectItem>)}</PremiumSelectContent></PremiumSelect></label><label className="block text-sm text-(--ws-fg-70)">Eligible student<PremiumSelect value={selectedStudentId} onValueChange={setSelectedStudentId}><PremiumSelectTrigger className="mt-2 bg-(--ws-fill)"><PremiumSelectValue placeholder="Select a student" /></PremiumSelectTrigger><PremiumSelectContent>{candidates.map((candidate) => <PremiumSelectItem key={candidate.id} value={candidate.id}>{candidate.lastName}, {candidate.firstName}{candidate.admissionNo ? ` · ${candidate.admissionNo}` : ""}</PremiumSelectItem>)}</PremiumSelectContent></PremiumSelect></label><Button type="submit" className={glassPrimaryButtonClass} disabled={!selectedPacketId || !selectedStudentId || busy === "assign"}>{busy === "assign" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <UserRound className="mr-2 h-4 w-4" aria-hidden="true" />} Assign paper</Button></form><div className="mt-4 flex gap-2"><label className="sr-only" htmlFor="candidate-search">Search eligible students</label><Input id="candidate-search" value={candidateSearch} onChange={(event) => setCandidateSearch(event.target.value)} placeholder="Search eligible students by name or admission number" /><Button type="button" variant="outline" className={glassSecondaryButtonClass} onClick={() => void loadAssignments()}><Search className="mr-2 h-4 w-4" aria-hidden="true" /> Search</Button></div><div className="mt-4 space-y-3">{assignments.filter((assignment) => assignment.status === "active").map((assignment) => { const student = candidates.find((candidate) => candidate.id === assignment.studentId); return <div key={assignment.id} className={glassInsetClass + " p-4"}><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-medium text-(--ws-fg)">{student ? `${student.lastName}, ${student.firstName}` : `Student ${assignment.studentId}`}</p><p className="text-xs text-(--ws-fg-50)">Paper {data.packets.find((packet) => packet.id === assignment.packetId)?.packetId ?? assignment.packetId} · assigned {formatDate(assignment.assignedAt)}</p></div><Badge variant="outline" className="border-emerald-400/30 bg-emerald-400/10 text-(--ws-emerald)">Assigned</Badge></div><div className="mt-3 grid gap-2 md:grid-cols-[1fr_1fr_auto]"><label className="sr-only" htmlFor={`correction-student-${assignment.id}`}>Replacement student</label><PremiumSelect value={correctionTarget[assignment.id] ?? ""} onValueChange={(value) => setCorrectionTarget((current) => ({ ...current, [assignment.id]: value }))}><PremiumSelectTrigger id={`correction-student-${assignment.id}`}><PremiumSelectValue placeholder="Replacement student" /></PremiumSelectTrigger><PremiumSelectContent>{candidates.filter((candidate) => candidate.id !== assignment.studentId).map((candidate) => <PremiumSelectItem key={candidate.id} value={candidate.id}>{candidate.lastName}, {candidate.firstName}</PremiumSelectItem>)}</PremiumSelectContent></PremiumSelect><label className="sr-only" htmlFor={`correction-reason-${assignment.id}`}>Correction reason</label><Input id={`correction-reason-${assignment.id}`} value={correctionReason[assignment.id] ?? ""} onChange={(event) => setCorrectionReason((current) => ({ ...current, [assignment.id]: event.target.value }))} placeholder="Correction reason" maxLength={2000} /><Button type="button" variant="outline" className={glassSecondaryButtonClass} onClick={() => void requestCorrection(assignment)} disabled={busy === `correct:${assignment.id}`}><AlertTriangle className="mr-2 h-4 w-4" aria-hidden="true" /> Request correction</Button></div></div>; })}</div><div className="mt-5 space-y-3">{corrections.filter((correction) => correction.status === "pending").map((correction) => <div key={correction.id} className={glassInsetClass + " flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between"}><div><p className="font-medium text-(--ws-fg)">Correction request for paper {correction.packetId}</p><p className="text-xs text-(--ws-fg-50)">Requested {formatDate(correction.requestedAt)} · {correction.reason}</p></div><div className="flex gap-2"><Button type="button" size="sm" className={glassPrimaryButtonClass} onClick={() => void reviewCorrection(correction, "approve")} disabled={busy === `review:${correction.id}`}>Approve</Button><Button type="button" size="sm" variant="outline" className={glassSecondaryButtonClass} onClick={() => void reviewCorrection(correction, "reject")} disabled={busy === `review:${correction.id}`}>Reject</Button></div></div>)}</div><p className="mt-4 text-xs leading-5 text-(--ws-fg-50)">A separate authorized school administrator must review corrections. Rejected requests preserve the original assignment; approved corrections retain prior identity history.</p></GlassPanel></section> : null}

      {activeFocus === "evidence" && selectedDelivery ? <section id="evidence" className="scroll-mt-6" aria-label="Review scanned scripts"><AssessmentEvidenceReconciliationPanel deliveryId={selectedDeliveryId} /></section> : null}
      {activeFocus === "marking" && selectedDelivery ? <section id="marking" className="scroll-mt-6" aria-label="Mark and review scripts"><AssessmentMarkingAssignmentPanel deliveryId={selectedDeliveryId} focus="marking" /></section> : null}
      {activeFocus === "approved-results" && selectedDelivery ? <section id="approved-results" className="scroll-mt-6" aria-label="Send approved marks"><AssessmentMarkingAssignmentPanel deliveryId={selectedDeliveryId} focus="approved-results" /></section> : null}
    </WorkspacePageShell>
  );
}
