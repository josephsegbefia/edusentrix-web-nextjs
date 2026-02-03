// src/components/admin/teachers/detail/TeacherDocumentsTab.tsx
"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Download,
  Trash2,
  FileText,
  AlertTriangle,
  Clock,
  FolderOpen,
  File,
  Calendar,
  Tag,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useTeacherDocuments,
  useDeleteDocument,
  type TeacherDocumentDTO,
} from "@/hooks/admin/useTeacherDocuments";
import { useBusyToast } from "@/hooks/useBusyToast";
import { UploadDocumentModal } from "@/components/modals/UploadDocumentModal";
import { useConfirmationDialog } from "@/hooks/useConfirmationDialog";

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

const expiryConfig = {
  expired: {
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    text: "text-red-200",
    label: "Expired",
  },
  expiring_soon: {
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    text: "text-amber-200",
    label: "Expiring Soon",
  },
  valid: {
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    text: "text-emerald-200",
    label: "Valid",
  },
} as const;

export function TeacherDocumentsTab({ teacher }: Props) {
  const { confirm, confirmationDialog } = useConfirmationDialog();
  const [uploadModalOpen, setUploadModalOpen] = React.useState(false);

  const { data: documentsData, isLoading } = useTeacherDocuments(teacher.id);
  const documents = documentsData?.data ?? [];

  const deleteDocumentMutation = useDeleteDocument();
  const busy = useBusyToast();

  const handleDownload = (doc: TeacherDocumentDTO) => {
    window.open(doc.fileUrl, "_blank");
  };

  const handleDelete = async (doc: TeacherDocumentDTO) => {
    const decision = await confirm({
      title: "Delete Document?",
      description: `Are you sure you want to delete "${doc.name}"? This action cannot be undone.`,
      confirmLabel: "Delete Document",
      cancelLabel: "Keep Document",
      intent: "destructive",
    });
    if (decision !== "confirm") return;

    try {
      await busy.promise(
        deleteDocumentMutation.mutateAsync({
          teacherId: teacher.id,
          documentId: doc.id,
        }),
        {
          loading: "Deleting document...",
          success: `"${doc.name}" deleted successfully`,
          error: "Failed to delete document",
        }
      );
    } catch {
      // Error already handled by busy.promise
    }
  };

  // Group documents by expiry status
  const expiredDocs = documents.filter((d) => d.expiryStatus === "expired");
  const expiringSoonDocs = documents.filter(
    (d) => d.expiryStatus === "expiring_soon"
  );

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 via-slate-950/90 to-black shadow-2xl shadow-black/40 backdrop-blur-xl">
        <div
          className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-linear-to-br from-amber-500/15 via-orange-500/10 to-transparent blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/20 to-transparent"
          aria-hidden="true"
        />

        <CardHeader className="relative z-10 flex flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-linear-to-br from-amber-500/20 to-orange-500/20 shadow-inner shadow-white/5">
              <FolderOpen className="h-5 w-5 text-amber-300" />
            </div>
            <div className="space-y-0.5">
              <CardTitle className="text-lg font-semibold tracking-tight text-white">
                Documents
              </CardTitle>
              <p className="text-xs text-white/50">
                {documents.length} document{documents.length !== 1 ? "s" : ""}{" "}
                uploaded
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            className="gap-2 rounded-xl border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
            onClick={() => setUploadModalOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Upload Document
          </Button>
        </CardHeader>
      </Card>

      {/* Expiry warnings */}
      {(expiredDocs.length > 0 || expiringSoonDocs.length > 0) && (
        <div className="space-y-3">
          {expiredDocs.length > 0 && (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 shadow-lg shadow-black/20">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 text-red-300" />
                <div>
                  <p className="text-sm font-semibold text-red-200">
                    {expiredDocs.length} Expired Document
                    {expiredDocs.length !== 1 ? "s" : ""}
                  </p>
                  <p className="text-sm text-red-200/70">
                    Some documents have expired and may need renewal.
                  </p>
                </div>
              </div>
            </div>
          )}
          {expiringSoonDocs.length > 0 && (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 shadow-lg shadow-black/20">
              <div className="flex items-start gap-3">
                <Clock className="mt-0.5 h-5 w-5 text-amber-300" />
                <div>
                  <p className="text-sm font-semibold text-amber-200">
                    {expiringSoonDocs.length} Document
                    {expiringSoonDocs.length !== 1 ? "s" : ""} Expiring Soon
                  </p>
                  <p className="text-sm text-amber-200/70">
                    These documents will expire soon. Consider renewing them.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Documents list */}
      <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 via-slate-950/90 to-black shadow-2xl shadow-black/40 backdrop-blur-xl">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,var(--tw-gradient-stops))] from-amber-500/5 via-transparent to-transparent"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/15 to-transparent"
          aria-hidden="true"
        />

        <CardContent className="relative z-10 p-6">
          {isLoading ? (
            <div className="flex items-center justify-center gap-3 py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-amber-400" />
              <p className="text-sm text-white/60">Loading documents...</p>
            </div>
          ) : documents.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/2 p-8">
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-linear-to-br from-amber-500/20 to-orange-500/20">
                  <FileText className="h-7 w-7 text-amber-300" />
                </div>
                <div className="space-y-1">
                  <p className="text-base font-semibold text-white">
                    No documents yet
                  </p>
                  <p className="text-sm text-white/50">
                    Upload the first document to get started.
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="mt-2 gap-2 rounded-xl border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
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
                <DocumentCard
                  key={doc.id}
                  document={doc}
                  onDownload={handleDownload}
                  onDelete={handleDelete}
                  isDeleting={deleteDocumentMutation.isPending}
                />
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
      {confirmationDialog}
    </div>
  );
}

// Document Card Component
function DocumentCard({
  document: doc,
  onDownload,
  onDelete,
  isDeleting,
}: {
  document: TeacherDocumentDTO;
  onDownload: (doc: TeacherDocumentDTO) => void;
  onDelete: (doc: TeacherDocumentDTO) => void;
  isDeleting: boolean;
}) {
  const expiryStyle = doc.expiryStatus ? expiryConfig[doc.expiryStatus] : null;

  return (
    <div className="group relative overflow-hidden rounded-xl border border-white/10 bg-white/2 p-5 transition-all duration-200 hover:border-amber-500/30 hover:bg-white/5">
      {/* Accent bar */}
      <div
        className={cn(
          "absolute inset-y-0 left-0 w-1",
          doc.expiryStatus === "expired"
            ? "bg-red-500"
            : doc.expiryStatus === "expiring_soon"
            ? "bg-amber-500"
            : "bg-linear-to-b from-amber-500 to-orange-500"
        )}
        aria-hidden="true"
      />

      <div className="flex items-start justify-between gap-4 pl-3">
        <div className="flex items-start gap-4 flex-1 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5">
            <File className="h-5 w-5 text-amber-300" />
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-semibold text-white">
                  {doc.name}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <Badge
                    variant="outline"
                    className="rounded-lg border-white/10 bg-white/5 text-xs text-white/70"
                  >
                    {getTypeLabel(doc.type)}
                  </Badge>
                  {expiryStyle && (
                    <Badge
                      variant="outline"
                      className={cn(
                        "rounded-lg text-xs",
                        expiryStyle.bg,
                        expiryStyle.border,
                        expiryStyle.text
                      )}
                    >
                      {expiryStyle.label}
                    </Badge>
                  )}
                  {doc.category && (
                    <span className="text-xs text-white/50">
                      {doc.category}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs text-white/50">
              {doc.issueDate && (
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Issued: {formatDate(doc.issueDate)}
                </div>
              )}
              {doc.expiryDate && (
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Expires: {formatDate(doc.expiryDate)}
                </div>
              )}
              {doc.fileSize && <div>Size: {formatFileSize(doc.fileSize)}</div>}
            </div>

            {doc.notes && (
              <p className="line-clamp-2 text-xs text-white/60">{doc.notes}</p>
            )}

            {doc.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {doc.tags.map((tag, idx) => (
                  <Badge
                    key={idx}
                    variant="outline"
                    className="gap-1 rounded-lg border-white/5 bg-white/5 text-[10px] text-white/50"
                  >
                    <Tag className="h-2.5 w-2.5" />
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg text-white/60 hover:bg-white/10 hover:text-white"
            onClick={() => onDownload(doc)}
            title="Download document"
          >
            <Download className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg text-white/60 hover:bg-red-500/10 hover:text-red-300"
            onClick={() => onDelete(doc)}
            disabled={isDeleting}
            title="Delete document"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
