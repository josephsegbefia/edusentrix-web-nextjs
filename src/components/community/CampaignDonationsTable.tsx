// src/components/community/CampaignDonationsTable.tsx
"use client";

import * as React from "react";
import { formatDistanceToNow } from "date-fns/formatDistanceToNow";
import { format } from "date-fns/format";
import {
  Banknote,
  CreditCard,
  Smartphone,
  Building,
  FileText,
  MoreHorizontal,
  User,
  Eye,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/fees/money";
import { DonationDTO, DonationStatus, PaymentMethod } from "@/hooks/admin/useFundraisingCampaigns";

// ============================================================================
// Types
// ============================================================================

interface CampaignDonationsTableProps {
  donations: DonationDTO[];
  currency: string;
  isLoading?: boolean;
  onViewDetails?: (donation: DonationDTO) => void;
  className?: string;
}

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

// ============================================================================
// Main Component
// ============================================================================

export default function CampaignDonationsTable({
  donations,
  currency,
  isLoading = false,
  onViewDetails,
  className,
}: CampaignDonationsTableProps) {
  if (isLoading) {
    return (
      <div className={cn("rounded-xl border border-white/10 bg-white/5 p-8", className)}>
        <div className="flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-white/40" />
        </div>
      </div>
    );
  }

  if (donations.length === 0) {
    return (
      <div className={cn("rounded-xl border border-white/10 bg-white/5 p-8", className)}>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Banknote className="h-10 w-10 text-white/20" />
          <p className="mt-2 text-sm text-white/50">No donations yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("overflow-hidden rounded-xl border border-white/10", className)}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-white/5">
            <tr>
              <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/50">
                Donor
              </th>
              <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/50">
                Amount
              </th>
              <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/50">
                Method
              </th>
              <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/50">
                Status
              </th>
              <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/50">
                Date
              </th>
              {onViewDetails && (
                <th className="whitespace-nowrap px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-white/50">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {donations.map((donation) => {
              const PaymentIcon = PAYMENT_ICONS[donation.paymentMethod] || MoreHorizontal;
              const donorName = donation.isAnonymous
                ? "Anonymous"
                : donation.donorUser?.name || donation.donorName || "Unknown";

              return (
                <tr
                  key={donation.id}
                  className="transition-colors hover:bg-white/5"
                >
                  {/* Donor */}
                  <td className="whitespace-nowrap px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10">
                        <User className="h-4 w-4 text-white/50" />
                      </div>
                      <div>
                        <div className="font-medium text-white">
                          {donorName}
                        </div>
                        {!donation.isAnonymous && donation.donorEmail && (
                          <div className="text-xs text-white/40">
                            {donation.donorEmail}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Amount */}
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className="font-semibold text-emerald-400">
                      {formatMoney(donation.amountMinor, donation.currency || currency)}
                    </span>
                    {donation.message && (
                      <div className="mt-0.5 max-w-32 truncate text-xs text-white/40">
                        &ldquo;{donation.message}&rdquo;
                      </div>
                    )}
                  </td>

                  {/* Payment Method */}
                  <td className="whitespace-nowrap px-4 py-3">
                    <div className="flex items-center gap-2 text-sm text-white/60">
                      <PaymentIcon className="h-4 w-4" />
                      <span className="capitalize">
                        {donation.paymentMethod.replaceAll("_", " ")}
                      </span>
                    </div>
                  </td>

                  {/* Status */}
                  <td className="whitespace-nowrap px-4 py-3">
                    <Badge className={cn("text-xs", STATUS_STYLES[donation.status])}>
                      {donation.status}
                    </Badge>
                  </td>

                  {/* Date */}
                  <td className="whitespace-nowrap px-4 py-3">
                    <div className="text-sm text-white/60">
                      {formatDistanceToNow(new Date(donation.createdAt), { addSuffix: true })}
                    </div>
                    <div className="text-xs text-white/40">
                      {format(new Date(donation.createdAt), "MMM d, yyyy")}
                    </div>
                  </td>

                  {/* Actions */}
                  {onViewDetails && (
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onViewDetails(donation)}
                        className="gap-1 text-white/50 hover:text-white"
                      >
                        <Eye className="h-4 w-4" />
                        View
                      </Button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
