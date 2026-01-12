// src/components/modals/ImportTeachersCSVModal.tsx
"use client";

import * as React from "react";
import { Upload, Download, FileText, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
    // Create CSV template
    const headers = [
      "firstName",
      "lastName",
      "email",
      "phone",
      "employeeId",
      "department",
      "status",
      "subjectIds",
      "homeroomClassGroupId",
    ];
    const exampleRow = [
      "John",
      "Doe",
      "john.doe@example.com",
      "+1234567890",
      "EMP001",
      "Mathematics",
      "active",
      "subject-id-1,subject-id-2",
      "class-group-id",
    ];

    const csvContent = [headers.join(","), exampleRow.join(",")].join("\n");
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
      if (!selectedFile.name.endsWith(".csv")) {
        toast.error("Please select a CSV file");
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] border border-white/10 bg-linear-to-br from-white/10 to-transparent shadow-2xl shadow-black/30 backdrop-blur max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">Import Teachers from CSV</DialogTitle>
          <DialogDescription className="text-sm">
            Upload a CSV file to bulk import teachers. Download the template to see the required format.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Template download */}
          <div className="rounded-lg border border-blue-400/20 bg-blue-500/10 p-4">
            <div className="flex items-start gap-3">
              <FileText className="h-5 w-5 text-blue-300 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-blue-100 mb-1">
                  CSV Template Required
                </p>
                <p className="text-xs text-blue-200/80 mb-3">
                  Download the template to ensure your CSV file has the correct format and column headers.
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

          {/* File upload */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Select CSV File</label>
            <div className="flex items-center gap-3">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                disabled={isUploading}
                className="hidden"
                id="csv-file-input"
              />
              <label
                htmlFor="csv-file-input"
                className="flex-1 cursor-pointer"
              >
                <div className="flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 p-4 hover:bg-white/8 transition-colors">
                  <Upload className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {file ? file.name : "Click to select CSV file"}
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

          {/* Results */}
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

          {/* Info box */}
          <div className="rounded-lg border border-amber-400/20 bg-amber-500/10 p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-amber-300 mt-0.5" />
              <div className="text-xs text-amber-200/80">
                <p className="font-medium mb-1">Required Columns:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>firstName, lastName, email (required)</li>
                  <li>phone, employeeId, department (optional)</li>
                  <li>status: active, inactive, on_leave, terminated (default: active)</li>
                  <li>subjectIds: comma-separated subject IDs (optional)</li>
                  <li>homeroomClassGroupId: single class group ID (optional)</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isUploading}
          >
            {results ? "Close" : "Cancel"}
          </Button>
          <Button
            type="button"
            onClick={handleImport}
            disabled={!file || isUploading}
            className="gap-2"
          >
            {isUploading ? (
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
