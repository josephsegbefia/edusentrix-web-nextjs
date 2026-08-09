"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { GhanaPhoneInput } from "@/components/ui/ghana-phone-input";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import { PROPOSAL_MODULES } from "@/lib/proposals/defaults";
import { cn } from "@/lib/utils";

const proposalTypes = [
  { value: "general", label: "General Proposal" },
  { value: "pilot", label: "Pilot Proposal" },
  { value: "pricing", label: "Pricing Proposal" },
  { value: "demo_follow_up", label: "Demo Follow-up" },
  { value: "full_implementation", label: "Full Implementation" },
] as const;

const DEFAULT_MODULES = [
  "Student Records",
  "Fees, Invoices & Payments",
  "Notices & Communication",
  "Reports & Analytics",
];

export function ProposalCreateForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = React.useState(false);
  const [selectedModules, setSelectedModules] = React.useState<string[]>(() => [...DEFAULT_MODULES]);
  const [form, setForm] = React.useState({
    schoolName: "",
    schoolLocation: "",
    recipientName: "",
    recipientTitle: "",
    recipientEmail: "",
    recipientPhone: "",
    proposalType: "general",
    setupFee: "",
    recurringFee: "",
    cadence: "monthly",
    studentRange: "",
    paymentTerms: "",
    internalNotes: "",
  });

  function update(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleModule(module: string) {
    setSelectedModules((prev) =>
      prev.includes(module) ? prev.filter((item) => item !== module) : [...prev, module],
    );
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.schoolName.trim()) {
      toast.error("School name is required");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/platform/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolName: form.schoolName,
          schoolLocation: form.schoolLocation,
          recipientName: form.recipientName,
          recipientTitle: form.recipientTitle,
          recipientEmail: form.recipientEmail,
          recipientPhone: form.recipientPhone,
          proposalType: form.proposalType,
          selectedModules,
          internalNotes: form.internalNotes,
          pricing: {
            currency: "GHS",
            setupFee: form.setupFee ? Number(form.setupFee) : null,
            recurringFee: form.recurringFee ? Number(form.recurringFee) : null,
            cadence: form.cadence,
            studentRange: form.studentRange,
            paymentTerms: form.paymentTerms,
          },
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error || "Failed to create proposal");
      toast.success("Proposal created");
      router.push(`/platform/proposals/${json.data.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create proposal");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
      <div className="space-y-5 rounded-3xl border border-white/10 bg-white/5 p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">School name</span>
            <Input value={form.schoolName} onChange={(e) => update("schoolName", e.target.value)} className="border-white/10 bg-white/5 text-white" />
          </label>
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">Location</span>
            <Input value={form.schoolLocation} onChange={(e) => update("schoolLocation", e.target.value)} className="border-white/10 bg-white/5 text-white" />
          </label>
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">Recipient name</span>
            <Input value={form.recipientName} onChange={(e) => update("recipientName", e.target.value)} className="border-white/10 bg-white/5 text-white" />
          </label>
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">Recipient title</span>
            <Input value={form.recipientTitle} onChange={(e) => update("recipientTitle", e.target.value)} className="border-white/10 bg-white/5 text-white" />
          </label>
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">Recipient email</span>
            <Input value={form.recipientEmail} onChange={(e) => update("recipientEmail", e.target.value)} className="border-white/10 bg-white/5 text-white" />
          </label>
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">Recipient phone</span>
            <GhanaPhoneInput value={form.recipientPhone} onChange={(e) => update("recipientPhone", e.target.value)} className="border-white/10 bg-white/5 text-white" />
          </label>
        </div>

        <label className="space-y-2 block">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">Proposal type</span>
          <PremiumSelect value={form.proposalType} onValueChange={(value) => update("proposalType", value)}>
            <PremiumSelectTrigger>
              <PremiumSelectValue />
            </PremiumSelectTrigger>
            <PremiumSelectContent>
              {proposalTypes.map((type) => (
                <PremiumSelectItem key={type.value} value={type.value}>
                  {type.label}
                </PremiumSelectItem>
              ))}
            </PremiumSelectContent>
          </PremiumSelect>
        </label>

        <div className="grid gap-4 md:grid-cols-4">
          <Input placeholder="Setup fee" value={form.setupFee} onChange={(e) => update("setupFee", e.target.value)} className="border-white/10 bg-white/5 text-white" />
          <Input placeholder="Recurring fee" value={form.recurringFee} onChange={(e) => update("recurringFee", e.target.value)} className="border-white/10 bg-white/5 text-white" />
          <Input placeholder="Student range" value={form.studentRange} onChange={(e) => update("studentRange", e.target.value)} className="border-white/10 bg-white/5 text-white" />
          <Input placeholder="Payment terms" value={form.paymentTerms} onChange={(e) => update("paymentTerms", e.target.value)} className="border-white/10 bg-white/5 text-white" />
        </div>

        <Textarea
          placeholder="Internal notes"
          value={form.internalNotes}
          onChange={(e) => update("internalNotes", e.target.value)}
          className="min-h-28 border-white/10 bg-white/5 text-white"
        />
      </div>

      <div className="space-y-5 rounded-3xl border border-white/10 bg-white/5 p-5">
        <div>
          <h2 className="text-lg font-semibold text-white">Modules to emphasize</h2>
          <p className="mt-1 text-sm text-white/55">Selected modules shape the proposal context and future AI suggestions.</p>
        </div>
        <div className="grid gap-2">
          {PROPOSAL_MODULES.map((module) => {
            const selected = selectedModules.includes(module);
            return (
              <button
                key={module}
                type="button"
                onClick={() => toggleModule(module)}
                className={cn(
                  "flex items-center justify-between rounded-2xl border px-3 py-2 text-left text-sm transition",
                  selected ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-50" : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10",
                )}
              >
                {module}
                {selected ? <Check className="h-4 w-4" /> : null}
              </button>
            );
          })}
        </div>
        <Button disabled={submitting} className="w-full bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30">
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Create proposal
        </Button>
      </div>
    </form>
  );
}
