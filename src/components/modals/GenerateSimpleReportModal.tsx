"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { DownloadCloud, FileText, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useReportsSummary } from "@/hooks/admin/useReports";
import { useBusyToast } from "@/hooks/useBusyToast";
import { useSchool } from "@/hooks/admin/useSchool";

type GenerateSimpleReportModalProps = {
  onClose: () => void;
};

type IssueSimpleReportVerificationInput = {
  reportLabel?: string;
  range: {
    startDate: string;
    endDate: string;
    source: string;
    periodLabel?: string | null;
  };
};

type IssueSimpleReportVerificationResponse = {
  verificationId: string;
  reportType: string;
  reportLabel: string;
  schoolName: string;
  status: "issued" | "revoked";
  issuedAt: string;
  verificationPath: string;
};

import { formatCurrency } from "@/lib/fees/money";

function formatCurrencyMinor(minor: number) {
  return formatCurrency(minor ?? 0);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-GH").format(value || 0);
}

function safeNumber(value: unknown, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function formatPercent(value: unknown, decimals = 1) {
  return `${safeNumber(value).toFixed(decimals)}%`;
}

function formatGeneratedAt(date: Date) {
  try {
    return new Intl.DateTimeFormat("en-GH", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch {
    return date.toISOString().replace("T", " ").slice(0, 16);
  }
}

async function issueSimpleReportVerification(
  input: IssueSimpleReportVerificationInput
): Promise<IssueSimpleReportVerificationResponse> {
  const res = await fetch("/api/admin/reports/simple/issue", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const payload = (await res.json()) as
    | { success: true; data: IssueSimpleReportVerificationResponse }
    | { error?: string };

  if (!res.ok || !("success" in payload) || !payload.success) {
    const message =
      "error" in payload && payload.error
        ? payload.error
        : "Failed to register report verification";
    throw new Error(message);
  }

  return payload.data;
}

async function fetchQrCodePng(verificationUrl: string): Promise<ArrayBuffer | null> {
  const qrProviderUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=0&data=${encodeURIComponent(
    verificationUrl
  )}`;

  try {
    const qrRes = await fetch(qrProviderUrl, { cache: "no-store" });
    if (!qrRes.ok) return null;
    return await qrRes.arrayBuffer();
  } catch {
    return null;
  }
}

function toPdfText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/\u20b5/g, "GHS")
    .replace(/\u00a0/g, " ")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/[^\x20-\x7E]/g, "");
}

function formatDateLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

export function GenerateSimpleReportModal({
  onClose,
}: GenerateSimpleReportModalProps) {
  const router = useRouter();
  const busy = useBusyToast();
  const { data: schoolData } = useSchool();

  const summaryQuery = useReportsSummary({
    enabled: true,
  });

  const summary = summaryQuery.data?.categories;
  const range = summaryQuery.data?.range;
  const schoolName = schoolData?.data?.name?.trim() || "Your School";

  const canDownload = Boolean(summary && range);

  const handleDownloadSnapshot = async () => {
    if (!summary || !range) {
      busy.error("Report summary is not ready yet.");
      return;
    }

    try {
      await busy.promise(
        Promise.resolve().then(async () => {
          const { PDFDocument, StandardFonts, rgb, degrees } = await import(
            "pdf-lib"
          );

          const pdfDoc = await PDFDocument.create();
          const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
          const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

          const pageWidth = 595.28;
          const pageHeight = 841.89;
          const margin = 42;
          const reportDate = new Date();
          const issuedVerification = await issueSimpleReportVerification({
            reportLabel: "Simple Report Snapshot",
            range: {
              startDate: range.startDate,
              endDate: range.endDate,
              source: range.source,
              periodLabel: range.period?.label || null,
            },
          });

          const verificationDate = new Date(issuedVerification.issuedAt);
          const generatedAt = formatGeneratedAt(
            Number.isNaN(verificationDate.getTime()) ? reportDate : verificationDate
          );
          const verificationId = issuedVerification.verificationId;
          const resolvedSchoolName = issuedVerification.schoolName || schoolName;
          const safeSchoolName = toPdfText(resolvedSchoolName);
          const safeWatermarkText = toPdfText(`${safeSchoolName} OFFICIAL REPORT`);
          const verificationUrl = `${globalThis.location.origin}${issuedVerification.verificationPath}`;

          const financeMetrics: Array<[string, string]> = [
            ["Revenue", formatCurrencyMinor(summary.fees.revenueInRangeMinor)],
            ["Billed", formatCurrencyMinor(summary.fees.billedInRangeMinor)],
            ["Outstanding", formatCurrencyMinor(summary.fees.outstandingMinor)],
            ["Collection Rate", formatPercent(summary.fees.collectionRate)],
            ["Invoices in Range", formatNumber(summary.fees.invoicesInRange)],
            ["Overdue Invoices", formatNumber(summary.fees.overdueCount)],
          ];

          const peopleMetrics: Array<[string, string]> = [
            ["Students (Total)", formatNumber(summary.students.total)],
            ["Students (New In Range)", formatNumber(summary.students.newInRange)],
            ["Teachers (Total)", formatNumber(summary.teachers.total)],
            ["Invitations (Total)", formatNumber(summary.invitations.total)],
            ["Invitations (Pending)", formatNumber(summary.invitations.status.pending)],
          ];

          const learningMetrics: Array<[string, string]> = [
            ["Average Score", safeNumber(summary.academics.averageScore).toFixed(1)],
            ["Academics Pass Rate", formatPercent(summary.academics.passRate)],
          ];

          const operationsMetrics: Array<[string, string]> = [
            ["Attendance Records", formatNumber(summary.attendance.totalRecords)],
            ["Attendance Present Rate", formatPercent(summary.attendance.presentRate)],
            ["Activity In Range", formatNumber(summary.activity.totalInRange)],
          ];

          const page = pdfDoc.addPage([pageWidth, pageHeight]);

          const brandBlue = rgb(0.08, 0.19, 0.41);
          const brandBlueAlt = rgb(0.13, 0.28, 0.56);
          const brandGold = rgb(0.9, 0.72, 0.24);
          const panel = rgb(0.965, 0.975, 0.995);
          const border = rgb(0.83, 0.87, 0.93);
          const ink = rgb(0.13, 0.16, 0.24);
          const muted = rgb(0.34, 0.4, 0.5);

          page.drawRectangle({
            x: 0,
            y: pageHeight - 118,
            width: pageWidth,
            height: 118,
            color: brandBlue,
          });
          page.drawRectangle({
            x: 0,
            y: pageHeight - 118,
            width: pageWidth,
            height: 6,
            color: brandGold,
          });
          page.drawCircle({
            x: pageWidth - 58,
            y: pageHeight - 52,
            size: 64,
            color: brandBlueAlt,
          });
          page.drawCircle({
            x: pageWidth - 10,
            y: pageHeight - 90,
            size: 20,
            color: brandGold,
          });

          for (let wy = 150; wy < pageHeight - 120; wy += 185) {
            for (let wx = -140; wx < pageWidth + 40; wx += 230) {
              page.drawText(safeWatermarkText, {
                x: wx,
                y: wy,
                size: 16,
                font: bold,
                color: rgb(0.93, 0.94, 0.97),
                rotate: degrees(32),
              });
            }
          }

          page.drawText(safeSchoolName, {
            x: margin,
            y: pageHeight - 55,
            size: 20,
            font: bold,
            color: rgb(1, 1, 1),
          });
          page.drawText("Official Simple Report Snapshot", {
            x: margin,
            y: pageHeight - 76,
            size: 11,
            font,
            color: rgb(0.92, 0.95, 1),
          });
          page.drawText(toPdfText(`Verification ID: ${verificationId}`), {
            x: margin,
            y: pageHeight - 95,
            size: 10,
            font: bold,
            color: brandGold,
          });

          const metaY = pageHeight - 206;
          const metaHeight = 62;
          page.drawRectangle({
            x: margin,
            y: metaY,
            width: pageWidth - margin * 2,
            height: metaHeight,
            color: panel,
            borderColor: border,
            borderWidth: 1,
          });
          page.drawText(toPdfText(`Generated: ${generatedAt}`), {
            x: margin + 12,
            y: metaY + 42,
            size: 10,
            font,
            color: ink,
          });
          page.drawText(
            toPdfText(
              `Range: ${formatDateLabel(range.startDate)} to ${formatDateLabel(range.endDate)}`
            ),
            {
              x: margin + 12,
              y: metaY + 27,
              size: 10,
              font,
              color: ink,
            }
          );
          page.drawText(
            toPdfText(
              `Academic Period: ${range.period?.label || "N/A"}  |  Source: ${range.source}`
            ),
            {
              x: margin + 12,
              y: metaY + 12,
              size: 10,
              font,
              color: muted,
            }
          );

          const columnGap = 18;
          const columnWidth = (pageWidth - margin * 2 - columnGap) / 2;
          const sectionHeaderHeight = 24;
          const sectionRowHeight = 18;
          const sectionTop = metaY - 18;

          const drawSection = ({
            x,
            y,
            title,
            metrics,
            accent,
          }: {
            x: number;
            y: number;
            title: string;
            metrics: Array<[string, string]>;
            accent: [number, number, number];
          }) => {
            const contentHeight = 10 + metrics.length * sectionRowHeight;
            const sectionHeight = sectionHeaderHeight + contentHeight + 10;

            page.drawRectangle({
              x,
              y: y - sectionHeight,
              width: columnWidth,
              height: sectionHeight,
              color: rgb(1, 1, 1),
              borderColor: border,
              borderWidth: 1,
            });
            page.drawRectangle({
              x,
              y: y - sectionHeaderHeight,
              width: columnWidth,
              height: sectionHeaderHeight,
              color: rgb(accent[0], accent[1], accent[2]),
            });
            page.drawText(toPdfText(title), {
              x: x + 10,
              y: y - 16,
              size: 10.5,
              font: bold,
              color: rgb(1, 1, 1),
            });

            let rowY = y - sectionHeaderHeight - 14;
            metrics.forEach(([label, value], index) => {
              const safeLabel = toPdfText(label);
              const safeValue = toPdfText(value);
              page.drawText(safeLabel, {
                x: x + 10,
                y: rowY,
                size: 9.5,
                font,
                color: ink,
              });
              const valueWidth = bold.widthOfTextAtSize(safeValue, 9.5);
              page.drawText(safeValue, {
                x: x + columnWidth - valueWidth - 10,
                y: rowY,
                size: 9.5,
                font: bold,
                color: ink,
              });

              if (index < metrics.length - 1) {
                page.drawLine({
                  start: { x: x + 10, y: rowY - 4 },
                  end: { x: x + columnWidth - 10, y: rowY - 4 },
                  thickness: 0.5,
                  color: rgb(0.9, 0.92, 0.95),
                });
              }

              rowY -= sectionRowHeight;
            });

            return sectionHeight;
          };

          const financeHeight = drawSection({
            x: margin,
            y: sectionTop,
            title: "Finance",
            metrics: financeMetrics,
            accent: [0.09, 0.45, 0.32],
          });
          const peopleHeight = drawSection({
            x: margin + columnWidth + columnGap,
            y: sectionTop,
            title: "People",
            metrics: peopleMetrics,
            accent: [0.17, 0.32, 0.62],
          });
          const nextTop = sectionTop - Math.max(financeHeight, peopleHeight) - 16;

          drawSection({
            x: margin,
            y: nextTop,
            title: "Learning",
            metrics: learningMetrics,
            accent: [0.5, 0.32, 0.12],
          });
          drawSection({
            x: margin + columnWidth + columnGap,
            y: nextTop,
            title: "Operations",
            metrics: operationsMetrics,
            accent: [0.27, 0.24, 0.48],
          });

          const qrCodePng = await fetchQrCodePng(verificationUrl);

          const footerY = 44;
          const footerHeight = 92;
          page.drawRectangle({
            x: margin,
            y: footerY,
            width: pageWidth - margin * 2,
            height: footerHeight,
            color: panel,
            borderColor: border,
            borderWidth: 1,
          });
          page.drawText("AUTHENTICITY MARK", {
            x: margin + 12,
            y: footerY + 46,
            size: 10,
            font: bold,
            color: brandBlue,
          });
          page.drawText(toPdfText(`Document ID: ${verificationId}`), {
            x: margin + 12,
            y: footerY + 57,
            size: 9.5,
            font,
            color: ink,
          });
          page.drawText(
            toPdfText(
              `Issued for ${safeSchoolName} on ${generatedAt}. Manual edits invalidate this document mark.`
            ),
            {
              x: margin + 12,
              y: footerY + 42,
              size: 8.3,
              font,
              color: muted,
            }
          );
          page.drawText(
            toPdfText(`Verify at: ${verificationUrl}`),
            {
              x: margin + 12,
              y: footerY + 25,
              size: 8.1,
              font,
              color: brandBlueAlt,
            }
          );
          page.drawText(
            toPdfText("Scan QR or use the verification ID above."),
            {
              x: margin + 12,
              y: footerY + 11,
              size: 8,
              font,
              color: muted,
            }
          );

          const stampWidth = 118;
          const stampHeight = 40;
          const stampX = pageWidth - margin - stampWidth - 10;
          const stampY = footerY + 44;
          page.drawRectangle({
            x: stampX,
            y: stampY,
            width: stampWidth,
            height: stampHeight,
            borderColor: brandBlue,
            borderWidth: 1.4,
            color: rgb(1, 1, 1),
          });
          page.drawText("VERIFIED", {
            x: stampX + 24,
            y: stampY + 22,
            size: 12,
            font: bold,
            color: brandBlue,
          });
          page.drawText("EDUSENTRIX", {
            x: stampX + 26,
            y: stampY + 9,
            size: 8,
            font: bold,
            color: brandBlueAlt,
          });

          if (qrCodePng) {
            const qrImage = await pdfDoc.embedPng(qrCodePng);
            const qrSize = 66;
            const qrX = pageWidth - margin - qrSize - 16;
            const qrY = footerY + 8;
            page.drawRectangle({
              x: qrX - 3,
              y: qrY - 3,
              width: qrSize + 6,
              height: qrSize + 6,
              color: rgb(1, 1, 1),
              borderColor: border,
              borderWidth: 1,
            });
            page.drawImage(qrImage, {
              x: qrX,
              y: qrY,
              width: qrSize,
              height: qrSize,
            });
          }

          const bytes = await pdfDoc.save();
          const pdfBuffer = new ArrayBuffer(bytes.length);
          new Uint8Array(pdfBuffer).set(bytes);
          const blob = new Blob([pdfBuffer], { type: "application/pdf" });
          const url = globalThis.URL.createObjectURL(blob);
          const link = document.createElement("a");
          const dateStamp = new Date().toISOString().slice(0, 10);
          link.href = url;
          link.download = `simple-report-${dateStamp}.pdf`;
          document.body.appendChild(link);
          link.click();
          link.remove();
          globalThis.URL.revokeObjectURL(url);
        }),
        {
          loading: "Generating PDF report...",
          success: "PDF report downloaded",
          error: (error: unknown) =>
            error instanceof Error && error.message
              ? error.message
              : "Failed to generate PDF report",
        }
      );
    } catch {
      // handled via busy toast
    }
  };

  const openFullReports = () => {
    onClose();
    router.push("/admin/reports");
  };

  return (
    <div className="space-y-5">
      <div className="text-sm text-white/70">
        Quick school snapshot for leadership updates. Download this summary now
        or open full reports for advanced exports.
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-white">Current Summary</h3>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void summaryQuery.refetch()}
            disabled={summaryQuery.isFetching}
            className="h-8 border-white/10 bg-white/5 px-2.5 text-white hover:bg-white/10"
          >
            <RefreshCw
              className={`mr-1 h-3.5 w-3.5 ${summaryQuery.isFetching ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>

        {summaryQuery.isLoading ? (
          <p className="text-sm text-white/60">Loading simple report summary...</p>
        ) : summaryQuery.isError ? (
          <p className="text-sm text-rose-300">
            Failed to load report summary. Try refresh.
          </p>
        ) : summary && range ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-white/10 bg-black/10 p-3">
              <p className="text-xs text-white/55">
                Range: {formatDateLabel(range.startDate)} to{" "}
                {formatDateLabel(range.endDate)}
                {range.period?.label ? ` • ${range.period.label}` : ""}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <p className="text-xs text-white/50">Students</p>
                <p className="text-base font-semibold text-white">
                  {formatNumber(summary.students.total)}
                </p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <p className="text-xs text-white/50">Teachers</p>
                <p className="text-base font-semibold text-white">
                  {formatNumber(summary.teachers.total)}
                </p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <p className="text-xs text-white/50">Revenue</p>
                <p className="text-base font-semibold text-white">
                  {formatCurrencyMinor(summary.fees.revenueInRangeMinor)}
                </p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <p className="text-xs text-white/50">Outstanding</p>
                <p className="text-base font-semibold text-white">
                  {formatCurrencyMinor(summary.fees.outstandingMinor)}
                </p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <p className="text-xs text-white/50">Collection Rate</p>
                <p className="text-base font-semibold text-white">
                  {summary.fees.collectionRate.toFixed(1)}%
                </p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <p className="text-xs text-white/50">Attendance</p>
                <p className="text-base font-semibold text-white">
                  {summary.attendance.presentRate.toFixed(1)}%
                </p>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-white/60">No summary data available.</p>
        )}
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          className="border-white/10 bg-white/5 text-white hover:bg-white/10"
        >
          Close
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={openFullReports}
          className="gap-2 border-white/10 bg-white/5 text-white hover:bg-white/10"
        >
          <FileText className="h-4 w-4" />
          Open Full Reports
        </Button>
        <Button
          type="button"
          onClick={() => void handleDownloadSnapshot()}
          disabled={!canDownload || summaryQuery.isFetching}
          className="gap-2 bg-brand text-black hover:bg-brand/90"
        >
          <DownloadCloud className="h-4 w-4" />
          Download Snapshot PDF
        </Button>
      </div>
    </div>
  );
}
