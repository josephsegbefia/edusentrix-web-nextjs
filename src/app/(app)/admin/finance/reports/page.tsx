"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  Bot,
  ClipboardList,
  Download,
  FileSearch,
  Landmark,
  Receipt,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useFinanceCommandCenter,
  useFinanceReportCommentary,
  type FinanceReportType,
} from "@/hooks/admin/useFinancialCenter";

type ReportCard = {
  type: FinanceReportType;
  title: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  status: "available" | "source";
};

const reports: ReportCard[] = [
  {
    type: "collections",
    title: "Collections report",
    description: "Payments collected by date range, channel, and ledger category.",
    href: "/admin/finance/transactions?direction=inflow",
    icon: Banknote,
    status: "source",
  },
  {
    type: "debtors",
    title: "Debtors report",
    description: "Outstanding and overdue fee balances for finance follow-up.",
    href: "/admin/fees",
    icon: Users,
    status: "source",
  },
  {
    type: "invoices",
    title: "Invoice report",
    description: "Issued, partially paid, overdue, paid, and cancelled invoices.",
    href: "/admin/fees/invoices",
    icon: Receipt,
    status: "source",
  },
  {
    type: "cashbook",
    title: "Cashbook / ledger export",
    description: "Immutable money movement history with filters and export support.",
    href: "/admin/finance/transactions",
    icon: ClipboardList,
    status: "available",
  },
  {
    type: "reconciliation",
    title: "Reconciliation report",
    description: "Bank/gateway matching status, unresolved evidence, and alerts.",
    href: "/admin/finance/reconciliation/sessions",
    icon: FileSearch,
    status: "source",
  },
  {
    type: "disbursements",
    title: "Disbursement report",
    description: "Outgoing payment operations and disbursement status.",
    href: "/admin/finance/disbursements",
    icon: Landmark,
    status: "source",
  },
];

export default function FinanceReportsPage() {
  const commandCenter = useFinanceCommandCenter({ range: "this_month" });
  const commentary = useFinanceReportCommentary();
  const [selectedReport, setSelectedReport] = React.useState<FinanceReportType>("collections");

  async function generateCommentary(reportType = selectedReport) {
    if (!commandCenter.data) return;
    setSelectedReport(reportType);
    await commentary.mutateAsync({ reportType, commandCenter: commandCenter.data });
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Button asChild variant="ghost" className="mb-3 px-0 text-white/60 hover:bg-transparent hover:text-white">
            <Link href="/admin/finance">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Finance
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04]">
              <Download className="h-5 w-5 text-sky-200" />
            </span>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-white">Finance Reports</h1>
              <p className="mt-1 text-sm text-white/55">
                Start from the report source, apply filters, then export evidence for leadership,
                auditors, or finance meetings.
              </p>
            </div>
          </div>
        </div>
        <Button asChild className="bg-sky-600 text-white hover:bg-sky-500">
          <Link href="/admin/finance/transactions">
            <Download className="mr-2 h-4 w-4" />
            Open ledger export
          </Link>
        </Button>
      </div>

      <section className="rounded-xl border border-sky-300/15 bg-sky-500/10 p-4 text-sky-50">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-sky-100" />
          <div>
            <p className="text-sm font-semibold">Reporting rule</p>
            <p className="mt-1 text-sm leading-6 text-sky-50/75">
              Reports should be exported from the controlled source workflow so filters, audit
              context, and reconciliation state stay visible. Leo commentary drafts can be added
              here after the report export API is expanded.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-violet-300/15 bg-violet-500/10 p-4 text-violet-50">
        <div className="flex items-start gap-3">
          <Bot className="mt-0.5 h-5 w-5 shrink-0 text-violet-100" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold">Leo report commentary</p>
                <p className="mt-1 text-sm leading-6 text-violet-50/75">
                  Generate a draft narrative from command-center evidence. Leo cites the figures
                  used, but finance must verify filters and reconciliation state before sharing.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() => void generateCommentary()}
                disabled={!commandCenter.data || commentary.isPending}
                className="bg-violet-600 text-white hover:bg-violet-500"
              >
                {commentary.isPending ? "Generating..." : "Draft commentary"}
              </Button>
            </div>
            {commentary.data ? (
              <div className="mt-4 rounded-lg border border-violet-200/15 bg-black/15 p-3">
                <p className="text-sm font-medium text-violet-50">{commentary.data.title}</p>
                <pre className="mt-2 whitespace-pre-wrap font-sans text-sm leading-6 text-violet-50/75">
                  {commentary.data.commentary}
                </pre>
                <div className="mt-3 grid gap-2 border-t border-violet-200/10 pt-3 sm:grid-cols-2">
                  {commentary.data.evidence.map((item) => (
                    <div key={item.label} className="flex justify-between gap-3 text-xs">
                      <span className="text-violet-50/45">{item.label}</span>
                      <span className="text-right text-violet-50/75">{item.value}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-xs leading-5 text-violet-50/55">
                  {commentary.data.guardrail}
                </p>
              </div>
            ) : commentary.error ? (
              <p className="mt-3 rounded-lg border border-rose-300/20 bg-rose-500/10 p-3 text-sm text-rose-50">
                {commentary.error instanceof Error
                  ? commentary.error.message
                  : "Could not generate commentary"}
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {reports.map((report) => (
          <div
            key={report.title}
            className="group rounded-xl border border-white/10 bg-slate-950/55 p-4 transition hover:border-white/20 hover:bg-white/[0.06]"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04]">
                <report.icon className="h-5 w-5 text-sky-200" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold text-white">{report.title}</p>
                  <Link href={report.href} aria-label={`Open ${report.title}`}>
                    <ArrowRight className="h-4 w-4 shrink-0 text-white/30 transition group-hover:text-white/65" />
                  </Link>
                </div>
                <p className="mt-2 text-sm leading-6 text-white/50">{report.description}</p>
                <span className="mt-4 inline-flex rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-white/55">
                  {report.status === "available" ? "Export available" : "Open source workflow"}
                </span>
                <div className="mt-3 flex flex-wrap gap-3 text-xs font-medium">
                  <Link href={report.href} className="text-sky-200 hover:text-sky-100">
                    Open source
                  </Link>
                  <button
                    type="button"
                    onClick={() => void generateCommentary(report.type)}
                    disabled={!commandCenter.data || commentary.isPending}
                    className="text-violet-200 disabled:opacity-50"
                  >
                    Draft Leo commentary
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
