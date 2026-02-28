// src/app/(public)/donate/[token]/page.tsx
"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { format } from "date-fns/format";
import { formatDistanceToNow } from "date-fns/formatDistanceToNow";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  Calendar,
  Check,
  CheckCircle,
  ChevronRight,
  Gift,
  Heart,
  Loader2,
  Mail,
  Phone,
  Target,
  User,
  Users,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ============================================================================
// Types
// ============================================================================

interface CampaignData {
  id: string;
  schoolId: string;
  title: string;
  summary: string | null;
  description: string | null;
  category: string;
  coverImageUrl: string | null;
  galleryUrls: string[];
  goalAmountMinor: number;
  raisedAmountMinor: number;
  donorCount: number;
  currency: string;
  progressPercent: number;
  schedule: {
    startDate: string | null;
    endDate: string | null;
  };
  milestones: Array<{
    id: string;
    label: string;
    amountMinor: number;
    reached: boolean;
  }>;
  allowAnonymousDonations: boolean;
  updates: Array<{
    id: string;
    title: string;
    body: string;
    createdAt: string;
  }>;
  recentDonors: Array<{
    name: string;
    amountMinor: number;
    message: string | null;
    createdAt: string;
  }>;
}

// ============================================================================
// Helpers
// ============================================================================

import { formatMoney } from "@/lib/fees/money";

const SUGGESTED_AMOUNTS = [1000, 2000, 5000, 10000, 20000, 50000]; // In minor units

// ============================================================================
// Main Page
// ============================================================================

export default function PublicDonatePage() {
  const params = useParams();
  const token = params.token as string;

  const [campaign, setCampaign] = React.useState<CampaignData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Form state
  const [step, setStep] = React.useState<"amount" | "details" | "success">("amount");
  const [amountMinor, setAmountMinor] = React.useState<number>(0);
  const [customAmount, setCustomAmount] = React.useState("");
  const [donorName, setDonorName] = React.useState("");
  const [donorEmail, setDonorEmail] = React.useState("");
  const [donorPhone, setDonorPhone] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [isAnonymous, setIsAnonymous] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [receiptNumber, setReceiptNumber] = React.useState("");

  // Fetch campaign data
  React.useEffect(() => {
    async function fetchCampaign() {
      try {
        const res = await fetch(`/api/public/donate/${token}`);
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to load campaign");
        }
        const data = await res.json();
        setCampaign(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load campaign");
      } finally {
        setLoading(false);
      }
    }
    if (token) fetchCampaign();
  }, [token]);

  // Handle amount selection
  const handleAmountSelect = (amount: number) => {
    setAmountMinor(amount);
    setCustomAmount("");
  };

  const handleCustomAmountChange = (value: string) => {
    setCustomAmount(value);
    const parsed = parseFloat(value);
    if (!isNaN(parsed) && parsed > 0) {
      setAmountMinor(Math.round(parsed * 100));
    } else {
      setAmountMinor(0);
    }
  };

  // Handle donation submission
  const handleSubmit = async () => {
    if (!campaign) return;

    if (amountMinor < 100) {
      toast.error("Minimum donation is 1.00");
      return;
    }

    if (!donorName.trim()) {
      toast.error("Please enter your name");
      return;
    }

    if (!donorEmail.trim() || !donorEmail.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch(`/api/public/donate/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountMinor,
          currency: campaign.currency,
          donorName: donorName.trim(),
          donorEmail: donorEmail.trim(),
          donorPhone: donorPhone.trim() || undefined,
          message: message.trim() || undefined,
          isAnonymous,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to process donation");
      }

      setReceiptNumber(data.receiptNumber);
      setStep("success");
      toast.success("Thank you for your donation!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to process donation");
    } finally {
      setSubmitting(false);
    }
  };

  // ══════════════════════════════════════════════════════════════════════════
  // Loading State
  // ══════════════════════════════════════════════════════════════════════════

  if (loading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-slate-950 via-slate-900 to-slate-950 px-4 py-12">
        <div className="mx-auto max-w-2xl">
          <Skeleton className="h-64 rounded-3xl bg-white/5" />
          <Skeleton className="mt-6 h-12 w-3/4 bg-white/5" />
          <Skeleton className="mt-4 h-6 w-1/2 bg-white/5" />
          <Skeleton className="mt-8 h-48 rounded-2xl bg-white/5" />
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Error State
  // ══════════════════════════════════════════════════════════════════════════

  if (error || !campaign) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-linear-to-br from-slate-950 via-slate-900 to-slate-950 px-4">
        <div className="flex h-24 w-24 items-center justify-center rounded-full border border-rose-500/20 bg-rose-500/10">
          <XCircle className="h-12 w-12 text-rose-400" />
        </div>
        <h1 className="mt-6 text-2xl font-bold text-white">Campaign Not Available</h1>
        <p className="mt-2 text-center text-white/60">{error || "This campaign is no longer accepting donations."}</p>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Success State
  // ══════════════════════════════════════════════════════════════════════════

  if (step === "success") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-linear-to-br from-slate-950 via-slate-900 to-slate-950 px-4">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", duration: 0.6 }}
          className="flex h-28 w-28 items-center justify-center rounded-full bg-linear-to-br from-emerald-500/30 to-teal-500/30"
        >
          <CheckCircle className="h-14 w-14 text-emerald-400" />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-8 text-center"
        >
          <h1 className="text-3xl font-bold text-white">Thank You!</h1>
          <p className="mt-3 text-lg text-white/70">
            Your donation of {formatMoney(amountMinor, campaign.currency)} has been received.
          </p>
          <div className="mt-6 rounded-xl border border-white/10 bg-white/5 px-6 py-4">
            <p className="text-sm text-white/50">Receipt Number</p>
            <p className="mt-1 font-mono text-lg font-semibold text-emerald-400">{receiptNumber}</p>
          </div>
          <p className="mt-6 text-sm text-white/50">A confirmation email will be sent to {donorEmail}</p>
        </motion.div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Main Content
  // ══════════════════════════════════════════════════════════════════════════

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Hero Section */}
      <div className="relative">
        {campaign.coverImageUrl ? (
          <div className="relative h-64 w-full overflow-hidden sm:h-80">
            <img
              src={campaign.coverImageUrl}
              alt={campaign.title}
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-linear-to-t from-slate-950 via-slate-950/60 to-transparent" />
          </div>
        ) : (
          <div className="h-32 w-full bg-linear-to-r from-emerald-500/20 via-teal-500/20 to-cyan-500/20" />
        )}
      </div>

      {/* Content */}
      <div className="relative mx-auto max-w-2xl px-4 pb-12 pt-4">
        {/* Campaign Info Card */}
        <Card className="relative -mt-20 overflow-hidden rounded-3xl border border-white/10 bg-linear-to-br from-slate-900/95 via-slate-950/95 to-black/95 shadow-2xl backdrop-blur-xl">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,var(--tw-gradient-stops))] from-emerald-500/5 via-transparent to-transparent" />

          <CardHeader className="relative z-10 pb-4">
            <Badge className="mb-3 w-fit border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
              {campaign.category}
            </Badge>
            <CardTitle className="text-2xl leading-tight text-white sm:text-3xl">
              {campaign.title}
            </CardTitle>
            {campaign.summary && (
              <p className="mt-2 text-white/60">{campaign.summary}</p>
            )}
          </CardHeader>

          <CardContent className="relative z-10 space-y-6">
            {/* Progress Bar */}
            <div className="space-y-3">
              <div className="flex items-baseline justify-between">
                <div>
                  <span className="text-2xl font-bold text-emerald-400">
                    {formatMoney(campaign.raisedAmountMinor, campaign.currency)}
                  </span>
                  <span className="ml-2 text-white/50">raised</span>
                </div>
                <span className="text-sm text-white/50">
                  of {formatMoney(campaign.goalAmountMinor, campaign.currency)}
                </span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-white/10">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${campaign.progressPercent}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                  className="h-full rounded-full bg-linear-to-r from-emerald-500 to-teal-400"
                />
              </div>
              <div className="flex items-center justify-between text-sm text-white/50">
                <div className="flex items-center gap-1.5">
                  <Users className="h-4 w-4" />
                  <span>{campaign.donorCount} donors</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Target className="h-4 w-4" />
                  <span>{campaign.progressPercent}% funded</span>
                </div>
              </div>
            </div>

            {/* Milestones */}
            {campaign.milestones.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40">
                  Milestones
                </p>
                <div className="space-y-2">
                  {campaign.milestones.map((m) => (
                    <div
                      key={m.id}
                      className={cn(
                        "flex items-center gap-3 rounded-lg border px-3 py-2",
                        m.reached
                          ? "border-emerald-500/30 bg-emerald-500/10"
                          : "border-white/10 bg-white/5"
                      )}
                    >
                      <div
                        className={cn(
                          "flex h-5 w-5 items-center justify-center rounded-full",
                          m.reached ? "bg-emerald-500" : "border border-white/20 bg-transparent"
                        )}
                      >
                        {m.reached && <Check className="h-3 w-3 text-white" />}
                      </div>
                      <span className={cn("flex-1 text-sm", m.reached ? "text-emerald-300" : "text-white/70")}>
                        {m.label}
                      </span>
                      <span className="text-xs text-white/40">
                        {formatMoney(m.amountMinor, campaign.currency)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* End Date */}
            {campaign.schedule.endDate && (
              <div className="flex items-center gap-2 text-sm text-white/50">
                <Calendar className="h-4 w-4" />
                <span>
                  Ends {format(new Date(campaign.schedule.endDate), "MMM d, yyyy")}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Donation Form */}
        <AnimatePresence mode="wait">
          {step === "amount" && (
            <motion.div
              key="amount"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <Card className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 via-slate-950/80 to-black/80 shadow-xl backdrop-blur-xl">
                <CardHeader className="border-b border-white/5 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-emerald-500/20 to-teal-500/20">
                      <Gift className="h-5 w-5 text-emerald-400" />
                    </div>
                    <CardTitle className="text-lg text-white">Choose Amount</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6 pt-6">
                  {/* Suggested Amounts */}
                  <div className="grid grid-cols-3 gap-3">
                    {SUGGESTED_AMOUNTS.map((amt) => (
                      <button
                        key={amt}
                        onClick={() => handleAmountSelect(amt)}
                        className={cn(
                          "rounded-xl border py-3 text-center font-medium transition-all",
                          amountMinor === amt && !customAmount
                            ? "border-emerald-500 bg-emerald-500/20 text-emerald-300"
                            : "border-white/10 bg-white/5 text-white/70 hover:border-white/20 hover:bg-white/10"
                        )}
                      >
                        {formatMoney(amt, campaign.currency)}
                      </button>
                    ))}
                  </div>

                  {/* Custom Amount */}
                  <div>
                    <Label className="text-sm text-white/60">Or enter custom amount</Label>
                    <div className="relative mt-2">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40">
                        {campaign.currency}
                      </span>
                      <Input
                        type="number"
                        min="1"
                        step="0.01"
                        value={customAmount}
                        onChange={(e) => handleCustomAmountChange(e.target.value)}
                        placeholder="0.00"
                        className="border-white/10 bg-white/5 pl-14 text-lg text-white placeholder:text-white/30"
                      />
                    </div>
                  </div>

                  <Button
                    onClick={() => setStep("details")}
                    disabled={amountMinor < 100}
                    className="w-full gap-2 bg-linear-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-500 hover:to-teal-500"
                    size="lg"
                  >
                    Continue
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {step === "details" && (
            <motion.div
              key="details"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <Card className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 via-slate-950/80 to-black/80 shadow-xl backdrop-blur-xl">
                <CardHeader className="border-b border-white/5 pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-emerald-500/20 to-teal-500/20">
                        <User className="h-5 w-5 text-emerald-400" />
                      </div>
                      <CardTitle className="text-lg text-white">Your Details</CardTitle>
                    </div>
                    <button
                      onClick={() => setStep("amount")}
                      className="text-sm text-white/50 hover:text-white"
                    >
                      Change amount
                    </button>
                  </div>
                  <div className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2">
                    <Heart className="h-4 w-4 text-emerald-400" />
                    <span className="text-sm text-emerald-300">
                      Donating {formatMoney(amountMinor, campaign.currency)}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5 pt-6">
                  {/* Name */}
                  <div className="space-y-2">
                    <Label className="text-sm text-white/60">Full Name *</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                      <Input
                        value={donorName}
                        onChange={(e) => setDonorName(e.target.value)}
                        placeholder="John Doe"
                        className="border-white/10 bg-white/5 pl-10 text-white placeholder:text-white/30"
                      />
                    </div>
                  </div>

                  {/* Email */}
                  <div className="space-y-2">
                    <Label className="text-sm text-white/60">Email Address *</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                      <Input
                        type="email"
                        value={donorEmail}
                        onChange={(e) => setDonorEmail(e.target.value)}
                        placeholder="john@example.com"
                        className="border-white/10 bg-white/5 pl-10 text-white placeholder:text-white/30"
                      />
                    </div>
                  </div>

                  {/* Phone */}
                  <div className="space-y-2">
                    <Label className="text-sm text-white/60">Phone Number (optional)</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                      <Input
                        type="tel"
                        value={donorPhone}
                        onChange={(e) => setDonorPhone(e.target.value)}
                        placeholder="+233 XX XXX XXXX"
                        className="border-white/10 bg-white/5 pl-10 text-white placeholder:text-white/30"
                      />
                    </div>
                  </div>

                  {/* Message */}
                  <div className="space-y-2">
                    <Label className="text-sm text-white/60">Leave a message (optional)</Label>
                    <Textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Share why you're supporting this cause..."
                      maxLength={500}
                      className="min-h-[80px] resize-none border-white/10 bg-white/5 text-white placeholder:text-white/30"
                    />
                    <p className="text-right text-xs text-white/30">{message.length}/500</p>
                  </div>

                  {/* Anonymous Toggle */}
                  {campaign.allowAnonymousDonations && (
                    <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-4">
                      <div>
                        <p className="font-medium text-white">Make this donation anonymous</p>
                        <p className="text-sm text-white/50">Your name won&apos;t be shown publicly</p>
                      </div>
                      <Switch checked={isAnonymous} onCheckedChange={setIsAnonymous} />
                    </div>
                  )}

                  <Button
                    onClick={handleSubmit}
                    disabled={submitting || !donorName.trim() || !donorEmail.trim()}
                    className="w-full gap-2 bg-linear-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-500 hover:to-teal-500"
                    size="lg"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        Complete Donation
                        <ChevronRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>

                  <p className="text-center text-xs text-white/40">
                    By donating, you agree to our terms and privacy policy.
                    <br />
                    Your donation receipt will be sent to your email.
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Recent Donors */}
        {campaign.recentDonors.length > 0 && (
          <Card className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/60 via-slate-950/60 to-black/60 shadow-lg">
            <CardHeader className="border-b border-white/5 pb-3">
              <CardTitle className="text-sm font-medium text-white/60">Recent Supporters</CardTitle>
            </CardHeader>
            <CardContent className="divide-y divide-white/5 p-0">
              {campaign.recentDonors.slice(0, 5).map((donor, i) => (
                <div key={i} className="flex items-center gap-3 px-5 py-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-linear-to-br from-violet-500/20 to-purple-500/20">
                    <Heart className="h-4 w-4 text-violet-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">{donor.name}</p>
                    <p className="text-xs text-white/40">
                      {formatDistanceToNow(new Date(donor.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                  <span className="text-sm font-medium text-emerald-400">
                    {formatMoney(donor.amountMinor, campaign.currency)}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
