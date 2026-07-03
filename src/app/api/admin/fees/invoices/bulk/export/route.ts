// src/app/api/admin/fees/invoices/bulk/export/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireFinanceStaffOrDelegatedAnyPermission } from "@/lib/delegations/requireDelegatedModulePermission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Invoice } from "@/models/Invoice";
import { InvoiceLineItem } from "@/models/InvoiceLineItem";
import { formatMoney } from "@/lib/fees/money";

export async function POST(req: NextRequest) {
  const { schoolId } = await requireFinanceStaffOrDelegatedAnyPermission([
    "fees.export",
  ]);
  await connectToDatabase();

  try {
    const body = await req.json();
    const { invoiceIds } = body;

    if (!Array.isArray(invoiceIds) || invoiceIds.length === 0) {
      return NextResponse.json(
        { error: "invoiceIds must be a non-empty array" },
        { status: 400 }
      );
    }

    // Fetch invoices with populated data
    const invoices = await Invoice.find({
      _id: { $in: invoiceIds },
      schoolId,
    })
      .populate("studentId", "firstName lastName middleName admissionNo photoUrl")
      .populate("academicPeriodId", "yearLabel term startDate endDate")
      .lean();

    if (invoices.length === 0) {
      return NextResponse.json(
        { error: "No invoices found" },
        { status: 404 }
      );
    }

    // Fetch line items for all invoices
    const lineItems = await InvoiceLineItem.find({
      invoiceId: { $in: invoiceIds },
    })
      .sort({ displayOrder: 1 })
      .lean();

    // Group line items by invoice
    const lineItemsByInvoice = new Map<string, typeof lineItems>();
    lineItems.forEach((item) => {
      const invoiceId = String(item.invoiceId);
      if (!lineItemsByInvoice.has(invoiceId)) {
        lineItemsByInvoice.set(invoiceId, []);
      }
      lineItemsByInvoice.get(invoiceId)!.push(item);
    });

    // Build CSV data
    const csvRows: string[] = [];

    // Header row
    csvRows.push(
      [
        "Invoice Number",
        "Student Name",
        "Admission Number",
        "Academic Period",
        "Status",
        "Total Amount",
        "Paid Amount",
        "Outstanding Amount",
        "Due Date",
        "Issue Date",
        "Line Items",
        "Notes",
      ].join(",")
    );

    // Data rows
    invoices.forEach((invoice) => {
      const student = invoice.studentId as any;
      const period = invoice.academicPeriodId as any;
      const items = lineItemsByInvoice.get(String(invoice._id)) || [];

      const lineItemsStr = items
        .map(
          (item) =>
            `${item.name} (${formatMoney(item.amountMinor)})`
        )
        .join("; ");

      const studentName = [
        student?.firstName,
        student?.middleName,
        student?.lastName,
      ]
        .filter(Boolean)
        .join(" ");

      csvRows.push(
        [
          invoice.invoiceNumber || "",
          `"${studentName || ""}"`,
          student?.admissionNo || "",
          period ? `${period.yearLabel} • ${period.term}` : "",
          invoice.status || "",
          formatMoney(invoice.totalAmountMinor),
          formatMoney(invoice.totalPaidMinor),
          formatMoney(invoice.totalOutstandingMinor),
          invoice.dueDate
            ? new Date(invoice.dueDate).toLocaleDateString()
            : "",
          invoice.issueDate
            ? new Date(invoice.issueDate).toLocaleDateString()
            : "",
          `"${lineItemsStr}"`,
          `"${(invoice.notes || "").replace(/"/g, '""')}"`,
        ].join(",")
      );
    });

    const csvContent = csvRows.join("\n");

    return new NextResponse(csvContent, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="bills-export-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error("Error exporting bills:", error);
    return NextResponse.json(
      { error: "Failed to export bills" },
      { status: 500 }
    );
  }
}
