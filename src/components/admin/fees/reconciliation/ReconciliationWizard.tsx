"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileSpreadsheet,
  Lock,
  Play,
  RefreshCw,
  Search,
  Shield,
  Sparkles,
  StickyNote,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useDailyReconciliation } from "@/hooks/admin/useDailyReconciliation";
import {
  useReconciliationIngestions,
  useMatchReconciliationItem,
  useUnmatchReconciliationItem,
  useReconciliationAlerts,
  type ReconciliationSourceType,
  type ReconciliationStatus,
} from "@/hooks/admin/useReconciliation";
import {
  useUpdateReconciliationSession,
  useLockReconciliationSession,
  useAIReconciliationSuggestions,
  useGenerateReconciliationReport,
  type ReconciliationSessionItem,
  type AISuggestion,
  type ReconciliationReport,
} from "@/hooks/admin/useReconciliationSessions";
import { ReconciliationIngestionModal } from "./ReconciliationIngestionModal";
import { formatCurrency } from "@/lib/fees/money";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type WizardStep = "prepare" | "import" | "match" | "review" | "resolve" | "finalize";

const WIZARD_STEPS: { id: WizardStep; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "prepare", label: "Prepare", icon: ClipboardList },
  { id: "import", label: "Import", icon: FileSpreadsheet },
  { id: "match", label: "Auto-Match", icon: Play },
  { id: "review", label: "Review", icon: Search },
  { id: "resolve", label: "Resolve", icon: Sparkles },
  { id: "finalize", label: "Finalize", icon: Lock },
];

type ReconciliationWizardProps = {
  session: ReconciliationSessionItem;
  onComplete?: () => void;
  onCancel?: () => void;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatShortDate(value: string | Date | null | undefined) {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GH", { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date);
}

const SOURCE_LABELS: Record<string, string> = {
  gateway: "Paystack / Gateway export",
  bank: "Bank statement / MoMo statement",
  manual: "Manual receipts / cash records",
};

function statusBadgeClass(status: ReconciliationStatus) {
  if (status === "matched") return "border-emerald-500/25 bg-emerald-500/10 text-emerald-300";
  if (status === "ambiguous") return "border-amber-500/25 bg-amber-500/10 text-amber-300";
  if (status === "ignored") return "border-white/10 bg-white/5 text-white/50";
  return "border-rose-500/25 bg-rose-500/10 text-rose-300";
}

// ---------------------------------------------------------------------------
// Wizard Component
// ---------------------------------------------------------------------------

export function ReconciliationWizard({ session, onComplete, onCancel }: ReconciliationWizardProps) {
  const stepIds = WIZARD_STEPS.map((s) => s.id);
  const initialStep = (stepIds.includes(session.currentStep as WizardStep) ? session.currentStep : "prepare") as WizardStep;

  const [currentStep, setCurrentStep] = React.useState<WizardStep>(initialStep);
  const [completedSteps, setCompletedSteps] = React.useState<Set<WizardStep>>(() => {
    const set = new Set<WizardStep>();
    const idx = stepIds.indexOf(initialStep);
    for (let i = 0; i < idx; i++) set.add(stepIds[i]);
    return set;
  });

  const [prepareNotes, setPrepareNotes] = React.useState(session.prepareNotes || "");
  const [importNotes, setImportNotes] = React.useState(session.importNotes || "");
  const [reviewNotes, setReviewNotes] = React.useState(session.reviewNotes || "");
  const [finalizeNotes, setFinalizeNotes] = React.useState(session.finalizeNotes || "");
  const [lockReason, setLockReason] = React.useState("");
  const [ingestionModalOpen, setIngestionModalOpen] = React.useState(false);
  const [aiSuggestions, setAiSuggestions] = React.useState<AISuggestion[]>([]);
  const [generatedReport, setGeneratedReport] = React.useState<ReconciliationReport | null>(null);
  const [verificationId, setVerificationId] = React.useState<string | null>(session.reportVerificationId || null);
  const [queuePage, setQueuePage] = React.useState(1);

  const updateSession = useUpdateReconciliationSession();
  const lockSession = useLockReconciliationSession();
  const runReconciliation = useDailyReconciliation();
  const ingestionQuery = useReconciliationIngestions({ page: queuePage, limit: 25 });
  const alertsQuery = useReconciliationAlerts(true, true);
  const matchItem = useMatchReconciliationItem();
  const unmatchItem = useUnmatchReconciliationItem();
  const aiSuggest = useAIReconciliationSuggestions();
  const generateReport = useGenerateReconciliationReport();

  const currentStepIndex = stepIds.indexOf(currentStep);
  const isLocked = session.status === "locked";

  const summary = ingestionQuery.data?.summary || { unmatched: 0, matched: 0, ambiguous: 0, ignored: 0 };
  const items = ingestionQuery.data?.items || [];
  const queuePagination = ingestionQuery.data?.pagination;
  const totalIngested = summary.unmatched + summary.matched + summary.ambiguous + summary.ignored;
  const matchRate = totalIngested > 0 ? Math.round((summary.matched / totalIngested) * 100) : 0;

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------

  const goToStep = (step: WizardStep) => setCurrentStep(step);

  const goNext = async () => {
    setCompletedSteps((prev) => new Set(prev).add(currentStep));
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < stepIds.length) {
      const nextStep = stepIds[nextIndex];
      setCurrentStep(nextStep);
      try {
        await updateSession.mutateAsync({
          id: session.id,
          currentStep: nextStep,
          status: nextStep === "finalize" ? "review" : nextStep === "prepare" ? "preparing" : "in_progress",
          prepareNotes: prepareNotes || null,
          importNotes: importNotes || null,
          reviewNotes: reviewNotes || null,
          timelineEvent: { action: `step_${nextStep}`, notes: null },
        });
      } catch {
        // non-critical
      }
    }
  };

  const goBack = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) setCurrentStep(stepIds[prevIndex]);
  };

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  async function handleRunAutoMatch() {
    try {
      const result = await runReconciliation.mutateAsync({ mode: "manual", notes: `Session: ${session.label}` });
      toast.success(`Auto-match complete — ${result.updated} updated, ${result.summary?.matched || 0} matched.`);
      await updateSession.mutateAsync({
        id: session.id,
        runId: result.runId,
        summary: {
          totalIngested: totalIngested,
          matched: result.summary?.matched || 0,
          ambiguous: result.summary?.ambiguous || 0,
          paymentStatusUpdated: result.updated,
        },
        timelineEvent: { action: "auto_match_run", metadata: { runId: result.runId, matched: result.summary?.matched || 0 } },
      });
      void ingestionQuery.refetch();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Auto-match failed.");
    }
  }

  async function handleAISuggestions() {
    const ambiguousIds = items.filter((i) => i.status === "ambiguous").map((i) => i.id);
    if (ambiguousIds.length === 0 && (summary.ambiguous || 0) === 0) {
      toast.info("No ambiguous items to analyze.");
      return;
    }
    try {
      const result = await aiSuggest.mutateAsync({
        sessionId: session.id,
        ingestionIds: ambiguousIds.length > 0 ? ambiguousIds.slice(0, 10) : [],
      });
      setAiSuggestions(result.suggestions);
      toast.success(`AI analyzed ${result.suggestions.length} item(s).`);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "AI analysis failed.");
    }
  }

  async function handleAcceptSuggestion(suggestion: AISuggestion) {
    if (!suggestion.recommendedPaymentId) return;
    try {
      await matchItem.mutateAsync({ ingestionId: suggestion.ingestionId, paymentId: suggestion.recommendedPaymentId });
      setAiSuggestions((prev) => prev.filter((s) => s.ingestionId !== suggestion.ingestionId));
      await updateSession.mutateAsync({
        id: session.id,
        summary: { aiSuggestionsAccepted: (session.summary.aiSuggestionsAccepted || 0) + 1 },
        timelineEvent: { action: "ai_suggestion_accepted", metadata: { ingestionId: suggestion.ingestionId, paymentId: suggestion.recommendedPaymentId } },
      });
      toast.success("AI suggestion accepted.");
      void ingestionQuery.refetch();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to apply suggestion.");
    }
  }

  async function handleRejectSuggestion(suggestion: AISuggestion) {
    setAiSuggestions((prev) => prev.filter((s) => s.ingestionId !== suggestion.ingestionId));
    await updateSession.mutateAsync({
      id: session.id,
      summary: { aiSuggestionsRejected: (session.summary.aiSuggestionsRejected || 0) + 1 },
      timelineEvent: { action: "ai_suggestion_rejected", metadata: { ingestionId: suggestion.ingestionId } },
    }).catch(() => {});
  }

  async function handleGenerateReport() {
    try {
      const result = await generateReport.mutateAsync({ sessionId: session.id, notes: finalizeNotes || undefined });
      setGeneratedReport(result.report);
      setVerificationId(result.verificationId);
      toast.success("Reconciliation report generated.");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Report generation failed.");
    }
  }

  async function handleLock() {
    if (!lockReason.trim()) {
      toast.error("Please provide a reason for locking this session.");
      return;
    }
    try {
      await lockSession.mutateAsync({ id: session.id, reason: lockReason, notes: finalizeNotes || undefined });
      toast.success("Session locked successfully.");
      onComplete?.();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to lock session.");
    }
  }

  async function handleManualMatch(ingestionId: string, paymentId: string) {
    try {
      await matchItem.mutateAsync({ ingestionId, paymentId });
      await updateSession.mutateAsync({
        id: session.id,
        summary: { manualMatches: (session.summary.manualMatches || 0) + 1 },
        timelineEvent: { action: "manual_match", metadata: { ingestionId, paymentId } },
      });
      toast.success("Matched.");
      void ingestionQuery.refetch();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Match failed.");
    }
  }

  async function handleUnmatch(ingestionId: string) {
    try {
      await unmatchItem.mutateAsync({ ingestionId });
      toast.success("Match removed.");
      void ingestionQuery.refetch();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Unmatch failed.");
    }
  }

  // ---------------------------------------------------------------------------
  // Step content
  // ---------------------------------------------------------------------------

  const renderStepContent = () => {
    switch (currentStep) {
      case "prepare":
        return <PrepareStep session={session} notes={prepareNotes} onNotesChange={setPrepareNotes} />;
      case "import":
        return (
          <ImportStep
            notes={importNotes}
            onNotesChange={setImportNotes}
            onOpenIngestion={() => setIngestionModalOpen(true)}
            summary={summary}
            totalIngested={totalIngested}
            isLoading={ingestionQuery.isLoading}
          />
        );
      case "match":
        return (
          <MatchStep
            summary={summary}
            matchRate={matchRate}
            totalIngested={totalIngested}
            isRunning={runReconciliation.isPending}
            onRun={handleRunAutoMatch}
          />
        );
      case "review":
        return (
          <ReviewStep
            items={items}
            summary={summary}
            matchRate={matchRate}
            totalIngested={totalIngested}
            notes={reviewNotes}
            onNotesChange={setReviewNotes}
            alerts={alertsQuery.data?.active || []}
            onRefresh={() => { void ingestionQuery.refetch(); void alertsQuery.refetch(); }}
            isLoading={ingestionQuery.isLoading}
            pagination={queuePagination}
            onPageChange={setQueuePage}
          />
        );
      case "resolve":
        return (
          <ResolveStep
            items={items}
            summary={summary}
            aiSuggestions={aiSuggestions}
            isLoadingAI={aiSuggest.isPending}
            onRequestAI={handleAISuggestions}
            onAccept={handleAcceptSuggestion}
            onReject={handleRejectSuggestion}
            onManualMatch={handleManualMatch}
            onUnmatch={handleUnmatch}
            isMatching={matchItem.isPending}
            pagination={queuePagination}
            onPageChange={setQueuePage}
          />
        );
      case "finalize":
        return (
          <FinalizeStep
            session={session}
            summary={summary}
            matchRate={matchRate}
            totalIngested={totalIngested}
            notes={finalizeNotes}
            onNotesChange={setFinalizeNotes}
            lockReason={lockReason}
            onLockReasonChange={setLockReason}
            onLock={handleLock}
            isLocking={lockSession.isPending}
            isLocked={isLocked}
            generatedReport={generatedReport}
            verificationId={verificationId}
            onGenerateReport={handleGenerateReport}
            isGeneratingReport={generateReport.isPending}
          />
        );
      default:
        return null;
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Step indicator — matches LessonNoteWizard */}
      <div className="flex items-center justify-center gap-2">
        {WIZARD_STEPS.map((step, index) => {
          const isCompleted = completedSteps.has(step.id);
          const isCurrent = currentStep === step.id;
          const isPast = index < currentStepIndex;

          return (
            <React.Fragment key={step.id}>
              {index > 0 && (
                <div className={cn("h-px w-8 transition-colors", isPast || isCompleted ? "bg-emerald-500" : "bg-white/10")} />
              )}
              <button
                type="button"
                onClick={() => goToStep(step.id)}
                disabled={isLocked && step.id !== "finalize"}
                className={cn(
                  "flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-all",
                  isCurrent
                    ? "bg-indigo-500/30 text-indigo-200 ring-1 ring-indigo-400/50"
                    : isCompleted || isPast
                    ? "bg-emerald-500/20 text-emerald-200"
                    : "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60"
                )}
              >
                {isCompleted ? <Check className="h-3 w-3" /> : <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/10 text-[10px]">{index + 1}</span>}
                <span className="hidden sm:inline">{step.label}</span>
              </button>
            </React.Fragment>
          );
        })}
      </div>

      {/* Step content card */}
      <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
        <CardContent className="p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {renderStepContent()}
            </motion.div>
          </AnimatePresence>
        </CardContent>
      </Card>

      {/* Navigation — matches LessonNoteWizard */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {currentStepIndex > 0 ? (
            <Button type="button" variant="outline" onClick={goBack} className="border-white/10 bg-white/5 text-white/70 hover:bg-white/10">
              <ChevronLeft className="mr-1 h-4 w-4" /> Back
            </Button>
          ) : (
            <Button type="button" variant="outline" onClick={onCancel} className="border-white/10 bg-white/5 text-white/70 hover:bg-white/10">
              Cancel
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          {currentStep === "finalize" ? null : (
            <Button
              type="button"
              onClick={() => void goNext()}
              disabled={updateSession.isPending}
              className="bg-indigo-500/20 text-indigo-100 hover:bg-indigo-500/30 disabled:opacity-50"
            >
              Next <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Ingestion modal (reused) */}
      <ReconciliationIngestionModal
        open={ingestionModalOpen}
        onOpenChange={setIngestionModalOpen}
        onImported={() => void ingestionQuery.refetch()}
      />
    </div>
  );
}

// ===========================================================================
// Step Components
// ===========================================================================

function NoteField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="mt-4 space-y-2">
      <div className="flex items-center gap-2 text-xs font-medium text-white/50">
        <StickyNote className="h-3.5 w-3.5" /> {label}
      </div>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || "Add notes for this step…"}
        className="min-h-[80px] border-white/10 bg-white/5 text-sm text-white placeholder:text-white/30"
        maxLength={2000}
      />
    </div>
  );
}

function KPI({ label, value, color = "default" }: { label: string; value: string | number; color?: "default" | "green" | "red" | "amber" }) {
  const colors = { default: "text-white", green: "text-emerald-300", red: "text-rose-300", amber: "text-amber-300" };
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
      <p className={`text-xl font-bold ${colors[color]}`}>{value}</p>
      <p className="mt-1 text-[11px] text-white/40">{label}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 1: Prepare
// ---------------------------------------------------------------------------

function PrepareStep({ session, notes, onNotesChange }: { session: ReconciliationSessionItem; notes: string; onNotesChange: (v: string) => void }) {
  const docs = session.sourceTypes.map((st) => ({
    type: st,
    label: SOURCE_LABELS[st] || st,
    ready: false,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-white">Before You Begin</h3>
        <p className="mt-1 text-sm text-white/50">
          Please have the following documents ready for this reconciliation session.
        </p>
      </div>

      <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4">
        <p className="text-xs font-medium uppercase tracking-wider text-indigo-300">Documents Needed</p>
        <div className="mt-3 space-y-3">
          {docs.map((doc) => (
            <div key={doc.type} className="flex items-start gap-3 rounded-lg border border-white/10 bg-white/5 p-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/20">
                <FileSpreadsheet className="h-4 w-4 text-indigo-300" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">{doc.label}</p>
                <p className="mt-0.5 text-xs text-white/40">
                  {doc.type === "gateway" && "Export your Paystack settlement or transaction list as CSV."}
                  {doc.type === "bank" && "Download your bank or MoMo statement for the reconciliation period."}
                  {doc.type === "manual" && "Gather all manual receipt records (cash, cheque, etc)."}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <p className="text-xs font-medium uppercase tracking-wider text-white/40">Session Details</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-[11px] text-white/30">Label</p>
            <p className="mt-0.5 text-sm text-white">{session.label}</p>
          </div>
          <div>
            <p className="text-[11px] text-white/30">Sources</p>
            <p className="mt-0.5 text-sm text-white">{session.sourceTypes.map((s) => s.replace("_", " ")).join(", ")}</p>
          </div>
          {session.dateRange?.startDate && (
            <div>
              <p className="text-[11px] text-white/30">Period</p>
              <p className="mt-0.5 text-sm text-white">
                {formatShortDate(session.dateRange.startDate)} — {formatShortDate(session.dateRange.endDate)}
              </p>
            </div>
          )}
        </div>
      </div>

      <NoteField label="Preparation Notes" value={notes} onChange={onNotesChange} placeholder="Note anything relevant before starting the session…" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2: Import
// ---------------------------------------------------------------------------

function ImportStep({
  notes,
  onNotesChange,
  onOpenIngestion,
  summary,
  totalIngested,
  isLoading,
}: {
  notes: string;
  onNotesChange: (v: string) => void;
  onOpenIngestion: () => void;
  summary: Record<string, number>;
  totalIngested: number;
  isLoading: boolean;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-white">Import Evidence</h3>
        <p className="mt-1 text-sm text-white/50">
          Upload your gateway exports, bank statements, or manual records. You can import multiple files.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <KPI label="Total Ingested" value={isLoading ? "…" : totalIngested} />
        <KPI label="Unmatched" value={isLoading ? "…" : summary.unmatched || 0} color="red" />
        <KPI label="Already Matched" value={isLoading ? "…" : summary.matched || 0} color="green" />
      </div>

      <div className="flex items-center justify-center">
        <Button
          type="button"
          onClick={onOpenIngestion}
          className="bg-linear-to-r from-indigo-500 to-violet-600 text-white hover:from-indigo-600 hover:to-violet-700"
        >
          <FileSpreadsheet className="mr-2 h-4 w-4" /> Import Data
        </Button>
      </div>

      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
        <p className="text-xs text-emerald-200">
          You can import multiple batches. Each import is additive — duplicates are handled by the deduplication system.
        </p>
      </div>

      <NoteField label="Import Notes" value={notes} onChange={onNotesChange} placeholder="Note the source files imported, any issues encountered…" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 3: Auto-Match
// ---------------------------------------------------------------------------

function MatchStep({
  summary,
  matchRate,
  totalIngested,
  isRunning,
  onRun,
}: {
  summary: Record<string, number>;
  matchRate: number;
  totalIngested: number;
  isRunning: boolean;
  onRun: () => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-white">Run Deterministic Auto-Match</h3>
        <p className="mt-1 text-sm text-white/50">
          The system will attempt to match ingested evidence against internal payment records using reference IDs, amounts, and dates.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <KPI label="Total Items" value={totalIngested} />
        <KPI label="Matched" value={summary.matched || 0} color="green" />
        <KPI label="Ambiguous" value={summary.ambiguous || 0} color="amber" />
        <KPI label="Match Rate" value={`${matchRate}%`} color={matchRate >= 80 ? "green" : matchRate >= 50 ? "amber" : "red"} />
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <p className="mb-3 text-xs font-medium uppercase tracking-wider text-white/40">Match Rules (in order)</p>
        <div className="space-y-2 text-sm text-white/70">
          <div className="flex items-start gap-2">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-[10px] font-bold text-emerald-300">1</span>
            <span><strong className="text-white">Exact external ID</strong> — gateway transaction reference matches a payment reference (100% confidence)</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-[10px] font-bold text-emerald-300">2</span>
            <span><strong className="text-white">Exact reference token</strong> — normalized reference matches receipt/external reference (96% confidence)</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-[10px] font-bold text-amber-300">3</span>
            <span><strong className="text-white">Amount + date</strong> — same amount within ±2 days, only if one candidate (78% confidence)</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center">
        <Button
          type="button"
          onClick={onRun}
          disabled={isRunning}
          className="group bg-linear-to-r from-indigo-500 to-violet-600 text-white hover:from-indigo-600 hover:to-violet-700"
        >
          {isRunning ? (
            <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Running…</>
          ) : (
            <><Sparkles className="mr-2 h-4 w-4 transition-transform group-hover:rotate-12" /> Run Auto-Match</>
          )}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 4: Review
// ---------------------------------------------------------------------------

function ReviewStep({
  items,
  summary,
  matchRate,
  totalIngested,
  notes,
  onNotesChange,
  alerts,
  onRefresh,
  isLoading,
  pagination,
  onPageChange,
}: {
  items: Array<Record<string, unknown>>;
  summary: Record<string, number>;
  matchRate: number;
  totalIngested: number;
  notes: string;
  onNotesChange: (v: string) => void;
  alerts: Array<Record<string, unknown>>;
  onRefresh: () => void;
  isLoading: boolean;
  pagination?: { page: number; limit: number; total: number; pages: number };
  onPageChange: (page: number) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Review Results</h3>
          <p className="mt-1 text-sm text-white/50">Review the auto-match results and active alerts before resolving remaining items.</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onRefresh} className="border-white/10 bg-white/5 text-white/70 hover:bg-white/10">
          <RefreshCw className={`mr-1 h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <KPI label="Total" value={totalIngested} />
        <KPI label="Matched" value={summary.matched || 0} color="green" />
        <KPI label="Ambiguous" value={summary.ambiguous || 0} color="amber" />
        <KPI label="Match Rate" value={`${matchRate}%`} color={matchRate >= 80 ? "green" : "amber"} />
      </div>

      {alerts.length > 0 && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-amber-300">Active Alerts</p>
          <div className="mt-2 space-y-2">
            {alerts.map((alert, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-amber-200">
                <Shield className="h-4 w-4 shrink-0 text-amber-400" />
                <span>{String(alert.title || "")}: {String(alert.count || 0)} item(s)</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {(summary.unmatched > 0 || summary.ambiguous > 0) && (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3">
          <p className="text-sm text-rose-200">
            {summary.ambiguous > 0 && `${summary.ambiguous} ambiguous item(s) need manual review. `}
            {summary.unmatched > 0 && `${summary.unmatched} item(s) remain unmatched.`}
            {" "}Proceed to the Resolve step for AI suggestions and manual matching.
          </p>
        </div>
      )}

      {summary.unmatched === 0 && summary.ambiguous === 0 && totalIngested > 0 && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
          <div className="flex items-center gap-2 text-sm text-emerald-200">
            <CheckCircle2 className="h-4 w-4" />
            All items are matched or ignored. You can proceed to finalize.
          </div>
        </div>
      )}

      <div className="max-h-64 space-y-1 overflow-y-auto rounded-xl border border-white/10 bg-white/3 p-2">
        {items.map((item) => (
          <div key={String(item.id)} className="flex items-center gap-3 rounded-lg px-3 py-2 text-xs hover:bg-white/5">
            <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusBadgeClass(String(item.status) as ReconciliationStatus)}`}>
              {String(item.status)}
            </span>
            <span className="flex-1 truncate text-white/70">{String(item.externalTxnId)}</span>
            <span className="text-white/50">{formatCurrency(Number(item.amountMinor || 0))}</span>
          </div>
        ))}
        {items.length === 0 && !isLoading && <p className="py-4 text-center text-xs text-white/30">No ingestion items yet.</p>}
      </div>

      {pagination && pagination.pages > 1 && (
        <div className="flex items-center justify-between text-xs text-white/45">
          <span>
            Page {pagination.page} of {pagination.pages} ({pagination.total} rows)
          </span>
          <div className="flex gap-1">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 border-white/10 bg-white/5 px-2 text-white"
              disabled={pagination.page <= 1}
              onClick={() => onPageChange(Math.max(1, pagination.page - 1))}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 border-white/10 bg-white/5 px-2 text-white"
              disabled={pagination.page >= pagination.pages}
              onClick={() => onPageChange(Math.min(pagination.pages, pagination.page + 1))}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      <NoteField label="Review Notes" value={notes} onChange={onNotesChange} placeholder="Note any observations, discrepancies, or concerns…" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 5: Resolve
// ---------------------------------------------------------------------------

function ResolveStep({
  items,
  summary,
  aiSuggestions,
  isLoadingAI,
  onRequestAI,
  onAccept,
  onReject,
  onManualMatch,
  onUnmatch,
  isMatching,
  pagination,
  onPageChange,
}: {
  items: Array<Record<string, unknown>>;
  summary: Record<string, number>;
  aiSuggestions: AISuggestion[];
  isLoadingAI: boolean;
  onRequestAI: () => void;
  onAccept: (s: AISuggestion) => void;
  onReject: (s: AISuggestion) => void;
  onManualMatch: (ingestionId: string, paymentId: string) => void;
  onUnmatch: (ingestionId: string) => void;
  isMatching: boolean;
  pagination?: { page: number; limit: number; total: number; pages: number };
  onPageChange: (page: number) => void;
}) {
  const [manualInputs, setManualInputs] = React.useState<Record<string, string>>({});
  const unresolvedItems = items.filter((i) => i.status === "ambiguous" || i.status === "unmatched");
  const totalUnresolved = (summary.unmatched || 0) + (summary.ambiguous || 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Resolve Remaining Items</h3>
          <p className="mt-1 text-sm text-white/50">
            Use AI suggestions or manually match/ignore remaining items.
          </p>
        </div>
        <Button
          type="button"
          onClick={onRequestAI}
          disabled={isLoadingAI || (summary.ambiguous || 0) === 0}
          className="bg-linear-to-r from-purple-500 to-indigo-600 text-white hover:from-purple-600 hover:to-indigo-700"
        >
          {isLoadingAI ? <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Analyzing…</> : <><Sparkles className="mr-2 h-4 w-4" /> AI Suggestions</>}
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <KPI label="Unresolved (school)" value={totalUnresolved} color={totalUnresolved > 0 ? "amber" : "green"} />
        <KPI label="Matched (school)" value={summary.matched || 0} color="green" />
        <KPI label="This page" value={unresolvedItems.length} color="default" />
      </div>

      {pagination && pagination.pages > 1 && (
        <p className="text-xs text-white/40">
          Showing page {pagination.page} of {pagination.pages} of the ingestion queue. Use pagination to work through all rows.
        </p>
      )}

      {/* AI Suggestions */}
      {aiSuggestions.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider text-purple-300">AI Recommendations</p>
          {aiSuggestions.map((suggestion) => (
            <div key={suggestion.ingestionId} className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">
                    {suggestion.recommendedPaymentId ? `Match → ${suggestion.recommendedPaymentId.slice(0, 12)}…` : "No confident match found"}
                  </p>
                  <p className="mt-1 text-xs text-white/50">{suggestion.reasoning}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/10">
                      <div
                        className={`h-full rounded-full ${suggestion.confidence >= 70 ? "bg-emerald-500" : suggestion.confidence >= 40 ? "bg-amber-500" : "bg-rose-500"}`}
                        style={{ width: `${suggestion.confidence}%` }}
                      />
                    </div>
                    <span className="text-[11px] text-white/40">{suggestion.confidence}% confidence</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  {suggestion.recommendedPaymentId && (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => onAccept(suggestion)}
                      className="h-8 bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30"
                    >
                      <Check className="mr-1 h-3 w-3" /> Accept
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => onReject(suggestion)}
                    className="h-8 border-white/10 text-white/60 hover:bg-white/10"
                  >
                    Reject
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Unresolved items list */}
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wider text-white/40">
          {unresolvedItems.length > 0 ? "Unresolved Items" : "All Items Resolved"}
        </p>
        <div className="max-h-80 space-y-1 overflow-y-auto rounded-xl border border-white/10 bg-white/3 p-2">
          {totalUnresolved === 0 ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-emerald-300">
              <CheckCircle2 className="h-5 w-5" /> All items resolved
            </div>
          ) : unresolvedItems.length === 0 ? (
            <div className="py-6 text-center text-xs text-white/45">
              No unresolved rows on this page. Use the queue pagination below to reach other items.
            </div>
          ) : (
            unresolvedItems.map((item) => {
              const id = String(item.id);
              const candidates = Array.isArray(item.candidatePaymentIds) ? item.candidatePaymentIds as string[] : [];
              return (
                <div key={id} className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-white">{String(item.externalTxnId)}</p>
                      <p className="mt-0.5 text-xs text-white/40">
                        {formatCurrency(Number(item.amountMinor || 0))} · {formatShortDate(item.transactionDate as string)} · {String(item.sourceType)}
                      </p>
                    </div>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusBadgeClass(String(item.status) as ReconciliationStatus)}`}>
                      {String(item.status)}
                    </span>
                  </div>
                  {candidates.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {candidates.slice(0, 5).map((cid: string) => (
                        <button
                          key={cid}
                          type="button"
                          onClick={() => setManualInputs((prev) => ({ ...prev, [id]: String(cid) }))}
                          className="rounded-md border border-white/10 bg-white/5 px-2 py-1 font-mono text-[10px] text-white/50 hover:border-indigo-500/30 hover:bg-indigo-500/10 hover:text-indigo-300"
                        >
                          {String(cid).slice(0, 8)}…
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      value={manualInputs[id] || ""}
                      onChange={(e) => setManualInputs((prev) => ({ ...prev, [id]: e.target.value }))}
                      placeholder="Payment ID"
                      className="h-8 flex-1 rounded-md border border-white/10 bg-white/5 px-2 font-mono text-xs text-white placeholder:text-white/25"
                    />
                    <Button
                      type="button"
                      size="sm"
                      disabled={isMatching || !(manualInputs[id] || "").trim()}
                      onClick={() => { void onManualMatch(id, manualInputs[id]); setManualInputs((prev) => ({ ...prev, [id]: "" })); }}
                      className="h-8 bg-indigo-500/20 text-indigo-200 hover:bg-indigo-500/30"
                    >
                      Match
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
        {pagination && pagination.pages > 1 && (
          <div className="flex items-center justify-between text-xs text-white/45">
            <span>
              Page {pagination.page} of {pagination.pages} ({pagination.total} rows)
            </span>
            <div className="flex gap-1">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 border-white/10 bg-white/5 px-2 text-white"
                disabled={pagination.page <= 1}
                onClick={() => onPageChange(Math.max(1, pagination.page - 1))}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 border-white/10 bg-white/5 px-2 text-white"
                disabled={pagination.page >= pagination.pages}
                onClick={() => onPageChange(Math.min(pagination.pages, pagination.page + 1))}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 6: Finalize
// ---------------------------------------------------------------------------

function FinalizeStep({
  session,
  summary,
  matchRate,
  totalIngested,
  notes,
  onNotesChange,
  lockReason,
  onLockReasonChange,
  onLock,
  isLocking,
  isLocked,
  generatedReport,
  verificationId,
  onGenerateReport,
  isGeneratingReport,
}: {
  session: ReconciliationSessionItem;
  summary: Record<string, number>;
  matchRate: number;
  totalIngested: number;
  notes: string;
  onNotesChange: (v: string) => void;
  lockReason: string;
  onLockReasonChange: (v: string) => void;
  onLock: () => void;
  isLocking: boolean;
  isLocked: boolean;
  generatedReport: ReconciliationReport | null;
  verificationId: string | null;
  onGenerateReport: () => void;
  isGeneratingReport: boolean;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-white">Finalize & Lock</h3>
        <p className="mt-1 text-sm text-white/50">
          Review the session summary, generate an AI report, and lock the session when satisfied.
        </p>
      </div>

      {isLocked && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          <div className="flex items-center gap-2 text-emerald-200">
            <Lock className="h-5 w-5" />
            <span className="text-sm font-medium">This session is locked.</span>
          </div>
          {session.lockReason && <p className="mt-1 text-xs text-emerald-300/70">Reason: {session.lockReason}</p>}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-4">
        <KPI label="Total Ingested" value={totalIngested} />
        <KPI label="Matched" value={summary.matched || 0} color="green" />
        <KPI label="Unmatched" value={summary.unmatched || 0} color={Number(summary.unmatched) > 0 ? "red" : "green"} />
        <KPI label="Match Rate" value={`${matchRate}%`} color={matchRate >= 80 ? "green" : "amber"} />
      </div>

      {/* Timeline */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <p className="text-xs font-medium uppercase tracking-wider text-white/40">Session Timeline</p>
        <div className="mt-3 max-h-40 space-y-2 overflow-y-auto">
          {session.timeline.map((event, i) => (
            <div key={i} className="flex items-start gap-2 text-xs">
              <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" />
              <div>
                <span className="font-medium text-white/70">{event.action.replace(/_/g, " ")}</span>
                <span className="ml-2 text-white/30">{formatShortDate(event.at)}</span>
                {event.notes && <p className="mt-0.5 text-white/40">{event.notes}</p>}
                {event.reason && <p className="mt-0.5 text-white/40">Reason: {event.reason}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AI Report */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wider text-white/40">AI Reconciliation Report</p>
          <Button
            type="button"
            size="sm"
            onClick={onGenerateReport}
            disabled={isGeneratingReport || isLocked}
            className="h-8 bg-linear-to-r from-purple-500 to-indigo-600 text-white hover:from-purple-600 hover:to-indigo-700"
          >
            {isGeneratingReport ? <><RefreshCw className="mr-1 h-3 w-3 animate-spin" /> Generating…</> : <><Sparkles className="mr-1 h-3 w-3" /> Generate Report</>}
          </Button>
        </div>

        {generatedReport && (
          <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4 space-y-4">
            <p className="text-sm text-white">{generatedReport.executiveSummary}</p>
            {generatedReport.sections.map((section, i) => (
              <div key={i}>
                <p className="text-xs font-semibold text-purple-200">{section.title}</p>
                <p className="mt-1 text-xs text-white/60">{section.content}</p>
                {section.highlights && section.highlights.length > 0 && (
                  <ul className="mt-1 space-y-0.5">
                    {section.highlights.map((h, j) => (
                      <li key={j} className="text-[11px] text-purple-300">• {h}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
            {generatedReport.exceptions.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-amber-200">Exceptions</p>
                {generatedReport.exceptions.map((e, i) => (
                  <p key={i} className="text-xs text-amber-300/70">• {e}</p>
                ))}
              </div>
            )}
            {generatedReport.recommendations.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-emerald-200">Recommendations</p>
                {generatedReport.recommendations.map((r, i) => (
                  <p key={i} className="text-xs text-emerald-300/70">• {r}</p>
                ))}
              </div>
            )}
          </div>
        )}

        {verificationId && (
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
            <p className="text-xs text-emerald-200">
              Verification ID: <span className="font-mono font-semibold">{verificationId}</span>
              <a href={`/verify/report/${verificationId}`} target="_blank" rel="noopener noreferrer" className="ml-2 underline hover:text-emerald-100">
                Verify →
              </a>
            </p>
          </div>
        )}
      </div>

      <NoteField label="Finalization Notes" value={notes} onChange={onNotesChange} placeholder="Final observations, sign-off notes for auditors…" />

      {/* Lock controls */}
      {!isLocked && (
        <div className="space-y-3 rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-indigo-300">Lock Session</p>
          <p className="text-xs text-white/50">
            Locking confirms this reconciliation is complete. Locked sessions can only be reopened by a school administrator.
          </p>
          <Textarea
            value={lockReason}
            onChange={(e) => onLockReasonChange(e.target.value)}
            placeholder="Reason for locking (required)…"
            className="min-h-[60px] border-white/10 bg-white/5 text-sm text-white placeholder:text-white/30"
            maxLength={500}
          />
          <Button
            type="button"
            onClick={onLock}
            disabled={isLocking || !lockReason.trim()}
            className="w-full bg-linear-to-r from-emerald-500 to-teal-600 text-white hover:from-emerald-600 hover:to-teal-700"
          >
            {isLocking ? <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Locking…</> : <><Lock className="mr-2 h-4 w-4" /> Lock Session</>}
          </Button>
        </div>
      )}
    </div>
  );
}
