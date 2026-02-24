"use client";

import * as React from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Clock,
  Download,
  FileSpreadsheet,
  HelpCircle,
  Link2,
  Link2Off,
  RefreshCw,
  Search,
  Shield,
  Sparkles,
  AlertTriangle,
  XCircle,
  Lightbulb,
  Zap,
} from "lucide-react";

function Section({
  title,
  icon: Icon,
  children,
  defaultOpen = false,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = React.useState(defaultOpen);

  return (
    <div className="rounded-xl border border-white/10 bg-white/2">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-white/3"
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10">
          <Icon className="h-4 w-4 text-indigo-400" />
        </div>
        <span className="flex-1 text-sm font-medium text-white">{title}</span>
        <ChevronDown
          className={`h-4 w-4 text-white/30 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="border-t border-white/5 px-4 py-4 text-[13px] leading-relaxed text-white/60">
          {children}
        </div>
      )}
    </div>
  );
}

function StepItem({
  step,
  title,
  children,
}: {
  step: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-xs font-bold text-indigo-300">
        {step}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-white/80">{title}</p>
        <div className="mt-1 text-[13px] text-white/50">{children}</div>
      </div>
    </div>
  );
}

function ExampleBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 rounded-lg border border-indigo-500/15 bg-indigo-500/5 px-3 py-2.5 text-[12px] text-indigo-200/80">
      <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-indigo-300/60">
        <Lightbulb className="h-3 w-3" />
        Example
      </div>
      {children}
    </div>
  );
}

function StatusBadgeDemo({
  label,
  className,
}: {
  label: string;
  className: string;
}) {
  return (
    <Badge variant="outline" className={`text-[10px] ${className}`}>
      {label}
    </Badge>
  );
}

export function ReconciliationHelpDrawer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto border-white/10 bg-black/90 backdrop-blur sm:max-w-xl">
        <SheetHeader className="pb-2">
          <SheetTitle className="flex items-center gap-2.5 text-white">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-linear-to-br from-indigo-500/20 to-violet-600/20">
              <BookOpen className="h-5 w-5 text-indigo-400" />
            </div>
            Reconciliation Help
          </SheetTitle>
          <p className="text-sm text-white/40">
            Learn how to match your payment records against external evidence.
          </p>
        </SheetHeader>

        <div className="mt-4 space-y-3 pb-8">
          {/* What is Reconciliation */}
          <Section title="What is reconciliation?" icon={Shield} defaultOpen>
            <p>
              Reconciliation is the process of <span className="text-white/80">verifying that the payments recorded in
              your system match the actual money received</span> in your bank account or payment
              gateway (like Paystack).
            </p>
            <p className="mt-2">
              This ensures every payment you see in Edusentrix truly arrived,
              helping you catch discrepancies, fraud, or technical errors early.
            </p>
            <ExampleBox>
              A parent pays GHS 500 via Paystack. The gateway shows the transaction, and
              Edusentrix records a payment. Reconciliation confirms both records match
              — same amount, same reference, same date.
            </ExampleBox>
          </Section>

          {/* How It Works */}
          <Section title="How does it work?" icon={Zap}>
            <div className="space-y-4">
              <StepItem step={1} title="Import external evidence">
                Upload data from Paystack settlements, bank statements, or mobile money
                records. Use the <strong className="text-white/70">Import Data</strong> button to
                upload a CSV file or paste entries manually.
              </StepItem>
              <StepItem step={2} title="Automatic matching runs">
                The system automatically tries to match each imported row to an existing
                payment using references, amounts, and dates. This produces a confidence
                score for each match.
              </StepItem>
              <StepItem step={3} title="Review and resolve">
                Items that couldn&apos;t be matched or have multiple candidates need your
                manual review. You can match them to the correct payment or investigate
                the discrepancy.
              </StepItem>
            </div>
            <ExampleBox>
              You download your Paystack settlement CSV and import it. The system
              automatically matches 47 out of 50 rows. 2 are flagged as ambiguous
              (multiple possible matches), and 1 is unmatched. You review the 3
              exceptions manually.
            </ExampleBox>
          </Section>

          {/* Understanding Statuses */}
          <Section title="Understanding statuses" icon={HelpCircle}>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <StatusBadgeDemo label="Unmatched" className="border-rose-500/25 bg-rose-500/10 text-rose-300" />
                <p className="flex-1">
                  No matching payment found yet. Could mean the payment hasn&apos;t been recorded,
                  or the reference doesn&apos;t match. Needs investigation.
                </p>
              </div>
              <Separator className="bg-white/5" />
              <div className="flex items-start gap-3">
                <StatusBadgeDemo label="Needs review" className="border-amber-500/25 bg-amber-500/10 text-amber-300" />
                <p className="flex-1">
                  Multiple possible payment matches were found. You need to review the
                  candidates and manually select the correct one.
                </p>
              </div>
              <Separator className="bg-white/5" />
              <div className="flex items-start gap-3">
                <StatusBadgeDemo label="Matched" className="border-emerald-500/25 bg-emerald-500/10 text-emerald-300" />
                <p className="flex-1">
                  Successfully matched to a payment record — either automatically (high
                  confidence) or manually confirmed by you.
                </p>
              </div>
              <Separator className="bg-white/5" />
              <div className="flex items-start gap-3">
                <StatusBadgeDemo label="Ignored" className="border-white/10 bg-white/5 text-white/50" />
                <p className="flex-1">
                  Deliberately excluded from reconciliation — e.g., a test transaction,
                  a refund already handled, or a duplicate row.
                </p>
              </div>
            </div>
          </Section>

          {/* Importing Data */}
          <Section title="Importing data" icon={FileSpreadsheet}>
            <p>Click <strong className="text-white/70">Import Data</strong> in the header to open the import modal.</p>
            <p className="mt-2 font-medium text-white/70">Supported sources:</p>
            <ul className="mt-1.5 list-inside list-disc space-y-1">
              <li><strong className="text-white/70">Paystack</strong> — Export your settlement report from the Paystack dashboard as CSV</li>
              <li><strong className="text-white/70">Bank statement</strong> — Download your bank statement in CSV format</li>
              <li><strong className="text-white/70">Manual</strong> — Enter individual transaction details directly</li>
            </ul>
            <p className="mt-3 font-medium text-white/70">CSV format:</p>
            <p className="mt-1">
              Your CSV should include columns for: transaction ID, reference, amount, date,
              and optionally payer name. The system will guide you through column mapping.
            </p>
            <ExampleBox>
              <code className="block rounded bg-black/40 px-2 py-1.5 font-mono text-[11px] text-white/60">
                txn_id,reference,amount,date,payer{"\n"}
                PSK_abc123,PSK-26-000042,50000,2026-02-20,Jane Doe{"\n"}
                PSK_def456,PSK-26-000043,75000,2026-02-20,John Smith
              </code>
              <p className="mt-1.5">Amounts should be in minor units (pesewas). GHS 500 = 50000.</p>
            </ExampleBox>
          </Section>

          {/* Running Reconciliation */}
          <Section title="Running reconciliation" icon={Sparkles}>
            <p>There are two ways the reconciliation engine runs:</p>
            <div className="mt-3 space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10">
                  <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white/70">Manual</p>
                  <p className="mt-0.5">
                    Click <strong className="text-white/70">Run Reconciliation</strong> to
                    immediately process all unmatched items. You can add an optional note
                    in the Run History tab.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10">
                  <Clock className="h-3.5 w-3.5 text-indigo-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white/70">Scheduled</p>
                  <p className="mt-0.5">
                    A scheduled job runs automatically (if configured by your administrator)
                    to keep the queue fresh without manual intervention.
                  </p>
                </div>
              </div>
            </div>
            <ExampleBox>
              After importing your Monday bank statement, click &quot;Run Reconciliation&quot;.
              The engine processes all rows in seconds and shows results in the queue —
              most items turn green (matched), a few may need your review.
            </ExampleBox>
          </Section>

          {/* Manual Matching */}
          <Section title="Manual matching & unmatching" icon={Link2}>
            <p>When automatic matching can&apos;t find a definitive match, you step in:</p>
            <div className="mt-3 space-y-4">
              <StepItem step={1} title="Expand the item">
                Click any row in the Ingestion Queue to expand its details. You&apos;ll see
                the amount, reference, source, and any candidate matches the system found.
              </StepItem>
              <StepItem step={2} title="Select or enter a payment ID">
                If candidates are shown, click one to auto-fill. Otherwise, find the correct
                payment ID from the Fees section and paste it into the input field.
              </StepItem>
              <StepItem step={3} title="Confirm the match">
                Click the <strong className="text-white/70">Match</strong> button. The item turns
                green and the payment&apos;s reconciliation status updates accordingly.
              </StepItem>
            </div>
            <Separator className="my-3 bg-white/5" />
            <p className="font-medium text-white/70">Removing a match:</p>
            <p className="mt-1">
              If a match was made in error, expand the matched item and click{" "}
              <strong className="text-white/70">Remove match</strong>. The item returns to the
              unmatched state so you can re-match it correctly.
            </p>
            <ExampleBox>
              An ambiguous row shows 2 candidate payments — GHS 200 for student A and
              GHS 200 for student B. You check the reference &quot;BNK-26-000015&quot; against
              your bank statement, identify it&apos;s for student A, click the candidate,
              and hit Match.
            </ExampleBox>
          </Section>

          {/* Confidence Scores */}
          <Section title="Confidence scores" icon={Search}>
            <p>
              Each match attempt produces a confidence score (0–100%) based on how many
              identifiers align between the ingested row and the payment:
            </p>
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between rounded-lg border border-white/5 bg-white/2 px-3 py-2">
                <span className="text-white/70">Exact reference match</span>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-12 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full w-full rounded-full bg-emerald-500" />
                  </div>
                  <span className="text-xs font-semibold text-emerald-300">95–100%</span>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-white/5 bg-white/2 px-3 py-2">
                <span className="text-white/70">Reference token + amount match</span>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-12 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full w-[85%] rounded-full bg-emerald-500" />
                  </div>
                  <span className="text-xs font-semibold text-emerald-300">80–95%</span>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-white/5 bg-white/2 px-3 py-2">
                <span className="text-white/70">Amount + date window match</span>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-12 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full w-[65%] rounded-full bg-amber-500" />
                  </div>
                  <span className="text-xs font-semibold text-amber-300">60–80%</span>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-white/5 bg-white/2 px-3 py-2">
                <span className="text-white/70">Multiple candidates (ambiguous)</span>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-12 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full w-[40%] rounded-full bg-rose-500" />
                  </div>
                  <span className="text-xs font-semibold text-rose-300">&lt;60%</span>
                </div>
              </div>
            </div>
          </Section>

          {/* Alerts */}
          <Section title="Understanding alerts" icon={AlertTriangle}>
            <p>
              The system automatically generates alerts to draw your attention to items
              that need action:
            </p>
            <div className="mt-3 space-y-2.5">
              <div className="flex items-start gap-2.5">
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
                <div>
                  <p className="text-sm font-medium text-white/70">Critical</p>
                  <p className="mt-0.5">
                    Items unmatched for more than 48 hours, or large discrepancies in
                    amounts. Requires immediate investigation.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                <div>
                  <p className="text-sm font-medium text-white/70">Warning</p>
                  <p className="mt-0.5">
                    Ambiguous matches or items that have been pending for over 24 hours.
                    Should be reviewed soon.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
                <div>
                  <p className="text-sm font-medium text-white/70">Info</p>
                  <p className="mt-0.5">
                    General notifications — e.g., a scheduled run completed, or new
                    ingestion data was imported.
                  </p>
                </div>
              </div>
            </div>
          </Section>

          {/* Export */}
          <Section title="Exporting reports" icon={Download}>
            <p>
              Click <strong className="text-white/70">Export</strong> in the header to download a
              CSV report of your reconciliation data. The export includes:
            </p>
            <ul className="mt-2 list-inside list-disc space-y-1">
              <li>External transaction ID and reference</li>
              <li>Source type, amount, and date</li>
              <li>Match status and confidence score</li>
              <li>Matched payment ID and internal reference</li>
            </ul>
            <p className="mt-2">
              Use this for auditing, sharing with your accountant, or importing into
              external accounting software.
            </p>
          </Section>

          {/* Internal References */}
          <Section title="Payment references explained" icon={BookOpen}>
            <p>
              Every payment in Edusentrix gets an <strong className="text-white/70">internal reference</strong> that
              helps you quickly identify the payment type and trace it:
            </p>
            <div className="mt-3 space-y-1.5">
              {[
                { prefix: "PSK", label: "Paystack (online)", example: "PSK-26-000042" },
                { prefix: "BNK", label: "Bank transfer", example: "BNK-26-000015" },
                { prefix: "MOM", label: "Mobile Money", example: "MOM-26-000008" },
                { prefix: "RCP", label: "Cash receipt", example: "RCP-26-000103" },
                { prefix: "CHQ", label: "Cheque", example: "CHQ-26-000003" },
              ].map(({ prefix, label, example }) => (
                <div
                  key={prefix}
                  className="flex items-center justify-between rounded-lg border border-white/5 bg-white/2 px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <code className="rounded bg-indigo-500/10 px-1.5 py-0.5 font-mono text-xs text-indigo-300">
                      {prefix}
                    </code>
                    <span className="text-white/60">{label}</span>
                  </div>
                  <code className="font-mono text-xs text-white/40">{example}</code>
                </div>
              ))}
            </div>
            <p className="mt-3">
              The format is <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-xs text-white/60">PREFIX-YY-SEQUENCE</code> where
              YY is the two-digit year and SEQUENCE is a 6-digit school-specific counter.
            </p>
          </Section>

          {/* Tips */}
          <Section title="Tips for best results" icon={Lightbulb}>
            <div className="space-y-3">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                <p>
                  <strong className="text-white/70">Import regularly.</strong> Upload gateway
                  and bank data at least weekly. The fresher your data, the faster
                  discrepancies are caught.
                </p>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                <p>
                  <strong className="text-white/70">Always include references.</strong> When
                  recording manual payments, enter the bank or mobile money reference.
                  This dramatically improves automatic matching.
                </p>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                <p>
                  <strong className="text-white/70">Resolve alerts promptly.</strong> Critical
                  alerts older than 48 hours may indicate missing payments. Don&apos;t
                  let them pile up.
                </p>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                <p>
                  <strong className="text-white/70">Use the export for audits.</strong> Download
                  a reconciliation report before your monthly or term-end financial review
                  to have a clean paper trail.
                </p>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                <p>
                  <strong className="text-white/70">Check Paystack dashboard.</strong> If an
                  item is unmatched from a gateway import, verify the transaction status
                  directly in Paystack before investigating further.
                </p>
              </div>
            </div>
          </Section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
