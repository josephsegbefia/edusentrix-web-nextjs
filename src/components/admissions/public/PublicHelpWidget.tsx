"use client";

import * as React from "react";
import { ChevronDown, HelpCircle, Mail, MessageCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";

type PublicHelpWidgetProps = {
  schoolName: string;
  contactEmail?: string | null;
  contactPhone?: string | null;
  whatsAppLink?: string | null;
  /** Optional cycle name for context-aware copy. */
  cycleName?: string | null;
};

type FaqItem = {
  q: string;
  a: string;
};

function buildFaqs(args: {
  schoolName: string;
  contactEmail?: string | null;
  cycleName?: string | null;
}): FaqItem[] {
  const contact = args.contactEmail
    ? `email ${args.contactEmail}`
    : `contact the admissions office`;
  return [
    {
      q: "How long does the application take?",
      a: "Most families finish in 10–15 minutes. You can leave the page mid-way and return — make sure to bookmark the link first.",
    },
    {
      q: "Which documents do I need?",
      a: "The form lists the required and optional uploads. Birth certificate is usually required; transcripts/report cards are typical for older grades. PDFs are best.",
    },
    {
      q: "I made a mistake after submitting. What now?",
      a: `${args.schoolName} reviewers can correct most fields. ${contact[0].toUpperCase() + contact.slice(1)} with the reference code shown on your tracker page.`,
    },
    {
      q: "When will I hear back?",
      a:
        "You'll get an email decision once the admissions team finalizes their review. The tracker page also reflects the latest status.",
    },
    {
      q: "Can I apply for more than one child?",
      a:
        "Yes — submit one application per child. Use the same guardian email so we can group them.",
    },
    {
      q: args.cycleName
        ? `Is the ${args.cycleName} my only chance?`
        : "Are there other intakes?",
      a: `${args.schoolName} usually opens new cycles each academic year. ${contact[0].toUpperCase() + contact.slice(1)} to ask about future intakes.`,
    },
  ];
}

export function PublicHelpWidget(props: PublicHelpWidgetProps) {
  const [open, setOpen] = React.useState(false);
  const [openIdx, setOpenIdx] = React.useState<number | null>(0);
  const faqs = React.useMemo(() => buildFaqs(props), [props]);

  return (
    <div className="fixed bottom-4 right-4 z-50 print:hidden">
      {open ? (
        <div className="w-[20rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <header className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600/10 text-blue-600">
                <HelpCircle className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Need help applying?
                </p>
                <p className="text-[11px] text-slate-500">
                  Quick answers · {props.schoolName}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close help"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          <div className="max-h-80 overflow-y-auto">
            <ul className="divide-y divide-slate-100">
              {faqs.map((item, idx) => {
                const isOpen = openIdx === idx;
                return (
                  <li key={item.q}>
                    <button
                      type="button"
                      onClick={() => setOpenIdx(isOpen ? null : idx)}
                      className="flex w-full items-start justify-between gap-2 px-4 py-3 text-left hover:bg-slate-50"
                      aria-expanded={isOpen}
                    >
                      <span className="text-xs font-semibold text-slate-800">
                        {item.q}
                      </span>
                      <ChevronDown
                        className={cn(
                          "h-3.5 w-3.5 shrink-0 text-slate-400 transition",
                          isOpen && "rotate-180 text-slate-700"
                        )}
                      />
                    </button>
                    {isOpen ? (
                      <p className="px-4 pb-3 text-xs leading-relaxed text-slate-600">
                        {item.a}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>

          <footer className="space-y-1 border-t border-slate-100 bg-slate-50 px-4 py-3 text-[11px]">
            <p className="font-semibold text-slate-700">Still stuck?</p>
            {props.contactEmail ? (
              <a
                href={`mailto:${props.contactEmail}?subject=${encodeURIComponent(`Admissions help — ${props.cycleName ?? props.schoolName}`)}`}
                className="flex items-center gap-1.5 text-blue-600 hover:underline"
              >
                <Mail className="h-3 w-3" />
                {props.contactEmail}
              </a>
            ) : null}
            {props.whatsAppLink ? (
              <a
                href={props.whatsAppLink}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-emerald-600 hover:underline"
              >
                <MessageCircle className="h-3 w-3" />
                Chat on WhatsApp
              </a>
            ) : null}
            {props.contactPhone ? (
              <p className="text-slate-500">Call {props.contactPhone}</p>
            ) : null}
          </footer>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:bg-blue-700"
          aria-label="Open help"
        >
          <HelpCircle className="h-4 w-4" />
          Need help?
        </button>
      )}
    </div>
  );
}
