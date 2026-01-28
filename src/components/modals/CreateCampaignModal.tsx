// src/components/modals/CreateCampaignModal.tsx
"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import { Switch } from "@/components/ui/switch";
import {
  useCreateCampaign,
  CampaignCategory,
  CampaignAudienceScope,
  DonorVisibility,
} from "@/hooks/admin/useFundraisingCampaigns";
import { useBusyToast } from "@/hooks/useBusyToast";
import { toast } from "sonner";

// ============================================================================
// Types
// ============================================================================

interface MilestoneFormData {
  id: string;
  label: string;
  amount: string;
}

interface CreateCampaignModalProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onSuccess?: () => void;
}

// ============================================================================
// Options
// ============================================================================

const CATEGORIES: Array<{ value: CampaignCategory; label: string }> = [
  { value: "school_project", label: "School Project" },
  { value: "emergency", label: "Emergency" },
  { value: "pta_drive", label: "PTA Drive" },
  { value: "student_cause", label: "Student Cause" },
  { value: "other", label: "Other" },
];

const AUDIENCE_SCOPES: Array<{ value: CampaignAudienceScope; label: string }> = [
  { value: "school", label: "Entire School" },
  { value: "parents", label: "Parents Only" },
  { value: "staff", label: "Staff Only" },
  { value: "grade", label: "Specific Grades" },
  { value: "class", label: "Specific Classes" },
];

const CURRENCIES = [
  { value: "GHS", label: "GHS - Ghanaian Cedi" },
  { value: "USD", label: "USD - US Dollar" },
  { value: "NGN", label: "NGN - Nigerian Naira" },
  { value: "KES", label: "KES - Kenyan Shilling" },
  { value: "GBP", label: "GBP - British Pound" },
  { value: "EUR", label: "EUR - Euro" },
];

// ============================================================================
// Main Modal Component
// ============================================================================

export default function CreateCampaignModal({ open, onOpenChange, onSuccess }: CreateCampaignModalProps) {
  const createMutation = useCreateCampaign();
  const busyToast = useBusyToast();

  // Form state
  const [title, setTitle] = React.useState("");
  const [summary, setSummary] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [category, setCategory] = React.useState<CampaignCategory>("school_project");
  const [audienceScope, setAudienceScope] = React.useState<CampaignAudienceScope>("school");
  const [goalAmount, setGoalAmount] = React.useState("");
  const [currency, setCurrency] = React.useState("GHS");
  const [donorVisibility, setDonorVisibility] = React.useState<DonorVisibility>("public_anonymous");
  const [allowAnonymous, setAllowAnonymous] = React.useState(true);
  const [enablePublicShare, setEnablePublicShare] = React.useState(false);
  const [milestones, setMilestones] = React.useState<MilestoneFormData[]>([]);

  const resetForm = () => {
    setTitle("");
    setSummary("");
    setDescription("");
    setCategory("school_project");
    setAudienceScope("school");
    setGoalAmount("");
    setCurrency("GHS");
    setDonorVisibility("public_anonymous");
    setAllowAnonymous(true);
    setEnablePublicShare(false);
    setMilestones([]);
  };

  const addMilestone = () => {
    setMilestones([
      ...milestones,
      { id: `m_${Date.now()}`, label: "", amount: "" },
    ]);
  };

  const updateMilestone = (id: string, field: "label" | "amount", value: string) => {
    setMilestones(
      milestones.map((m) =>
        m.id === id ? { ...m, [field]: value } : m
      )
    );
  };

  const removeMilestone = (id: string) => {
    setMilestones(milestones.filter((m) => m.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!title.trim()) {
      toast.error("Please enter a campaign title");
      return;
    }

    const goalAmountNum = Number.parseFloat(goalAmount);
    if (Number.isNaN(goalAmountNum) || goalAmountNum < 1) {
      toast.error("Please enter a valid goal amount (minimum 1)");
      return;
    }

    // Convert to minor units (cents/pesewas)
    const goalAmountMinor = Math.round(goalAmountNum * 100);

    // Validate milestones
    const validMilestones = milestones
      .filter((m) => m.label.trim() && m.amount)
      .map((m) => ({
        label: m.label.trim(),
        amountMinor: Math.round(Number.parseFloat(m.amount) * 100),
      }))
      .filter((m) => !Number.isNaN(m.amountMinor) && m.amountMinor > 0);

    busyToast.show("Creating campaign...");

    try {
      await createMutation.mutateAsync({
        title: title.trim(),
        summary: summary.trim() || undefined,
        description: description.trim() || undefined,
        category,
        audience: { scope: audienceScope },
        goalAmountMinor,
        currency,
        donorVisibility,
        allowAnonymousDonations: allowAnonymous,
        publicShare: { enabled: enablePublicShare },
        milestones: validMilestones.length > 0 ? validMilestones : undefined,
      });

      toast.success("Campaign created successfully");
      resetForm();
      onOpenChange(false);
      onSuccess?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create campaign");
    } finally {
      busyToast.hide();
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 pt-20"
        onClick={() => onOpenChange(false)}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="relative w-full max-w-2xl rounded-2xl border border-white/10 bg-[#0f0f14] p-6 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">Create Fundraising Campaign</h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="text-white/60 hover:text-white"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Info */}
            <div className="space-y-4">
              <div>
                <Label className="text-white">Campaign Title *</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter campaign title..."
                  className="mt-1 border-white/10 bg-white/5 text-white"
                />
              </div>
              <div>
                <Label className="text-white/70">Short Summary</Label>
                <Input
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="Brief summary (shown in listings)..."
                  className="mt-1 border-white/10 bg-white/5 text-white"
                />
              </div>
              <div>
                <Label className="text-white/70">Full Description</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detailed description of your campaign..."
                  className="mt-1 min-h-[100px] border-white/10 bg-white/5 text-white"
                />
              </div>
            </div>

            {/* Category & Audience */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label className="text-white/70">Category</Label>
                <PremiumSelect value={category} onValueChange={(v) => setCategory(v as CampaignCategory)}>
                  <PremiumSelectTrigger className="mt-1">
                    <PremiumSelectValue />
                  </PremiumSelectTrigger>
                  <PremiumSelectContent>
                    {CATEGORIES.map((c) => (
                      <PremiumSelectItem key={c.value} value={c.value}>
                        {c.label}
                      </PremiumSelectItem>
                    ))}
                  </PremiumSelectContent>
                </PremiumSelect>
              </div>
              <div>
                <Label className="text-white/70">Audience</Label>
                <PremiumSelect value={audienceScope} onValueChange={(v) => setAudienceScope(v as CampaignAudienceScope)}>
                  <PremiumSelectTrigger className="mt-1">
                    <PremiumSelectValue />
                  </PremiumSelectTrigger>
                  <PremiumSelectContent>
                    {AUDIENCE_SCOPES.map((s) => (
                      <PremiumSelectItem key={s.value} value={s.value}>
                        {s.label}
                      </PremiumSelectItem>
                    ))}
                  </PremiumSelectContent>
                </PremiumSelect>
              </div>
            </div>

            {/* Goal & Currency */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label className="text-white">Goal Amount *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="1"
                  value={goalAmount}
                  onChange={(e) => setGoalAmount(e.target.value)}
                  placeholder="e.g., 5000.00"
                  className="mt-1 border-white/10 bg-white/5 text-white"
                />
              </div>
              <div>
                <Label className="text-white/70">Currency</Label>
                <PremiumSelect value={currency} onValueChange={setCurrency}>
                  <PremiumSelectTrigger className="mt-1">
                    <PremiumSelectValue />
                  </PremiumSelectTrigger>
                  <PremiumSelectContent>
                    {CURRENCIES.map((c) => (
                      <PremiumSelectItem key={c.value} value={c.value}>
                        {c.label}
                      </PremiumSelectItem>
                    ))}
                  </PremiumSelectContent>
                </PremiumSelect>
              </div>
            </div>

            {/* Visibility Settings */}
            <div>
              <Label className="text-white/70">Donor Visibility</Label>
              <PremiumSelect value={donorVisibility} onValueChange={(v) => setDonorVisibility(v as DonorVisibility)}>
                <PremiumSelectTrigger className="mt-1">
                  <PremiumSelectValue />
                </PremiumSelectTrigger>
                <PremiumSelectContent>
                  <PremiumSelectItem value="public_anonymous">Show as anonymous to public</PremiumSelectItem>
                  <PremiumSelectItem value="public_named">Show donor names publicly</PremiumSelectItem>
                  <PremiumSelectItem value="admin_only">Admin only (hidden from public)</PremiumSelectItem>
                </PremiumSelectContent>
              </PremiumSelect>
            </div>

            <div className="flex flex-wrap gap-6">
              <div className="flex items-center gap-2">
                <Switch checked={allowAnonymous} onCheckedChange={setAllowAnonymous} />
                <Label className="text-sm text-white/60">Allow anonymous donations</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={enablePublicShare} onCheckedChange={setEnablePublicShare} />
                <Label className="text-sm text-white/60">Enable public sharing link</Label>
              </div>
            </div>

            {/* Milestones */}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <Label className="text-white/70">Milestones (Optional)</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addMilestone}
                  className="gap-1 border-white/10 text-white/60"
                >
                  <Plus className="h-4 w-4" />
                  Add Milestone
                </Button>
              </div>
              {milestones.length > 0 && (
                <div className="space-y-2">
                  {milestones.map((m, index) => (
                    <div key={m.id} className="flex items-center gap-2">
                      <Input
                        value={m.label}
                        onChange={(e) => updateMilestone(m.id, "label", e.target.value)}
                        placeholder={`Milestone ${index + 1} name`}
                        className="flex-1 border-white/10 bg-white/5 text-white"
                      />
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={m.amount}
                        onChange={(e) => updateMilestone(m.id, "amount", e.target.value)}
                        placeholder="Amount"
                        className="w-32 border-white/10 bg-white/5 text-white"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeMilestone(m.id)}
                        className="h-8 w-8 text-white/40 hover:text-rose-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="border-white/10 text-white/60"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending}
                className="bg-emerald-600 text-white hover:bg-emerald-700"
              >
                Create Campaign
              </Button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
