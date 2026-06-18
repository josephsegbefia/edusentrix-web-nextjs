import Link from "next/link";
import { Download, Eye } from "lucide-react";
import { Types } from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireParent, getParentWardIds } from "@/lib/auth/requireParent";
import { learnReceiptNumber } from "@/lib/learn/receipt-pdf";
import { GlassPanel } from "@/components/ui/glass-panel";
import { WorkspacePageHeader } from "@/components/ui/workspace-page-header";
import { WorkspacePageShell } from "@/components/ui/workspace-page-shell";
import { glassInsetClass } from "@/lib/ui/glass-surfaces";
import { cn } from "@/lib/utils";
import { LearnPaymentIntent } from "@/models/LearnPaymentIntent";
import { Payment } from "@/models/Payment";
import { Student } from "@/models/Student";

export const dynamic = "force-dynamic";

type ReceiptRow = {
  id: string;
  type: "learn" | "fee";
  receiptNumber: string;
  title: string;
  wardName: string;
  amountMinor: number;
  currency: "GHS";
  status: string;
  reference: string | null;
  issuedAt: string | null;
  createdAt: string | null;
};

function money(minor: number, currency = "GHS") {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(minor / 100);
}

function shortDate(value: string | null) {
  if (!value) return "Not issued";
  return new Intl.DateTimeFormat("en-GH", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function statusTone(status: string) {
  if (status === "succeeded" || status === "completed") return "border-emerald-300/25 bg-emerald-400/10 text-emerald-100";
  if (status === "failed" || status === "cancelled" || status === "expired") return "border-rose-300/25 bg-rose-400/10 text-rose-100";
  return "border-amber-300/25 bg-amber-400/10 text-amber-100";
}

function studentName(row: { firstName?: string | null; middleName?: string | null; lastName?: string | null } | undefined) {
  return [row?.firstName, row?.middleName, row?.lastName].filter(Boolean).join(" ").trim() || "Student";
}

export default async function ParentReceiptsPage() {
  const ctx = await requireParent({ mode: "page" });
  await connectToDatabase();

  const wardIds = await getParentWardIds(ctx.userId);
  const [students, feePayments, learnPayments] = await Promise.all([
    Student.find({ _id: { $in: wardIds }, schoolId: ctx.schoolId })
      .select("_id firstName middleName lastName")
      .lean<Array<{ _id: Types.ObjectId; firstName?: string | null; middleName?: string | null; lastName?: string | null }>>(),
    Payment.find({ schoolId: ctx.schoolId, studentId: { $in: wardIds }, status: "completed" })
      .sort({ paymentDate: -1, createdAt: -1 })
      .limit(100)
      .select("_id studentId amountMinor status paymentDate createdAt paystackReference externalReference receiptNumber")
      .lean(),
    LearnPaymentIntent.find({ schoolId: ctx.schoolId, parentUserId: ctx.userId, studentId: { $in: wardIds } })
      .sort({ createdAt: -1 })
      .limit(100)
      .select("_id studentId amountMinor currency status paystackReference createdAt succeededAt")
      .lean(),
  ]);

  const studentMap = new Map(students.map((student) => [String(student._id), student]));
  const rows: ReceiptRow[] = [
    ...feePayments.map((payment) => ({
      id: String(payment._id),
      type: "fee" as const,
      receiptNumber: payment.receiptNumber || `FEE-${String(payment._id).slice(-8).toUpperCase()}`,
      title: "School fee payment",
      wardName: studentName(studentMap.get(String(payment.studentId))),
      amountMinor: payment.amountMinor || 0,
      currency: "GHS" as const,
      status: payment.status || "completed",
      reference: payment.paystackReference || payment.externalReference || payment.receiptNumber || null,
      issuedAt: payment.paymentDate?.toISOString?.() || payment.createdAt?.toISOString?.() || null,
      createdAt: payment.createdAt?.toISOString?.() || null,
    })),
    ...learnPayments.map((payment) => ({
      id: String(payment._id),
      type: "learn" as const,
      receiptNumber: learnReceiptNumber(String(payment._id)),
      title: "EduSentrix Learn payment",
      wardName: studentName(studentMap.get(String(payment.studentId))),
      amountMinor: payment.amountMinor || 0,
      currency: payment.currency || "GHS",
      status: payment.status,
      reference: payment.paystackReference || null,
      issuedAt: payment.succeededAt?.toISOString?.() || null,
      createdAt: payment.createdAt?.toISOString?.() || null,
    })),
  ].sort((a, b) => new Date(b.createdAt || b.issuedAt || 0).getTime() - new Date(a.createdAt || a.issuedAt || 0).getTime());

  const issued = rows.filter((row) => row.status === "succeeded" || row.status === "completed");

  return (
    <div className="p-6 text-white md:p-8">
      <WorkspacePageShell>
        <WorkspacePageHeader
          title="Receipts"
          subtitle="Track school fee and EduSentrix Learn payment receipts in one place."
          iconName="file-text"
        />

        <div className="grid gap-4 md:grid-cols-3">
          <Metric label="Receipts issued" value={issued.length.toLocaleString()} />
          <Metric label="Total receipted" value={money(issued.reduce((sum, row) => sum + row.amountMinor, 0))} />
          <Metric label="Tracked payments" value={rows.length.toLocaleString()} />
        </div>

        <GlassPanel className="p-5" glow="both">
          {rows.length ? (
            <div className="space-y-3">
              {rows.map((row) => {
                const downloadable = row.status === "succeeded" || row.status === "completed";
                return (
                  <div key={`${row.type}-${row.id}`} className={cn(glassInsetClass, "p-4")}>
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <p className="font-semibold text-white">{row.title}</p>
                        <p className="mt-1 text-sm text-white/50">{row.wardName} · {row.receiptNumber}</p>
                      </div>
                      <div className="grid gap-3 text-sm sm:grid-cols-5 lg:min-w-[760px]">
                        <Info label="Amount" value={money(row.amountMinor, row.currency)} />
                        <Info label="Status" value={row.status.replace(/_/g, " ")} tone={statusTone(row.status)} />
                        <Info label="Issued" value={shortDate(row.issuedAt)} />
                        <Info label="Reference" value={row.reference || "Not assigned"} />
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/35">Receipt</p>
                          {downloadable ? (
                            <div className="mt-1 flex flex-wrap gap-2">
                              <Link
                                href={`/api/parent/receipts/${row.type}/${row.id}/download?disposition=inline`}
                                target="_blank"
                                className="inline-flex items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-[11px] font-medium text-white/75 transition hover:bg-white/10"
                              >
                                <Eye className="h-3 w-3" />
                                View
                              </Link>
                              <Link
                                href={`/api/parent/receipts/${row.type}/${row.id}/download`}
                                className="inline-flex items-center gap-1 rounded-lg border border-teal-300/20 bg-teal-400/10 px-2 py-1 text-[11px] font-medium text-teal-100 transition hover:bg-teal-400/15"
                              >
                                <Download className="h-3 w-3" />
                                PDF
                              </Link>
                            </div>
                          ) : (
                            <p className="mt-1 text-white/40">Pending</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="rounded-xl border border-white/10 bg-white/5 p-5 text-sm text-white/55">
              No receipt records found yet.
            </p>
          )}
        </GlassPanel>
      </WorkspacePageShell>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <GlassPanel className="p-4" glow="cyan">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/40">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
    </GlassPanel>
  );
}

function Info({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/35">{label}</p>
      {tone ? (
        <span className={cn("mt-1 inline-flex rounded-full border px-2 py-0.5 text-[11px] capitalize", tone)}>{value}</span>
      ) : (
        <p className="mt-1 break-words text-white/80">{value}</p>
      )}
    </div>
  );
}
