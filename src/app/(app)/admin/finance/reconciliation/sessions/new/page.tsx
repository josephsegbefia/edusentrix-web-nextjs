"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ChevronLeft,
  FileSearch,
  Loader2,
  Shield,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DateRangePicker } from "@/components/ui/custom-date-picker";
import { useCreateReconciliationSession } from "@/hooks/admin/useReconciliationSessions";

const SOURCE_OPTIONS = [
  { value: "gateway", label: "Paystack / Gateway", description: "Settlement exports from payment gateway" },
  { value: "bank", label: "Bank / MoMo", description: "Bank statements or mobile money records" },
  { value: "manual", label: "Manual Receipts", description: "Cash, cheque, or other manual payment records" },
] as const;

export default function NewReconciliationSessionPage() {
  const router = useRouter();
  const createSession = useCreateReconciliationSession();

  const [label, setLabel] = React.useState("");
  const [sourceTypes, setSourceTypes] = React.useState<string[]>(["gateway", "bank"]);
  const [startDate, setStartDate] = React.useState<Date | null>(null);
  const [endDate, setEndDate] = React.useState<Date | null>(null);
  const [notes, setNotes] = React.useState("");
  const [isRedirecting, setIsRedirecting] = React.useState(false);

  function toggleSource(value: string) {
    setSourceTypes((prev) =>
      prev.includes(value)
        ? prev.filter((s) => s !== value)
        : [...prev, value]
    );
  }

  async function handleCreate() {
    if (!label.trim()) {
      toast.error("Please enter a session label.");
      return;
    }
    if (sourceTypes.length === 0) {
      toast.error("Select at least one source type.");
      return;
    }
    try {
      const result = await createSession.mutateAsync({
        label: label.trim(),
        sourceTypes,
        dateRange: startDate || endDate
          ? {
              startDate: startDate ? startDate.toISOString() : undefined,
              endDate: endDate ? endDate.toISOString() : undefined,
            }
          : undefined,
        prepareNotes: notes.trim() || undefined,
      });
      toast.success("Session created.");
      setIsRedirecting(true);
      router.push(`/admin/finance/reconciliation/sessions/${result.id}`);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to create session.");
    }
  }

  return (
    <div className="min-h-screen p-6 md:p-8">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/admin/finance/reconciliation/sessions")}
            className="mb-4 text-white/50 hover:text-white/80"
          >
            <ChevronLeft className="mr-1 h-4 w-4" /> Back to Sessions
          </Button>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br from-indigo-500/20 to-violet-600/20">
              <Shield className="h-6 w-6 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">New Reconciliation Session</h1>
              <p className="mt-1 text-sm text-white/50">Set up a guided reconciliation workflow.</p>
            </div>
          </div>
        </div>

        <Card className="overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/60 via-slate-950/60 to-black/60 shadow-lg">
          <CardContent className="space-y-6 p-6">
            {/* Label */}
            <div className="space-y-2">
              <Label className="text-sm text-white/70">Session Label</Label>
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. February 2026 Bank Reconciliation"
                className="border-white/10 bg-white/5 text-white placeholder:text-white/30"
                maxLength={200}
              />
            </div>

            {/* Source types */}
            <div className="space-y-2">
              <Label className="text-sm text-white/70">Source Types</Label>
              <div className="grid gap-3 sm:grid-cols-3">
                {SOURCE_OPTIONS.map((option) => {
                  const selected = sourceTypes.includes(option.value);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => toggleSource(option.value)}
                      className={`rounded-xl border p-3 text-left transition-all ${
                        selected
                          ? "border-indigo-500/40 bg-indigo-500/10 ring-1 ring-indigo-400/30"
                          : "border-white/10 bg-white/5 hover:border-white/20"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <FileSearch className={`h-4 w-4 ${selected ? "text-indigo-300" : "text-white/40"}`} />
                        <span className={`text-sm font-medium ${selected ? "text-indigo-200" : "text-white/70"}`}>
                          {option.label}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-white/40">{option.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Date range */}
            <div className="space-y-2">
              <Label className="text-sm text-white/70">Reconciliation period (optional)</Label>
              <DateRangePicker
                startDate={startDate}
                endDate={endDate}
                onStartDateChange={setStartDate}
                onEndDateChange={setEndDate}
                startLabel="Period start"
                endLabel="Period end"
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label className="text-sm text-white/70">Preparation Notes (optional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any context or objectives for this session…"
                className="min-h-[80px] border-white/10 bg-white/5 text-sm text-white placeholder:text-white/30"
                maxLength={2000}
              />
            </div>

            {/* Submit */}
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => router.push("/admin/finance/reconciliation/sessions")}
                className="border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
              >
                Cancel
              </Button>
              <Button
                onClick={() => void handleCreate()}
                disabled={createSession.isPending || isRedirecting || !label.trim() || sourceTypes.length === 0}
                className="bg-linear-to-r from-indigo-500 to-violet-600 text-white hover:from-indigo-600 hover:to-violet-700"
              >
                {createSession.isPending || isRedirecting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                {isRedirecting ? "Opening session..." : createSession.isPending ? "Creating..." : "Create Session"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
