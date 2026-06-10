// src/components/modals/ImportTeachersCSVModal.tsx
"use client";

import * as React from "react";
import {
  Upload,
  Download,
  FileText,
  CheckCircle2,
  XCircle,
  AlertCircle,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";

type ImportResult = {
  row: number;
  success: boolean;
  teacherId?: string;
  email?: string;
  error?: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ImportTeachersCSVModal({ open, onOpenChange }: Props) {
  const [file, setFile] = React.useState<File | null>(null);
  const [isUploading, setIsUploading] = React.useState(false);
  const [results, setResults] = React.useState<ImportResult[] | null>(null);
  const queryClient = useQueryClient();

  // Reset state when modal opens/closes
  React.useEffect(() => {
    if (!open) {
      setFile(null);
      setResults(null);
      setIsUploading(false);
    }
  }, [open]);

  const handleDownloadTemplate = () => {
    const headers = [
      "First Name",
      "Last Name",
      "Email",
      "Phone",
      "Employee ID",
      "Status",
      "Subjects",
      "Homeroom Class",
    ];
    const exampleRow = [
      "Michael",
      "Marriot",
      "michael.marriot@example.com",
      "0240000000",
      "EMP001",
      "active",
      "Mathematics - JHS; English Language - JHS",
      "JHS 1 A",
    ];

    const escapeCsvValue = (value: string) =>
      `"${value.replace(/"/g, '""')}"`;
    const csvContent = [
      headers.map(escapeCsvValue).join(","),
      exampleRow.map(escapeCsvValue).join(","),
    ].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "teachers-import-template.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    toast.success("Template downloaded");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!/\.(csv|xls|xlsx)$/i.test(selectedFile.name)) {
        toast.error("Please select a CSV, XLS, or XLSX file");
        return;
      }
      setFile(selectedFile);
      setResults(null);
    }
  };

  const handleImport = async () => {
    if (!file) {
      toast.error("Please select a file");
      return;
    }

    setIsUploading(true);
    setResults(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/admin/teachers/bulk-create", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: "Failed to import teachers" }));
        throw new Error(error.error || "Failed to import teachers");
      }

      const data = await res.json();
      setResults(data.data?.results || []);

      const successful = data.data?.successful || 0;
      const failed = data.data?.failed || 0;

      if (successful > 0) {
        toast.success(`Successfully imported ${successful} teacher(s)`);
        // Invalidate teachers query to refresh the list
        queryClient.invalidateQueries({ queryKey: ["teachers"] });
      }

      if (failed > 0) {
        toast.warning(`${failed} teacher(s) failed to import. Check details below.`);
      }

      if (successful > 0 && failed === 0) {
        // Close modal if all successful
        setTimeout(() => {
          onOpenChange(false);
        }, 2000);
      }
    } catch (e: unknown) {
      const error = e as { message?: string };
      toast.error(error.message || "Failed to import teachers");
    } finally {
      setIsUploading(false);
    }
  };

  const successfulCount = results?.filter((r) => r.success).length || 0;
  const failedCount = results?.filter((r) => !r.success).length || 0;

  const isPending = isUploading;

  React.useEffect(() => {
    if (!open) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isPending) onOpenChange(false);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, isPending, onOpenChange]);

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        aria-modal="true"
        role="dialog"
      >
        <div
          className="absolute inset-0 bg-black/70 backdrop-blur-[2px]"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !isPending) onOpenChange(false);
          }}
        />

        <div className="relative z-10 flex min-h-full items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-[860px] overflow-hidden rounded-2xl border border-white/10 bg-neutral-950 text-white shadow-2xl shadow-black/40"
          >
            <div className="px-6 pt-6">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <h1 className="text-lg font-semibold">
                    Import Teachers
                  </h1>
                  <p className="text-sm text-white/60">
                    Upload a CSV or Excel file to bulk import teachers. Download
                    the template to see the required format.
                  </p>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={isPending}
                  className="h-9 w-9 rounded-full text-white/70 hover:bg-white/10 hover:text-white"
                  onClick={() => onOpenChange(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="mt-5 h-px bg-white/10" />
            </div>

            <div className="max-h-[70vh] overflow-y-auto px-6 py-6">
              <div className="space-y-4">
                <div className="rounded-lg border border-blue-400/20 bg-blue-500/10 p-4">
                  <div className="flex items-start gap-3">
                    <FileText className="h-5 w-5 text-blue-300 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-blue-100 mb-1">
                        Spreadsheet Template
                      </p>
                      <p className="text-xs text-blue-200/80 mb-3">
                        Use subject offering names, not IDs. For multiple subjects,
                        separate them with semicolons, for example: Mathematics - JHS;
                        English Language - JHS. Homeroom uses the class name, for
                        example JHS 1 A.
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleDownloadTemplate}
                        className="gap-2 border-blue-400/30 bg-blue-500/10 hover:bg-blue-500/20"
                      >
                        <Download className="h-4 w-4" />
                        Download Template
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Select Import File</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="file"
                      accept=".csv,.xls,.xlsx"
                      onChange={handleFileChange}
                      disabled={isUploading}
                      className="hidden"
                      id="csv-file-input"
                    />
                    <label htmlFor="csv-file-input" className="flex-1 cursor-pointer">
                      <div className="flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 p-4 hover:bg-white/10 transition-colors">
                        <Upload className="h-5 w-5 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          {file ? file.name : "Click to select CSV or Excel file"}
                        </span>
                      </div>
                    </label>
                  </div>
                  {file && (
                    <p className="text-xs text-muted-foreground">
                      Selected: {file.name} ({(file.size / 1024).toFixed(2)} KB)
                    </p>
                  )}
                </div>

                {results && results.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium">Import Results</h4>
                      <div className="flex items-center gap-4 text-xs">
                        <span className="text-green-400">
                          <CheckCircle2 className="h-4 w-4 inline mr-1" />
                          {successfulCount} successful
                        </span>
                        {failedCount > 0 && (
                          <span className="text-red-400">
                            <XCircle className="h-4 w-4 inline mr-1" />
                            {failedCount} failed
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="max-h-[300px] overflow-y-auto rounded-lg border border-white/10 bg-white/5">
                      <div className="divide-y divide-white/5">
                        {results.map((result, idx) => (
                          <div
                            key={idx}
                            className={`p-3 text-sm ${
                              result.success
                                ? "bg-green-500/10 border-l-2 border-green-500"
                                : "bg-red-500/10 border-l-2 border-red-500"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  {result.success ? (
                                    <CheckCircle2 className="h-4 w-4 text-green-400" />
                                  ) : (
                                    <XCircle className="h-4 w-4 text-red-400" />
                                  )}
                                  <span className="font-medium">
                                    Row {result.row}
                                    {result.email && ` - ${result.email}`}
                                  </span>
                                </div>
                                {result.success ? (
                                  <p className="text-xs text-green-200/80">
                                    Teacher created successfully
                                  </p>
                                ) : (
                                  <p className="text-xs text-red-200/80">
                                    {result.error || "Unknown error"}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <div className="rounded-lg border border-amber-400/20 bg-amber-500/10 p-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-300 mt-0.5" />
                    <div className="text-xs text-amber-200/80">
                      <p className="font-medium mb-1">Required Columns:</p>
                      <ul className="list-disc list-inside space-y-0.5">
                        <li>firstName, lastName, email (required)</li>
                        <li>phone and employeeId are optional</li>
                        <li>
                          status: active, inactive, on_leave, terminated
                          (default: active)
                        </li>
                        <li>
                          subjects: optional subject offering names; separate
                          multiple subjects with semicolons
                        </li>
                        <li>
                          homeroomClass: optional class name, for example JHS 1 A
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 border-t border-white/10 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    disabled={isPending}
                    className="gap-2 border-white/10 bg-white/5 text-white hover:bg-white/10"
                  >
                    {results ? "Close" : "Cancel"}
                  </Button>
                  <Button
                    type="button"
                    onClick={handleImport}
                    disabled={!file || isPending}
                    className="gap-2 bg-brand text-black hover:opacity-90"
                  >
                    {isPending ? (
                      <>
                        <span className="animate-spin">⏳</span>
                        Importing...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4" />
                        Import Teachers
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
