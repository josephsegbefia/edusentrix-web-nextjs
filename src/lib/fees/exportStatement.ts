/* eslint-disable @typescript-eslint/no-explicit-any */
// Simple PDF/CSV export utilities for student fee statements

export interface StatementData {
  student: {
    name: string;
    admissionNo?: string;
    id: string;
  };
  period?: {
    label: string;
    startDate?: string;
    endDate?: string;
  };
  summary: {
    totalBilled: number;
    totalPaid: number;
    totalOutstanding: number;
    creditBalance: number;
  };
  invoices: Array<{
    invoiceNumber: string;
    date: string;
    dueDate: string;
    status: string;
    totalAmountMinor: number;
    totalPaidMinor: number;
    totalOutstandingMinor: number;
  }>;
  payments: Array<{
    receiptNumber?: string;
    date: string;
    amountMinor: number;
    paymentMethod: string;
    status: string;
    invoiceNumber?: string;
  }>;
  installments?: Array<{
    invoiceNumber: string;
    lineItemName: string;
    dueDate: string;
    amountMinor: number;
    amountPaidMinor: number;
    amountOutstandingMinor: number;
    status: string;
  }>;
}

export function generateCSVStatement(data: StatementData): string {
  const rows: string[] = [];

  // Header
  rows.push("Student Fee Statement");
  rows.push(`Student: ${data.student.name}${data.student.admissionNo ? ` (${data.student.admissionNo})` : ""}`);
  if (data.period) {
    rows.push(`Period: ${data.period.label}`);
  }
  rows.push(`Generated: ${new Date().toLocaleDateString()}`);
  rows.push("");

  // Summary
  rows.push("SUMMARY");
  rows.push(`Total Billed,${formatMoneyCSV(data.summary.totalBilled)}`);
  rows.push(`Total Paid,${formatMoneyCSV(data.summary.totalPaid)}`);
  rows.push(`Total Outstanding,${formatMoneyCSV(data.summary.totalOutstanding)}`);
  rows.push(`Credit Balance,${formatMoneyCSV(data.summary.creditBalance)}`);
  rows.push("");

  // Invoices
  if (data.invoices.length > 0) {
    rows.push("INVOICES");
    rows.push("Invoice Number,Date,Due Date,Status,Amount,Paid,Outstanding");
    data.invoices.forEach((inv) => {
      rows.push(
        `${inv.invoiceNumber},${inv.date},${inv.dueDate},${inv.status},${formatMoneyCSV(inv.totalAmountMinor)},${formatMoneyCSV(inv.totalPaidMinor)},${formatMoneyCSV(inv.totalOutstandingMinor)}`
      );
    });
    rows.push("");
  }

  // Payments
  if (data.payments.length > 0) {
    rows.push("PAYMENTS");
    rows.push("Receipt Number,Date,Amount,Method,Status,Invoice");
    data.payments.forEach((p) => {
      rows.push(
        `${p.receiptNumber || "N/A"},${p.date},${formatMoneyCSV(p.amountMinor)},${p.paymentMethod},${p.status},${p.invoiceNumber || "N/A"}`
      );
    });
    rows.push("");
  }

  // Installments
  if (data.installments && data.installments.length > 0) {
    rows.push("INSTALLMENTS");
    rows.push("Invoice,Line Item,Due Date,Amount,Paid,Outstanding,Status");
    data.installments.forEach((inst) => {
      rows.push(
        `${inst.invoiceNumber},${inst.lineItemName},${inst.dueDate},${formatMoneyCSV(inst.amountMinor)},${formatMoneyCSV(inst.amountPaidMinor)},${formatMoneyCSV(inst.amountOutstandingMinor)},${inst.status}`
      );
    });
  }

  return rows.join("\n");
}

export function downloadCSVStatement(data: StatementData, filename?: string) {
  const csv = generateCSVStatement(data);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  link.setAttribute(
    "download",
    filename ||
      `fee-statement-${data.student.admissionNo || data.student.id}-${new Date().toISOString().split("T")[0]}.csv`
  );
  link.style.visibility = "hidden";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

function formatMoneyCSV(minor: number): string {
  return (minor / 100).toFixed(2);
}

// Generate a simple text statement
export function generateTextStatement(data: StatementData): string {
  const lines: string[] = [];

  lines.push("=".repeat(60));
  lines.push("STUDENT FEE STATEMENT");
  lines.push("=".repeat(60));
  lines.push("");
  lines.push(`Student: ${data.student.name}`);
  if (data.student.admissionNo) {
    lines.push(`Admission No: ${data.student.admissionNo}`);
  }
  if (data.period) {
    lines.push(`Period: ${data.period.label}`);
  }
  lines.push(`Generated: ${new Date().toLocaleString()}`);
  lines.push("");
  lines.push("-".repeat(60));

  // Summary
  lines.push("");
  lines.push("SUMMARY");
  lines.push("-".repeat(60));
  lines.push(`Total Billed:        ${formatMoneyText(data.summary.totalBilled)}`);
  lines.push(`Total Paid:          ${formatMoneyText(data.summary.totalPaid)}`);
  lines.push(`Total Outstanding:   ${formatMoneyText(data.summary.totalOutstanding)}`);
  lines.push(`Credit Balance:      ${formatMoneyText(data.summary.creditBalance)}`);
  lines.push("");

  // Invoices
  if (data.invoices.length > 0) {
    lines.push("INVOICES");
    lines.push("-".repeat(60));
    data.invoices.forEach((inv) => {
      lines.push(`${inv.invoiceNumber} | ${inv.date} | ${inv.status}`);
      lines.push(`  Amount: ${formatMoneyText(inv.totalAmountMinor)} | Paid: ${formatMoneyText(inv.totalPaidMinor)} | Outstanding: ${formatMoneyText(inv.totalOutstandingMinor)}`);
      lines.push(`  Due Date: ${inv.dueDate}`);
      lines.push("");
    });
  }

  // Payments
  if (data.payments.length > 0) {
    lines.push("PAYMENTS");
    lines.push("-".repeat(60));
    data.payments.forEach((p) => {
      lines.push(`${p.receiptNumber || "N/A"} | ${p.date} | ${formatMoneyText(p.amountMinor)}`);
      lines.push(`  Method: ${p.paymentMethod} | Status: ${p.status}${p.invoiceNumber ? ` | Invoice: ${p.invoiceNumber}` : ""}`);
      lines.push("");
    });
  }

  // Installments
  if (data.installments && data.installments.length > 0) {
    lines.push("INSTALLMENTS");
    lines.push("-".repeat(60));
    data.installments.forEach((inst) => {
      lines.push(`${inst.invoiceNumber} - ${inst.lineItemName}`);
      lines.push(`  Due: ${inst.dueDate} | Amount: ${formatMoneyText(inst.amountMinor)} | Paid: ${formatMoneyText(inst.amountPaidMinor)} | Outstanding: ${formatMoneyText(inst.amountOutstandingMinor)}`);
      lines.push(`  Status: ${inst.status}`);
      lines.push("");
    });
  }

  lines.push("=".repeat(60));

  return lines.join("\n");
}

export function downloadTextStatement(data: StatementData, filename?: string) {
  const text = generateTextStatement(data);
  const blob = new Blob([text], { type: "text/plain;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  link.setAttribute(
    "download",
    filename ||
      `fee-statement-${data.student.admissionNo || data.student.id}-${new Date().toISOString().split("T")[0]}.txt`
  );
  link.style.visibility = "hidden";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

function formatMoneyText(minor: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "GHS",
    minimumFractionDigits: 2,
  }).format(minor / 100);
}
