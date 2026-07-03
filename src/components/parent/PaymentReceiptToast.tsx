"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { CheckCircle2, Download, Eye, Receipt, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/fees/money";

export type PaymentReceiptToastOptions = {
  /** Heading shown on the toast. Defaults to "Payment confirmed". */
  title?: string;
  /** Optional supporting line below the title. */
  description?: string;
  /** Amount paid in minor units (kobo / pesewas). Renders in title row when provided. */
  amountMinor?: number | null;
  /** Ward / payer label rendered as a chip. */
  subjectLabel?: string | null;
  /** Receipt reference (e.g. RCP-000123). Optional. */
  receiptReference?: string | null;
  /** Inline view URL (opens in new tab). */
  receiptViewUrl?: string | null;
  /** Direct PDF download URL. */
  receiptDownloadUrl?: string | null;
  /** How long the toast stays up (ms). Defaults to 14s so the user can act. */
  durationMs?: number;
};

function ReceiptToastCard({
  id,
  options,
}: {
  id: string | number;
  options: PaymentReceiptToastOptions;
}) {
  const {
    title = "Payment confirmed",
    description,
    amountMinor,
    subjectLabel,
    receiptReference,
    receiptViewUrl,
    receiptDownloadUrl,
  } = options;

  const amountLabel =
    typeof amountMinor === "number" && Number.isFinite(amountMinor)
      ? formatMoney(amountMinor)
      : null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "relative w-[min(94vw,440px)] overflow-hidden rounded-2xl",
        "border border-white/10",
        "bg-linear-to-br from-slate-900/95 via-slate-950/95 to-black",
        "shadow-2xl shadow-black/40 backdrop-blur-xl"
      )}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/15 to-transparent"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-emerald-500/15 blur-3xl"
      />

      <button
        type="button"
        onClick={() => toast.dismiss(id)}
        className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/60 transition hover:bg-white/10 hover:text-white"
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      <div className="relative z-10 flex items-start gap-3 px-4 pb-3 pt-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/15">
          <CheckCircle2 className="h-5 w-5 text-emerald-300" />
        </div>
        <div className="min-w-0 flex-1 pr-6">
          <div className="flex items-baseline justify-between gap-3">
            <p className="truncate text-sm font-semibold text-white">{title}</p>
            {amountLabel ? (
              <span className="shrink-0 text-sm font-bold tracking-tight text-emerald-200">
                {amountLabel}
              </span>
            ) : null}
          </div>
          {description ? (
            <p className="mt-1 text-xs leading-relaxed text-white/65">{description}</p>
          ) : null}
          {(subjectLabel || receiptReference) && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {subjectLabel ? (
                <span className="inline-flex max-w-[200px] items-center gap-1 truncate rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-white/70">
                  {subjectLabel}
                </span>
              ) : null}
              {receiptReference ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-white/60">
                  <Receipt className="h-3 w-3" />
                  {receiptReference}
                </span>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {(receiptViewUrl || receiptDownloadUrl) && (
        <div className="relative z-10 flex items-center gap-2 border-t border-white/10 bg-white/5 px-4 py-2.5">
          {receiptViewUrl ? (
            <Link
              href={receiptViewUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => toast.dismiss(id)}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/85 transition hover:bg-white/10 hover:text-white"
            >
              <Eye className="h-3.5 w-3.5" />
              View receipt
            </Link>
          ) : null}
          {receiptDownloadUrl ? (
            <Link
              href={receiptDownloadUrl}
              onClick={() => toast.dismiss(id)}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-emerald-400/40 bg-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-500/30 hover:text-white"
            >
              <Download className="h-3.5 w-3.5" />
              Download PDF
            </Link>
          ) : null}
        </div>
      )}
    </div>
  );
}

/**
 * Shows a glassy success toast for completed payments with optional
 * View and Download receipt actions. Falls back gracefully when URLs
 * are not yet available.
 */
export function showPaymentReceiptToast(options: PaymentReceiptToastOptions) {
  const duration = options.durationMs ?? 14_000;
  return toast.custom(
    (id) => <ReceiptToastCard id={id} options={options} />,
    { duration, unstyled: true, className: "bg-transparent p-0 shadow-none border-0" }
  );
}
