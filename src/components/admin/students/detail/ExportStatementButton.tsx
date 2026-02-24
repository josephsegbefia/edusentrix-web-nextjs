/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FileText, Download, FileDown } from "lucide-react";
import { useStudentInvoices } from "@/hooks/admin/useStudentInvoices";
import { useStudentPayments } from "@/hooks/admin/useStudentPayments";
import { useStudentInstallments } from "@/hooks/admin/useStudentInstallments";
import { useStudentCreditBalance } from "@/hooks/admin/useStudentCreditBalance";
import {
  downloadCSVStatement,
  downloadTextStatement,
  type StatementData,
} from "@/lib/fees/exportStatement";
import { useToast } from "@/hooks/useToast";

type Props = {
  studentId: string;
  studentName: string;
  admissionNo?: string | null;
  academicPeriodId?: string | null;
};

function fmtDate(iso: string | Date | null | undefined) {
  if (!iso) return "N/A";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return "N/A";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(d);
}

export function ExportStatementButton({
  studentId,
  studentName,
  admissionNo,
  academicPeriodId,
}: Props) {
  const { success: toastSuccess, error: toastError } = useToast();
  const [isExporting, setIsExporting] = React.useState(false);

  // Fetch all data needed for export
  const { data: invoicesData } = useStudentInvoices(studentId, {
    academicPeriodId: academicPeriodId || undefined,
    limit: 1000, // Get all invoices
  });

  const { data: paymentsData } = useStudentPayments(studentId, {
    limit: 1000, // Get all payments
  });

  const { data: installmentsData } = useStudentInstallments(studentId);
  const { data: creditBalanceData } = useStudentCreditBalance(studentId);

  const handleExport = React.useCallback(
    async (format: "csv" | "txt") => {
      setIsExporting(true);
      try {
        const invoices = invoicesData?.invoices || [];
        const invoiceIds = new Set(invoices.map((inv: any) => String(inv._id)));
        const allPayments = paymentsData?.payments || [];
        const payments = academicPeriodId
          ? allPayments.filter((payment: any) => {
              const paymentInvoiceId = payment?.invoiceId?._id;
              return paymentInvoiceId
                ? invoiceIds.has(String(paymentInvoiceId))
                : false;
            })
          : allPayments;
        const allInstallments = installmentsData?.installments || [];
        const installments = academicPeriodId
          ? allInstallments.filter((installment: any) =>
              installment.invoiceId
                ? invoiceIds.has(String(installment.invoiceId))
                : false
            )
          : allInstallments;
        const activeInvoices = invoices.filter((invoice: any) =>
          ["issued", "partially_paid", "paid", "overdue"].includes(
            String(invoice.status)
          )
        );

        // Calculate summary
        const totalBilled = activeInvoices.reduce(
          (sum: number, inv: any) => sum + (inv.totalAmountMinor || 0),
          0
        );
        const totalPaid = activeInvoices.reduce(
          (sum: number, inv: any) => sum + (inv.totalPaidMinor || 0),
          0
        );
        const totalOutstanding = activeInvoices.reduce(
          (sum: number, inv: any) => sum + (inv.totalOutstandingMinor || 0),
          0
        );

        const creditBalance = creditBalanceData?.creditBalance?.balanceMinor ?? 0;

        const statementData: StatementData = {
          student: {
            name: studentName,
            admissionNo: admissionNo || undefined,
            id: studentId,
          },
          period: academicPeriodId
            ? {
                label: activeInvoices[0]?.academicPeriodId?.yearLabel
                  ? `${activeInvoices[0].academicPeriodId.yearLabel} • ${activeInvoices[0].academicPeriodId.term}`
                  : "Selected Period",
              }
            : undefined,
          summary: {
            totalBilled,
            totalPaid,
            totalOutstanding,
            creditBalance,
          },
          invoices: invoices.map((inv: any) => ({
            invoiceNumber: inv.invoiceNumber || "N/A",
            date: fmtDate(inv.createdAt || inv.issueDate),
            dueDate: fmtDate(inv.dueDate),
            status: inv.status || "unknown",
            totalAmountMinor: inv.totalAmountMinor || 0,
            totalPaidMinor: inv.totalPaidMinor || 0,
            totalOutstandingMinor: inv.totalOutstandingMinor || 0,
          })),
          payments: payments.map((p: any) => ({
            receiptNumber: p.receiptNumber,
            date: fmtDate(p.paymentDate),
            amountMinor: p.amountMinor || 0,
            paymentMethod: p.paymentMethod || "unknown",
            status: p.status || "unknown",
            invoiceNumber: p.invoiceId?.invoiceNumber,
          })),
          installments: installments.map((inst: any) => ({
            invoiceNumber: inst.invoiceNumber || "N/A",
            lineItemName: inst.lineItemName || "N/A",
            dueDate: fmtDate(inst.dueDate),
            amountMinor: inst.amountMinor || 0,
            amountPaidMinor: inst.amountPaidMinor || 0,
            amountOutstandingMinor: inst.amountOutstandingMinor || 0,
            status: inst.status || "unknown",
          })),
        };

        if (format === "csv") {
          downloadCSVStatement(statementData);
        } else {
          downloadTextStatement(statementData);
        }

        toastSuccess("Statement exported successfully");
      } catch (error) {
        console.error("Export error:", error);
        toastError("Failed to export statement");
      } finally {
        setIsExporting(false);
      }
    },
    [
      invoicesData,
      paymentsData,
      installmentsData,
      creditBalanceData,
      studentId,
      studentName,
      admissionNo,
      academicPeriodId,
      toastSuccess,
      toastError,
    ]
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 border-white/10 bg-white/5 text-xs text-white/70"
          disabled={isExporting}
        >
          <FileText className="h-4 w-4" />
          {isExporting ? "Exporting..." : "Export"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="border-white/10 bg-black/60 backdrop-blur">
        <DropdownMenuItem
          onClick={() => handleExport("csv")}
          className="text-white/80 hover:bg-white/10"
        >
          <Download className="mr-2 h-4 w-4" />
          Export as CSV
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleExport("txt")}
          className="text-white/80 hover:bg-white/10"
        >
          <FileDown className="mr-2 h-4 w-4" />
          Export as Text
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
