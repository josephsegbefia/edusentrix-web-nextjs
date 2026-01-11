// src/components/admin/teachers/detail/TeacherDocumentsTab.tsx
"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Plus, Download, Trash2, FileText, AlertTriangle, Clock } from "lucide-react";
import { toast } from "sonner";
import {
  useTeacherDocuments,
  useDeleteDocument,
  type TeacherDocumentDTO,
} from "@/hooks/admin/useTeacherDocuments";
import { useBusyToast } from "@/hooks/useBusyToast";
import { UploadDocumentModal } from "@/components/modals/UploadDocumentModal";

type Props = {
  teacher: {
    id: string;
    fullName: string;
  };
};

function formatDate(date: string | null): string {
  if (!date) return "—";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function getTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    contract: "Contract",
    certificate: "Certificate",
    license: "License",
    id: "ID",
    resume: "Resume",
    other: "Other",
  };
  return labels[type] || type;
}

function getExpiryBadgeClass(
  status: "expired" | "expiring_soon" | "valid" | null
): string {
  switch (status) {
    case "expired":
      return "border-red-400/30 bg-red-500/10 text-red-200";
    case "expiring_soon":
      return "border-amber-400/30 bg-amber-500/10 text-amber-200";
    case "valid":
      return "border-emerald-400/30 bg-emerald-500/10 text-emerald-200";
    default:
      return "border-white/10 bg-white/5 text-white/80";
  }
}

function getExpiryLabel(status: "expired" | "expiring_soon" | "valid" | null): string {
  switch (status) {
    case "expired":
      return "Expired";
    case "expiring_soon":
      return "Expiring Soon";
    case "valid":
      return "Valid";
    default:
      return "No Expiry";
  }
}

export function TeacherDocumentsTab({ teacher }: Props) {
  const [uploadModalOpen, setUploadModalOpen] = React.useState(false);

  const { data: documentsData, isLoading } = useTeacherDocuments(teacher.id);
  const documents = documentsData?.data ?? [];

  const deleteDocumentMutation = useDeleteDocument();
  const busy = useBusyToast();

  const handleDownload = (doc: TeacherDocumentDTO) => {
    // Open document in new tab for download
    window.open(doc.fileUrl, "_blank");
  };

  const handleDelete = async (doc: TeacherDocumentDTO) => {
    if (
      !confirm(
        `Are you sure you want to delete "${doc.name}"?\n\nThis action cannot be undone.`
      )
    )
      return;

    try {
      await busy.promise(
        deleteDocumentMutation.mutateAsync({
          teacherId: teacher.id,
          documentId: doc.id,
        }),
        {
          loading: "Deleting document...",
          success: `"${doc.name}" deleted successfully`,
          error: (e: Error) => e.message || "Failed to delete document",
        }
      );
    } catch {
      // Error already handled by busy.promise
    }
  };

  // Group documents by expiry status
  const expiredDocs = documents.filter((d) => d.expiryStatus === "expired");
  const expiringSoonDocs = documents.filter((d) => d.expiryStatus === "expiring_soon");
  const validDocs = documents.filter((d) => d.expiryStatus === "valid");
  const noExpiryDocs = documents.filter((d) => !d.expiryStatus);

  return (
    <div className="space-y-4">
      {/* Header with upload button */}
      <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>Documents</CardTitle>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => setUploadModalOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Upload Document
          </Button>
        </CardHeader>
      </Card>

      {/* Expiry warnings */}
      {(expiredDocs.length > 0 || expiringSoonDocs.length > 0) && (
        <div className="space-y-2">
          {expiredDocs.length > 0 && (
            <div className="rounded-lg border border-red-400/20 bg-red-500/10 p-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-200" />
                <p className="text-sm font-semibold text-red-200">
                  {expiredDocs.length} Expired Document{expiredDocs.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
          )}
          {expiringSoonDocs.length > 0 && (
            <div className="rounded-lg border border-amber-400/20 bg-amber-500/10 p-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-200" />
                <p className="text-sm font-semibold text-amber-200">
                  {expiringSoonDocs.length} Document{expiringSoonDocs.length !== 1 ? "s" : ""} Expiring Soon
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Documents list */}
      <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
        <CardContent className="p-6">
          {isLoading ? (
            <div className="flex items-center gap-3 py-10">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-white/40" />
              <p className="text-sm text-muted-foreground">Loading documents...</p>
            </div>
          ) : documents.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
              <div className="flex items-start justify-center gap-4">
                <div className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-white/5">
                  <FileText className="h-5 w-5 text-white/80" />
                </div>
                <div className="space-y-1">
                  <p className="text-base font-semibold">No documents yet</p>
                  <p className="text-sm text-muted-foreground">
                    Upload the first document to get started.
                  </p>
                </div>
              </div>
              <div className="mt-4">
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => setUploadModalOpen(true)}
                >
                  <Plus className="h-4 w-4" />
                  Upload First Document
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="group flex items-start justify-between gap-4 rounded-lg border border-white/10 bg-white/5 p-4 transition-colors hover:bg-white/8"
                >
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <div className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-lg border border-white/10 bg-white/5">
                      <FileText className="h-5 w-5 text-white/60" />
                    </div>
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{doc.name}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <Badge
                              variant="outline"
                              className="border-white/10 bg-white/5 text-xs"
                            >
                              {getTypeLabel(doc.type)}
                            </Badge>
                            {doc.expiryStatus && (
                              <Badge
                                variant="outline"
                                className={getExpiryBadgeClass(doc.expiryStatus)}
                              >
                                {getExpiryLabel(doc.expiryStatus)}
                              </Badge>
                            )}
                            {doc.category && (
                              <span className="text-xs text-muted-foreground">
                                {doc.category}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                        {doc.issueDate && (
                          <div>
                            <span className="font-medium">Issued:</span> {formatDate(doc.issueDate)}
                          </div>
                        )}
                        {doc.expiryDate && (
                          <div>
                            <span className="font-medium">Expires:</span> {formatDate(doc.expiryDate)}
                          </div>
                        )}
                        {doc.fileSize && (
                          <div>
                            <span className="font-medium">Size:</span> {formatFileSize(doc.fileSize)}
                          </div>
                        )}
                      </div>

                      {doc.notes && (
                        <p className="text-xs text-white/70 line-clamp-2">{doc.notes}</p>
                      )}

                      {doc.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {doc.tags.map((tag, idx) => (
                            <Badge
                              key={idx}
                              variant="outline"
                              className="border-white/5 bg-white/5 text-xs text-white/60"
                            >
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-white/60 hover:text-white hover:bg-white/10"
                      onClick={() => handleDownload(doc)}
                      title="Download document"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-white/60 hover:text-red-300 hover:bg-red-500/10"
                      onClick={() => handleDelete(doc)}
                      disabled={deleteDocumentMutation.isPending}
                      title="Delete document"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload Modal */}
      <UploadDocumentModal
        open={uploadModalOpen}
        onOpenChange={setUploadModalOpen}
        teacherId={teacher.id}
        teacherName={teacher.fullName}
      />
    </div>
  );
}
