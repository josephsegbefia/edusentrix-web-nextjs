"use client";

import * as React from "react";
import { X, Printer, Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PrintTemplate } from "./PrintTemplate";
import type { LessonNoteFormData } from "@/types/lesson-notes";

// ============================================================================
// Types
// ============================================================================

interface PrintPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formData: LessonNoteFormData;
  className?: string;
  subjectName?: string;
  schoolName?: string;
  schoolLogo?: string;
  teacherName?: string;
}

// ============================================================================
// Component
// ============================================================================

export function PrintPreviewModal({
  open,
  onOpenChange,
  formData,
  className,
  subjectName,
  schoolName,
  schoolLogo,
  teacherName,
}: PrintPreviewModalProps) {
  const printRef = React.useRef<HTMLDivElement>(null);
  const [isPrinting, setIsPrinting] = React.useState(false);

  // Handle print
  const handlePrint = React.useCallback(() => {
    setIsPrinting(true);

    // Create a new window for printing
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      setIsPrinting(false);
      return;
    }

    // Get the print content
    const content = printRef.current?.innerHTML || "";

    // Write the print content
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Lesson Note - ${formData.topic}</title>
          <style>
            /* Reset */
            *, *::before, *::after {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }
            
            /* Base styles */
            body {
              font-family: Georgia, "Times New Roman", serif;
              font-size: 12pt;
              line-height: 1.5;
              color: #000;
              background: #fff;
            }
            
            /* Page styling */
            .print-content {
              padding: 20mm;
              max-width: 210mm;
              margin: 0 auto;
            }
            
            /* Typography */
            h1, h2, h3 {
              font-weight: bold;
              margin-bottom: 0.5em;
            }
            
            /* Tables */
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 1em 0;
            }
            
            th, td {
              border: 1px solid #333;
              padding: 8px 12px;
              text-align: left;
              vertical-align: top;
            }
            
            th {
              background: #f0f0f0;
              font-weight: bold;
            }
            
            /* Lists */
            ul, ol {
              margin-left: 1.5em;
              margin-top: 0.5em;
            }
            
            li {
              margin-bottom: 0.25em;
            }
            
            /* Sections */
            .section-title {
              background: #f0f0f0;
              border: 1px solid #333;
              padding: 8px 12px;
              font-weight: bold;
              text-transform: uppercase;
              margin-top: 1.5em;
              margin-bottom: 0.75em;
            }
            
            /* Header */
            .header {
              border-bottom: 2px solid #000;
              padding-bottom: 1em;
              margin-bottom: 1.5em;
              text-align: center;
            }
            
            .school-name {
              font-size: 18pt;
              font-weight: bold;
              text-transform: uppercase;
              letter-spacing: 0.05em;
            }
            
            .doc-title {
              font-size: 14pt;
              font-weight: bold;
              margin-top: 0.5em;
            }
            
            /* Info grid */
            .info-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 0.25em 2em;
              margin-top: 1em;
              text-align: left;
            }
            
            .info-label {
              font-weight: bold;
            }
            
            /* Badges */
            .badge {
              display: inline-block;
              background: #e0e0e0;
              padding: 2px 8px;
              border-radius: 3px;
              font-size: 10pt;
              margin-right: 4px;
              margin-bottom: 4px;
            }
            
            /* Footer */
            .footer {
              margin-top: 2em;
              padding-top: 1em;
              border-top: 1px solid #ccc;
              text-align: center;
              font-size: 10pt;
              color: #666;
            }
            
            /* Print-specific */
            @media print {
              body {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              
              .print-content {
                padding: 0;
              }
              
              @page {
                size: A4;
                margin: 15mm;
              }
            }
          </style>
        </head>
        <body>
          <div class="print-content">
            ${content}
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();

    // Wait for content to load then print
    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
      printWindow.close();
      setIsPrinting(false);
    };
  }, [formData.topic]);

  // Handle download as HTML (can be converted to PDF by browser)
  const handleDownload = React.useCallback(() => {
    const content = printRef.current?.innerHTML || "";
    const blob = new Blob(
      [
        `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Lesson Note - ${formData.topic}</title>
  <style>
    body { font-family: Georgia, serif; padding: 40px; max-width: 800px; margin: 0 auto; }
    table { width: 100%; border-collapse: collapse; margin: 1em 0; }
    th, td { border: 1px solid #333; padding: 8px; text-align: left; vertical-align: top; }
    th { background: #f0f0f0; }
    ul, ol { margin-left: 1.5em; }
  </style>
</head>
<body>
  ${content}
</body>
</html>`,
      ],
      { type: "text/html" }
    );

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lesson-note-${formData.topic.replace(/\s+/g, "-").toLowerCase()}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [formData.topic]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col bg-zinc-900 border-white/10">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-white">Print Preview</DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                className="border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
              >
                <Download className="mr-1 h-4 w-4" />
                Download HTML
              </Button>
              <Button
                size="sm"
                onClick={handlePrint}
                disabled={isPrinting}
                className="bg-indigo-500/20 text-indigo-100 hover:bg-indigo-500/30"
              >
                <Printer className="mr-1 h-4 w-4" />
                {isPrinting ? "Printing..." : "Print"}
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Preview area */}
        <div className="flex-1 overflow-auto rounded-lg bg-white shadow-inner">
          <div ref={printRef}>
            <PrintTemplate
              formData={formData}
              className={className}
              subjectName={subjectName}
              schoolName={schoolName}
              schoolLogo={schoolLogo}
              teacherName={teacherName}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default PrintPreviewModal;
