// src/app/(app)/admin/community/fundraising/[id]/donations/page.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { format } from "date-fns/format";
import { formatDistanceToNow } from "date-fns/formatDistanceToNow";
import {
  ArrowLeft,
  Banknote,
  Building,
  CreditCard,
  Download,
  FileText,
  Heart,
  Loader2,
  MoreHorizontal,
  Search,
  Smartphone,
  User,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import {
  useFundraisingCampaign,
  useCampaignDonations,
  useExportCampaignDonations,
  DonationDTO,
  DonationStatus,
  PaymentMethod,
} from "@/hooks/admin/useFundraisingCampaigns";
import { useBusyToast } from "@/hooks/useBusyToast";
import { formatMoney } from "@/lib/fees/money";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ============================================================================
// Constants
// ============================================================================

const STATUS_STYLES: Record<DonationStatus, string> = {
  pending: "border-amber-500/30 bg-amber-500/10 text-amber-200",
  completed: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  failed: "border-rose-500/30 bg-rose-500/10 text-rose-200",
  refunded: "border-slate-500/30 bg-slate-500/10 text-slate-300",
};

const PAYMENT_ICONS: Record<PaymentMethod, React.ElementType> = {
  cash: Banknote,
  bank_transfer: Building,
  mobile_money: Smartphone,
  paystack: CreditCard,
  stripe: CreditCard,
  cheque: FileText,
  other: MoreHorizontal,
};

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: "Cash",
  bank_transfer: "Bank Transfer",
  mobile_money: "Mobile Money",
  paystack: "Paystack",
  stripe: "Stripe",
  cheque: "Cheque",
  other: "Other",
};

// ============================================================================
// Donation Row Component
// ============================================================================

function DonationRow({ donation, currency }: { donation: DonationDTO; currency: string }) {
  const PaymentIcon = PAYMENT_ICONS[donation.paymentMethod] || MoreHorizontal;
  const donorName = donation.isAnonymous
    ? "Anonymous"
    : donation.donorUser?.name || donation.donorName || "Unknown Donor";

  return (
    <div className="group flex items-center gap-4 rounded-xl border border-white/5 bg-white/2 p-4 transition-colors hover:bg-white/5">
      {/* Avatar */}
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-emerald-500/20 to-teal-500/20">
        {donation.isAnonymous ? (
          <Heart className="h-5 w-5 text-emerald-400" />
        ) : (
          <User className="h-5 w-5 text-emerald-400" />
        )}
      </div>

      {/* Donor Info */}
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-white">{donorName}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-white/50">
          {!donation.isAnonymous && donation.donorEmail && (
            <span className="truncate">{donation.donorEmail}</span>
          )}
          {!donation.isAnonymous && donation.donorPhone && (
            <>
              <span>·</span>
              <span>{donation.donorPhone}</span>
            </>
          )}
        </div>
        {donation.message && (
          <p className="mt-1 line-clamp-1 text-sm text-white/40 italic">
            &ldquo;{donation.message}&rdquo;
          </p>
        )}
      </div>

      {/* Payment Method */}
      <div className="hidden items-center gap-2 text-sm text-white/50 sm:flex">
        <PaymentIcon className="h-4 w-4" />
        <span>{PAYMENT_LABELS[donation.paymentMethod]}</span>
      </div>

      {/* Date */}
      <div className="hidden text-right md:block">
        <p className="text-sm text-white/60">
          {formatDistanceToNow(new Date(donation.createdAt), { addSuffix: true })}
        </p>
        <p className="text-xs text-white/40">
          {format(new Date(donation.createdAt), "MMM d, yyyy")}
        </p>
      </div>

      {/* Amount & Status */}
      <div className="text-right">
        <p className="font-semibold text-emerald-400">
          {formatMoney(donation.amountMinor, donation.currency || currency)}
        </p>
        <Badge className={cn("mt-1 text-[10px]", STATUS_STYLES[donation.status])}>
          {donation.status}
        </Badge>
      </div>
    </div>
  );
}

// ============================================================================
// Main Page
// ============================================================================

export default function CampaignDonationsPage() {
  const params = useParams();
  const campaignId = params.id as string;

  const [statusFilter, setStatusFilter] = React.useState<DonationStatus | "all">("all");
  const [searchQuery, setSearchQuery] = React.useState("");

  const { data: campaign, isLoading: campaignLoading, isError: campaignError } = useFundraisingCampaign(campaignId);
  const { data: donationsData, isLoading: donationsLoading } = useCampaignDonations(
    campaignId,
    { status: statusFilter === "all" ? undefined : statusFilter, limit: 100 }
  );

  const exportMutation = useExportCampaignDonations();
  const busyToast = useBusyToast();

  const handleExport = async () => {
    busyToast.show("Exporting donations...");
    try {
      await exportMutation.mutateAsync(campaignId);
      toast.success("Donations exported successfully");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to export donations");
    } finally {
      busyToast.hide();
    }
  };

  // Filter donations by search query
  const filteredDonations = React.useMemo(() => {
    const donations = donationsData?.data || [];
    if (!searchQuery.trim()) return donations;

    const query = searchQuery.toLowerCase();
    return donations.filter((d) => {
      const name = (d.donorName || d.donorUser?.name || "").toLowerCase();
      const email = (d.donorEmail || d.donorUser?.email || "").toLowerCase();
      const phone = (d.donorPhone || "").toLowerCase();
      return name.includes(query) || email.includes(query) || phone.includes(query);
    });
  }, [donationsData?.data, searchQuery]);

  if (campaignLoading) {
    return (
      <div className="space-y-8">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-xl bg-white/10" />
          <Skeleton className="h-8 w-64 bg-white/10" />
        </div>
        <Skeleton className="h-96 rounded-2xl bg-white/5" />
      </div>
    );
  }

  if (campaignError || !campaign) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24">
        <div className="flex h-20 w-20 items-center justify-center rounded-full border border-rose-500/20 bg-rose-500/10">
          <XCircle className="h-10 w-10 text-rose-400" />
        </div>
        <div className="text-center">
          <p className="text-lg font-medium text-white/80">Campaign not found</p>
          <p className="mt-1 text-sm text-white/50">This campaign may have been deleted</p>
        </div>
        <Link href="/admin/community/fundraising">
          <Button variant="outline" className="mt-2 gap-2 border-white/10 bg-white/5 text-white hover:bg-white/10">
            <ArrowLeft className="h-4 w-4" />
            Back to Campaigns
          </Button>
        </Link>
      </div>
    );
  }

  const totals = donationsData?.totals;

  return (
    <div className="space-y-8">
      {/* ══════════════════════════════════════════════════════════════════════
          Header
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/admin/community/fundraising/${campaignId}`}>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-xl border border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white">Donations</h1>
            <p className="text-sm text-white/50">{campaign.title}</p>
          </div>
        </div>

        <Button
          onClick={handleExport}
          disabled={exportMutation.isPending || !donationsData?.data.length}
          className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          Stats Cards
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-white/5 to-transparent p-5">
          <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-emerald-500/10 via-emerald-500/5 to-transparent" />
          <div className="relative z-10">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/50">Total Raised</p>
            <p className="mt-1 text-3xl font-bold text-emerald-400">
              {formatMoney(totals?.raisedAmountMinor || 0, totals?.currency || campaign.currency)}
            </p>
          </div>
        </div>
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-white/5 to-transparent p-5">
          <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-violet-500/10 via-violet-500/5 to-transparent" />
          <div className="relative z-10">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/50">Total Donors</p>
            <p className="mt-1 text-3xl font-bold text-white">{totals?.donorCount || 0}</p>
          </div>
        </div>
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-white/5 to-transparent p-5">
          <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-amber-500/10 via-amber-500/5 to-transparent" />
          <div className="relative z-10">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/50">Avg. Donation</p>
            <p className="mt-1 text-3xl font-bold text-white">
              {totals && totals.donorCount > 0
                ? formatMoney(Math.round(totals.raisedAmountMinor / totals.donorCount), totals.currency)
                : formatMoney(0, campaign.currency)}
            </p>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          Filters
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, email, or phone..."
            className="border-white/10 bg-white/5 pl-10 text-white placeholder:text-white/40"
          />
        </div>
        <PremiumSelect value={statusFilter} onValueChange={(v) => setStatusFilter(v as DonationStatus | "all")}>
          <PremiumSelectTrigger className="w-full sm:w-48">
            <PremiumSelectValue placeholder="Filter by status" />
          </PremiumSelectTrigger>
          <PremiumSelectContent>
            <PremiumSelectItem value="all">All Statuses</PremiumSelectItem>
            <PremiumSelectItem value="completed">Completed</PremiumSelectItem>
            <PremiumSelectItem value="pending">Pending</PremiumSelectItem>
            <PremiumSelectItem value="failed">Failed</PremiumSelectItem>
            <PremiumSelectItem value="refunded">Refunded</PremiumSelectItem>
          </PremiumSelectContent>
        </PremiumSelect>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          Donations List
      ══════════════════════════════════════════════════════════════════════ */}
      <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 via-slate-950/90 to-black shadow-xl">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,var(--tw-gradient-stops))] from-emerald-500/5 via-transparent to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/10 to-transparent" />

        <CardHeader className="relative z-10 border-b border-white/5 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-linear-to-br from-emerald-500/20 to-teal-500/20">
              <Heart className="h-5 w-5 text-emerald-400" />
            </div>
            <CardTitle className="text-lg text-white">
              {filteredDonations.length} Donation{filteredDonations.length !== 1 ? "s" : ""}
            </CardTitle>
          </div>
        </CardHeader>

        <CardContent className="relative z-10 p-6">
          {donationsLoading ? (
            <div className="flex flex-col items-center justify-center gap-4 py-12">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
              <p className="text-sm text-white/60">Loading donations...</p>
            </div>
          ) : filteredDonations.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 py-12">
              <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/5">
                <Heart className="h-8 w-8 text-white/30" />
              </div>
              <div className="text-center">
                <p className="font-medium text-white/80">
                  {searchQuery ? "No donations match your search" : "No donations yet"}
                </p>
                <p className="mt-1 text-sm text-white/50">
                  {searchQuery ? "Try adjusting your search terms" : "Donations will appear here once received"}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredDonations.map((donation) => (
                <DonationRow key={donation.id} donation={donation} currency={campaign.currency} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
