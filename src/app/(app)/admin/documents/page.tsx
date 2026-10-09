"use client";

import * as React from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  FileText,
  AlertTriangle,
  Clock,
  ChevronRight,
  Users,
  GraduationCap,
  Receipt,
  FolderOpen,
  ExternalLink,
  Download,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useExpiringDocuments,
  useSchoolTeacherDocuments,
  type ExpiringDocumentDTO,
  type TeacherDocumentType,
} from "@/hooks/admin/useTeacherDocuments";
import { useTeachers } from "@/hooks/admin/useTeachers";
import { cn } from "@/lib/utils";
import { WorkspaceScope } from "@/components/theme/workspace-scope";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  contract: "Contract",
  certificate: "Certificate",
  license: "License",
  id: "ID",
  resume: "Resume",
  other: "Other",
};

function getTypeLabel(type: string): string {
  return DOCUMENT_TYPE_LABELS[type] || type;
}

function ExpiringDocumentRow({
  doc,
  onViewTeacher,
}: {
  doc: ExpiringDocumentDTO;
  onViewTeacher?: (teacherId: string) => void;
}) {
  const isExpired = doc.daysUntilExpiry < 0;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-xl border p-4 transition-all hover:border-(--ws-line-strong)",
        isExpired
          ? "border-red-500/30 bg-red-500/5"
          : "border-amber-500/20 bg-amber-500/5"
      )}
    >
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
          isExpired ? "bg-red-500/20" : "bg-amber-500/20"
        )}
      >
        <FileText className={cn("h-5 w-5", isExpired ? "text-(--ws-rose)" : "text-(--ws-amber)")} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-(--ws-fg) truncate">{doc.name}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-(--ws-fg-60)">
          <Badge variant="outline" className="border-(--ws-line-strong) text-[10px]">
            {getTypeLabel(doc.type)}
          </Badge>
          {doc.teacher && (
            <button
              type="button"
              onClick={() => onViewTeacher?.(doc.teacher!.id)}
              className="hover:text-(--ws-fg-90) transition-colors"
            >
              {doc.teacher.name}
            </button>
          )}
          <span>
            {isExpired
              ? `Expired ${format(new Date(doc.expiryDate), "MMM d, yyyy")}`
              : `${doc.daysUntilExpiry} days left`}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1 text-(--ws-fg-70) hover:text-(--ws-fg)"
          onClick={() => window.open(doc.fileUrl, "_blank")}
        >
          <Download className="h-4 w-4" />
          Download
        </Button>
        {doc.teacher && (
          <Link href={`/admin/teachers/${doc.teacher.id}?tab=documents`}>
            <Button variant="outline" size="sm" className="h-8 gap-1 border-(--ws-line-strong)">
              <ExternalLink className="h-4 w-4" />
              View
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}

export default function DocumentsPage() {
  const [daysAhead, setDaysAhead] = React.useState(30);
  const [docTypeFilter, setDocTypeFilter] = React.useState<string>("all");
  const [teacherFilter, setTeacherFilter] = React.useState<string>("all");
  const [documentsPage, setDocumentsPage] = React.useState(1);

  const { data: expiringData, isLoading: expiringLoading } = useExpiringDocuments(
    daysAhead,
    true // include expired
  );
  const expiringDocs = expiringData?.data ?? [];

  const { data: teachersData } = useTeachers({ limit: 100, tab: "active" });
  const teachers = teachersData?.data ?? [];

  const { data: docsData, isLoading: docsLoading } = useSchoolTeacherDocuments({
    type: docTypeFilter !== "all" ? (docTypeFilter as TeacherDocumentType) : undefined,
    teacherId: teacherFilter !== "all" ? teacherFilter : undefined,
    page: documentsPage,
    limit: 15,
    sortBy: "expiryDate",
    sortOrder: "asc",
  });
  const allDocs = docsData?.data ?? [];
  const docsPagination = docsData?.pagination ?? { page: 1, totalPages: 1, total: 0 };

  const expiredCount = expiringDocs.filter((d) => d.daysUntilExpiry < 0).length;
  const expiringSoonCount = expiringDocs.filter((d) => d.daysUntilExpiry >= 0).length;

  return (
    <WorkspaceScope>
    <div className="space-y-6">
      {/* Page Header */}
      <div className="relative">
        <div
          className="pointer-events-none absolute -left-20 -top-20 h-56 w-56 rounded-full bg-violet-500/10 blur-3xl"
          aria-hidden="true"
        />
        <div className="relative z-10">
          <h1 className="text-3xl font-extrabold tracking-tight text-(--ws-fg) lg:text-4xl">
            Documents
          </h1>
          <p className="mt-1 text-sm text-(--ws-fg-60)">
            Manage teacher documents, track expiring items, and access document management areas
          </p>
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          href="/admin/teachers"
          className="group flex items-center gap-4 rounded-xl border border-(--ws-line) bg-(--ws-fill) p-4 transition-all hover:border-violet-500/30 hover:bg-(--ws-fill-strong)"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-violet-500/30 bg-violet-500/20">
            <Users className="h-6 w-6 text-(--ws-violet)" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-(--ws-fg)">Teacher Documents</p>
            <p className="text-xs text-(--ws-fg-70)">Upload & manage per teacher</p>
          </div>
          <ChevronRight className="h-5 w-5 text-(--ws-fg-40) group-hover:text-(--ws-fg-60)" />
        </Link>
        <Link
          href="/admin/students"
          className="group flex items-center gap-4 rounded-xl border border-(--ws-line) bg-(--ws-fill) p-4 transition-all hover:border-cyan-500/30 hover:bg-(--ws-fill-strong)"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/20">
            <GraduationCap className="h-6 w-6 text-(--ws-cyan)" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-(--ws-fg)">Student Documents</p>
            <p className="text-xs text-(--ws-fg-70)">In student Relationships tab</p>
          </div>
          <ChevronRight className="h-5 w-5 text-(--ws-fg-40) group-hover:text-(--ws-fg-60)" />
        </Link>
        <Link
          href="/admin/expenses"
          className="group flex items-center gap-4 rounded-xl border border-(--ws-line) bg-(--ws-fill) p-4 transition-all hover:border-amber-500/30 hover:bg-(--ws-fill-strong)"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/20">
            <Receipt className="h-6 w-6 text-(--ws-amber)" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-(--ws-fg)">Expense Receipts</p>
            <p className="text-xs text-(--ws-fg-70)">Attached to expense entries</p>
          </div>
          <ChevronRight className="h-5 w-5 text-(--ws-fg-40) group-hover:text-(--ws-fg-60)" />
        </Link>
        <Link
          href="/admin/reports"
          className="group flex items-center gap-4 rounded-xl border border-(--ws-line) bg-(--ws-fill) p-4 transition-all hover:border-emerald-500/30 hover:bg-(--ws-fill-strong)"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/20">
            <FileText className="h-6 w-6 text-(--ws-emerald)" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-(--ws-fg)">Reports</p>
            <p className="text-xs text-(--ws-fg-70)">Generate & download PDFs</p>
          </div>
          <ChevronRight className="h-5 w-5 text-(--ws-fg-40) group-hover:text-(--ws-fg-60)" />
        </Link>
      </div>

      {/* Expiring Documents */}
      <Card className="border border-(--ws-line) bg-linear-to-br from-(--ws-panel-from) via-(--ws-panel-via) to-(--ws-panel-to) backdrop-blur-xl">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/20">
              <Clock className="h-5 w-5 text-(--ws-amber)" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold text-(--ws-fg)">
                Expiring & Expired Documents
              </CardTitle>
              <p className="text-xs text-(--ws-fg-70)">
                Teacher contracts, licenses, certificates, and IDs
              </p>
            </div>
          </div>
          <PremiumSelect value={String(daysAhead)} onValueChange={(v) => setDaysAhead(Number(v))}>
            <PremiumSelectTrigger className="w-36 border-(--ws-line) bg-(--ws-fill) text-(--ws-fg)">
              <PremiumSelectValue />
            </PremiumSelectTrigger>
            <PremiumSelectContent>
              <PremiumSelectItem value="30" className="focus:bg-(--ws-fill-strong)">
                Next 30 days
              </PremiumSelectItem>
              <PremiumSelectItem value="60" className="focus:bg-(--ws-fill-strong)">
                Next 60 days
              </PremiumSelectItem>
              <PremiumSelectItem value="90" className="focus:bg-(--ws-fill-strong)">
                Next 90 days
              </PremiumSelectItem>
            </PremiumSelectContent>
          </PremiumSelect>
        </CardHeader>
        <CardContent className="space-y-4">
          {(expiredCount > 0 || expiringSoonCount > 0) && (
            <div className="flex flex-wrap gap-3">
              {expiredCount > 0 && (
                <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2">
                  <AlertTriangle className="h-4 w-4 text-(--ws-rose)" />
                  <span className="text-sm font-medium text-(--ws-rose)">
                    {expiredCount} expired
                  </span>
                </div>
              )}
              {expiringSoonCount > 0 && (
                <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
                  <Clock className="h-4 w-4 text-(--ws-amber)" />
                  <span className="text-sm font-medium text-(--ws-amber)">
                    {expiringSoonCount} expiring soon
                  </span>
                </div>
              )}
            </div>
          )}

          {expiringLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 rounded-xl bg-(--ws-fill)" />
              ))}
            </div>
          ) : expiringDocs.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-(--ws-line) bg-(--ws-fill) py-12">
              <FolderOpen className="h-12 w-12 text-(--ws-fg-40)" />
              <p className="mt-3 text-sm font-medium text-(--ws-fg-70)">
                No expiring or expired documents
              </p>
              <p className="text-xs text-(--ws-fg-70)">
                Documents with expiry dates will appear here
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {expiringDocs.map((doc) => (
                <ExpiringDocumentRow key={doc.id} doc={doc} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* All Teacher Documents */}
      <Card className="border border-(--ws-line) bg-linear-to-br from-(--ws-panel-from) via-(--ws-panel-via) to-(--ws-panel-to) backdrop-blur-xl">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-violet-500/30 bg-violet-500/20">
              <FileText className="h-5 w-5 text-(--ws-violet)" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold text-(--ws-fg)">
                All Teacher Documents
              </CardTitle>
              <p className="text-xs text-(--ws-fg-70)">
                {docsPagination.total} document{docsPagination.total !== 1 ? "s" : ""} total
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <PremiumSelect value={docTypeFilter} onValueChange={setDocTypeFilter}>
              <PremiumSelectTrigger className="w-36 border-(--ws-line) bg-(--ws-fill) text-(--ws-fg)">
                <PremiumSelectValue placeholder="Type" />
              </PremiumSelectTrigger>
              <PremiumSelectContent>
                <PremiumSelectItem value="all" className="focus:bg-(--ws-fill-strong)">
                  All types
                </PremiumSelectItem>
                {Object.entries(DOCUMENT_TYPE_LABELS).map(([value, label]) => (
                  <PremiumSelectItem key={value} value={value} className="focus:bg-(--ws-fill-strong)">
                    {label}
                  </PremiumSelectItem>
                ))}
              </PremiumSelectContent>
            </PremiumSelect>
            <PremiumSelect value={teacherFilter} onValueChange={(v) => { setTeacherFilter(v); setDocumentsPage(1); }}>
              <PremiumSelectTrigger className="w-44 border-(--ws-line) bg-(--ws-fill) text-(--ws-fg)">
                <PremiumSelectValue placeholder="Teacher" />
              </PremiumSelectTrigger>
              <PremiumSelectContent>
                <PremiumSelectItem value="all" className="focus:bg-(--ws-fill-strong)">
                  All teachers
                </PremiumSelectItem>
                {teachers.map((t) => (
                  <PremiumSelectItem key={t.id} value={t.id} className="focus:bg-(--ws-fill-strong)">
                    {t.fullName}
                  </PremiumSelectItem>
                ))}
              </PremiumSelectContent>
            </PremiumSelect>
          </div>
        </CardHeader>
        <CardContent>
          {docsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-16 rounded-xl bg-(--ws-fill)" />
              ))}
            </div>
          ) : allDocs.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-(--ws-line) bg-(--ws-fill) py-12">
              <FolderOpen className="h-12 w-12 text-(--ws-fg-40)" />
              <p className="mt-3 text-sm font-medium text-(--ws-fg-70)">
                No documents found
              </p>
              <p className="text-xs text-(--ws-fg-70)">
                Upload documents from a teacher&apos;s profile
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {allDocs.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex flex-wrap items-center gap-3 rounded-xl border border-(--ws-line) bg-(--ws-fill) p-4 transition-all hover:border-(--ws-line-strong)"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/20">
                      <FileText className="h-5 w-5 text-(--ws-violet)" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-(--ws-fg) truncate">{doc.name}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-(--ws-fg-60)">
                        <Badge variant="outline" className="border-(--ws-line-strong) text-[10px]">
                          {getTypeLabel(doc.type)}
                        </Badge>
                        {doc.teacher && (
                          <Link
                            href={`/admin/teachers/${doc.teacher.id}?tab=documents`}
                            className="hover:text-(--ws-fg-90) transition-colors"
                          >
                            {doc.teacher.name}
                          </Link>
                        )}
                        {doc.expiryStatus && (
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px]",
                              doc.expiryStatus === "expired" && "border-red-500/30 text-(--ws-rose)",
                              doc.expiryStatus === "expiring_soon" && "border-amber-500/30 text-(--ws-amber)",
                              doc.expiryStatus === "valid" && "border-emerald-500/30 text-(--ws-emerald)"
                            )}
                          >
                            {doc.expiryStatus === "expired"
                              ? "Expired"
                              : doc.expiryStatus === "expiring_soon"
                                ? "Expiring soon"
                                : "Valid"}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-1 text-(--ws-fg-70) hover:text-(--ws-fg)"
                        onClick={() => window.open(doc.fileUrl, "_blank")}
                      >
                        <Download className="h-4 w-4" />
                        Download
                      </Button>
                      {doc.teacher && (
                        <Link href={`/admin/teachers/${doc.teacher.id}?tab=documents`}>
                          <Button variant="outline" size="sm" className="h-8 gap-1 border-(--ws-line-strong)">
                            <ExternalLink className="h-4 w-4" />
                            View
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {docsPagination.totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-xs text-(--ws-fg-70)">
                    Page {docsPagination.page} of {docsPagination.totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={docsPagination.page <= 1}
                      onClick={() => setDocumentsPage((p) => Math.max(1, p - 1))}
                      className="border-(--ws-line)"
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={docsPagination.page >= docsPagination.totalPages}
                      onClick={() => setDocumentsPage((p) => p + 1)}
                      className="border-(--ws-line)"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
    </WorkspaceScope>
  );
}
