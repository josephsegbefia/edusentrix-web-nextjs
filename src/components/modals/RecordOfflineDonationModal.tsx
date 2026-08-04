// src/components/modals/RecordOfflineDonationModal.tsx
"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Banknote, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GhanaPhoneInput } from "@/components/ui/ghana-phone-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import { useRecordOfflineDonation, PaymentMethod } from "@/hooks/admin/useFundraisingCampaigns";
import { useBusyToast } from "@/hooks/useBusyToast";
import { toast } from "sonner";

interface RecordOfflineDonationModalProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly campaignId: string;
  readonly campaignTitle: string;
  readonly currency: string;
  readonly onSuccess?: () => void;
}

const PAYMENT_METHODS: Array<{ value: PaymentMethod; label: string }> = [
  { value: "cash", label: "Cash" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "mobile_money", label: "Mobile Money" },
  { value: "cheque", label: "Cheque" },
  { value: "other", label: "Other" },
];

export default function RecordOfflineDonationModal({
  open,
  onOpenChange,
  campaignId,
  campaignTitle,
  currency,
  onSuccess,
}: RecordOfflineDonationModalProps) {
  const recordMutation = useRecordOfflineDonation();
  const busyToast = useBusyToast();

  const [amount, setAmount] = React.useState("");
  const [donorName, setDonorName] = React.useState("");
  const [donorEmail, setDonorEmail] = React.useState("");
  const [donorPhone, setDonorPhone] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethod>("cash");
  const [isAnonymous, setIsAnonymous] = React.useState(false);

  const resetForm = () => {
    setAmount("");
    setDonorName("");
    setDonorEmail("");
    setDonorPhone("");
    setMessage("");
    setPaymentMethod("cash");
    setIsAnonymous(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const amountNum = Number.parseFloat(amount);
    if (Number.isNaN(amountNum) || amountNum <= 0) {
      toast.error("Please enter a valid donation amount");
      return;
    }

    if (!isAnonymous && !donorName.trim()) {
      toast.error("Please enter donor name or mark as anonymous");
      return;
    }

    const amountMinor = Math.round(amountNum * 100);

    busyToast.show("Recording donation...");

    try {
      await recordMutation.mutateAsync({
        campaignId,
        data: {
          amountMinor,
          currency,
          donorName: isAnonymous ? undefined : donorName.trim(),
          donorEmail: donorEmail.trim() || undefined,
          donorPhone: donorPhone.trim() || undefined,
          message: message.trim() || undefined,
          paymentMethod,
          isAnonymous,
        },
      });

      toast.success("Donation recorded successfully");
      resetForm();
      onOpenChange(false);
      onSuccess?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to record donation");
    } finally {
      busyToast.hide();
    }
  };

  // Reset form when modal closes
  React.useEffect(() => {
    if (!open) {
      resetForm();
    }
  }, [open]);

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
          className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-[#0f0f14] p-6 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="mb-6 flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10">
                <Banknote className="h-6 w-6 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Record Offline Donation</h2>
                <p className="text-sm text-white/50">For: {campaignTitle}</p>
              </div>
            </div>
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
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Amount & Payment Method */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label className="text-white">Amount ({currency}) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="e.g., 100.00"
                  className="mt-1 border-white/10 bg-white/5 text-white"
                />
              </div>
              <div>
                <Label className="text-white/70">Payment Method</Label>
                <PremiumSelect
                  value={paymentMethod}
                  onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}
                >
                  <PremiumSelectTrigger className="mt-1">
                    <PremiumSelectValue />
                  </PremiumSelectTrigger>
                  <PremiumSelectContent>
                    {PAYMENT_METHODS.map((m) => (
                      <PremiumSelectItem key={m.value} value={m.value}>
                        {m.label}
                      </PremiumSelectItem>
                    ))}
                  </PremiumSelectContent>
                </PremiumSelect>
              </div>
            </div>

            {/* Anonymous Toggle */}
            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-4">
              <Switch checked={isAnonymous} onCheckedChange={setIsAnonymous} />
              <div>
                <Label className="text-white">Anonymous Donation</Label>
                <p className="text-xs text-white/50">Donor information will not be displayed publicly</p>
              </div>
            </div>

            {/* Donor Info */}
            {!isAnonymous && (
              <div className="space-y-4 rounded-xl border border-white/10 bg-white/5 p-4">
                <div>
                  <Label className="text-white">Donor Name *</Label>
                  <Input
                    value={donorName}
                    onChange={(e) => setDonorName(e.target.value)}
                    placeholder="Enter donor's full name"
                    className="mt-1 border-white/10 bg-white/5 text-white"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label className="text-white/70">Email (Optional)</Label>
                    <Input
                      type="email"
                      value={donorEmail}
                      onChange={(e) => setDonorEmail(e.target.value)}
                      placeholder="donor@email.com"
                      className="mt-1 border-white/10 bg-white/5 text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-white/70">Phone (Optional)</Label>
                    <GhanaPhoneInput
                      value={donorPhone}
                      onChange={(e) => setDonorPhone(e.target.value)}
                      className="mt-1 border-white/10 bg-white/5 text-white"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Message */}
            <div>
              <Label className="text-white/70">Donor Message (Optional)</Label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Any message from the donor..."
                className="mt-1 min-h-[80px] border-white/10 bg-white/5 text-white"
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-2">
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
                disabled={recordMutation.isPending}
                className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700"
              >
                <Banknote className="h-4 w-4" />
                Record Donation
              </Button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
