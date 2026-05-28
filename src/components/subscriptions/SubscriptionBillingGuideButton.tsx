"use client";

import * as React from "react";
import { BookOpen, FileDown } from "lucide-react";
import { ResponsiveModal } from "@/components/ui/responsive-modal";
import { glassInsetClass } from "@/lib/ui/glass-surfaces";
import {
  SUBSCRIPTION_BILLING_GUIDE_SECTIONS,
  SUBSCRIPTION_BILLING_GUIDE_TITLE,
} from "@/lib/subscriptions/billing-guide";
import { cn } from "@/lib/utils";

export function SubscriptionBillingGuideButton({
  pdfHref,
  className,
}: {
  pdfHref: string;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white/65 transition hover:bg-white/10 hover:text-white",
          className
        )}
      >
        <BookOpen className="h-3.5 w-3.5" />
        Subscription guide
      </button>

      <ResponsiveModal
        open={open}
        onOpenChange={setOpen}
        title={SUBSCRIPTION_BILLING_GUIDE_TITLE}
        description="How annual coverage, term billing, upgrades, downgrades, and minimum fees are calculated."
        className="sm:max-w-3xl"
      >
        <div className="space-y-4">
          <div className={cn(glassInsetClass, "px-4 py-3")}>
            <p className="text-sm font-semibold text-white">EduSentrix billing is term-based.</p>
            <p className="mt-1 text-xs leading-relaxed text-white/45">
              Academic periods improve labels and dates, but billing does not fail when a school has not
              configured every term. EduSentrix stores a coverage snapshot for each subscription and invoice.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {SUBSCRIPTION_BILLING_GUIDE_SECTIONS.map((section, index) => (
              <div key={section.title} className={cn(glassInsetClass, "px-4 py-3")}>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-cyan-200/70">
                  {String(index + 1).padStart(2, "0")}
                </p>
                <h3 className="mt-1 text-sm font-semibold text-white">{section.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-white/45">{section.body}</p>
              </div>
            ))}
          </div>

          <a
            href={pdfHref}
            className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/25 bg-cyan-400/10 px-4 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-400/15"
          >
            <FileDown className="h-3.5 w-3.5" />
            Download PDF guide
          </a>
        </div>
      </ResponsiveModal>
    </>
  );
}
