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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useExpiringDocuments,
  useSchoolTeacherDocuments,
  type ExpiringDocumentDTO,
  type TeacherDocumentType,
} from "@/hooks/admin/useTeacherDocuments";
import { useTeachers } from "@/hooks/admin/useTeachers";
import { cn } from "@/lib/utils";

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
        "flex flex-wrap items-center gap-3 rounded-xl border p-4 transition-all hover:border-white/20",
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
        <FileText className={cn("h-5 w-5", isExpired ? "text-red-300" : "text-amber-300")} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-white truncate">{doc.name}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-white/60">
          <Badge variant="outline" className="border-white/20 text-[10px]">
            {getTypeLabel(doc.type)}
          </Badge>
          {doc.teacher && (
            <button
              type="button"
              onClick={() => onViewTeacher?.(doc.teacher!.id)}
              className="hover:text-white/90 transition-colors"
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
          className="h-8 gap-1 text-white/70 hover:text-white"
          onClick={() => window.open(doc.fileUrl, "_blank")}
        >
          <Download className="h-4 w-4" />
          Download
        </Button>
        {doc.teacher && (
          <Link href={`/admin/teachers/${doc.teacher.id}?tab=documents`}>
            <Button variant="outline" size="sm" className="h-8 gap-1 border-white/20">
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
    <div className="space-y-6">
      {/* Page Header */}
      <div className="relative">
        <div
          className="pointer-events-none absolute -left-20 -top-20 h-56 w-56 rounded-full bg-violet-500/10 blur-3xl"
          aria-hidden="true"
        />
        <div className="relative z-10">
          <h1 className="bg-gradient-to-r from-violet-200 via-purple-200 to-fuchsia-300 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent lg:text-4xl">
            Documents
          </h1>
          <p className="mt-1 text-sm text-white/60">
            Manage teacher documents, track expiring items, and access document management areas
          </p>
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          href="/admin/teachers"
          className="group flex items-center gap-4 rounded-xl border border-white/10 bg-white/5 p-4 transition-all hover:border-violet-500/30 hover:bg-white/10"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-violet-500/30 bg-violet-500/20">
            <Users className="h-6 w-6 text-violet-300" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-white">Teacher Documents</p>
            <p className="text-xs text-white/50">Upload & manage per teacher</p>
          </div>
          <ChevronRight className="h-5 w-5 text-white/30 group-hover:text-white/60" />
        </Link>
        <Link
          href="/admin/students"
          className="group flex items-center gap-4 rounded-xl border border-white/10 bg-white/5 p-4 transition-all hover:border-cyan-500/30 hover:bg-white/10"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/20">
            <GraduationCap className="h-6 w-6 text-cyan-300" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-white">Student Documents</p>
            <p className="text-xs text-white/50">In student Relationships tab</p>
          </div>
          <ChevronRight className="h-5 w-5 text-white/30 group-hover:text-white/60" />
        </Link>
        <Link
          href="/admin/expenses"
          className="group flex items-center gap-4 rounded-xl border border-white/10 bg-white/5 p-4 transition-all hover:border-amber-500/30 hover:bg-white/10"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/20">
            <Receipt className="h-6 w-6 text-amber-300" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-white">Expense Receipts</p>
            <p className="text-xs text-white/50">Attached to expense entries</p>
          </div>
          <ChevronRight className="h-5 w-5 text-white/30 group-hover:text-white/60" />
        </Link>
        <Link
          href="/admin/reports"
          className="group flex items-center gap-4 rounded-xl border border-white/10 bg-white/5 p-4 transition-all hover:border-emerald-500/30 hover:bg-white/10"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/20">
            <FileText className="h-6 w-6 text-emerald-300" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-white">Reports</p>
            <p className="text-xs text-white/50">Generate & download PDFs</p>
          </div>
          <ChevronRight className="h-5 w-5 text-white/30 group-hover:text-white/60" />
        </Link>
      </div>

      {/* Expiring Documents */}
      <Card className="border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-950/90 backdrop-blur-xl">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/20">
              <Clock className="h-5 w-5 text-amber-300" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold text-white">
                Expiring & Expired Documents
              </CardTitle>
              <p className="text-xs text-white/50">
                Teacher contracts, licenses, certificates, and IDs
              </p>
            </div>
          </div>
          <Select value={String(daysAhead)} onValueChange={(v) => setDaysAhead(Number(v))}>
            <SelectTrigger className="w-36 border-white/10 bg-white/5 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30" className="focus:bg-white/10">
                Next 30 days
              </SelectItem>
              <SelectItem value="60" className="focus:bg-white/10">
                Next 60 days
              </SelectItem>
              <SelectItem value="90" className="focus:bg-white/10">
                Next 90 days
              </SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="space-y-4">
          {(expiredCount > 0 || expiringSoonCount > 0) && (
            <div className="flex flex-wrap gap-3">
              {expiredCount > 0 && (
                <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2">
                  <AlertTriangle className="h-4 w-4 text-red-300" />
                  <span className="text-sm font-medium text-red-200">
                    {expiredCount} expired
                  </span>
                </div>
              )}
              {expiringSoonCount > 0 && (
                <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
                  <Clock className="h-4 w-4 text-amber-300" />
                  <span className="text-sm font-medium text-amber-200">
                    {expiringSoonCount} expiring soon
                  </span>
                </div>
              )}
            </div>
          )}

          {expiringLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 rounded-xl bg-white/5" />
              ))}
            </div>
          ) : expiringDocs.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-white/10 bg-white/5 py-12">
              <FolderOpen className="h-12 w-12 text-white/30" />
              <p className="mt-3 text-sm font-medium text-white/70">
                No expiring or expired documents
              </p>
              <p className="text-xs text-white/50">
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
      <Card className="border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-950/90 backdrop-blur-xl">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-violet-500/30 bg-violet-500/20">
              <FileText className="h-5 w-5 text-violet-300" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold text-white">
                All Teacher Documents
              </CardTitle>
              <p className="text-xs text-white/50">
                {docsPagination.total} document{docsPagination.total !== 1 ? "s" : ""} total
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={docTypeFilter} onValueChange={setDocTypeFilter}>
              <SelectTrigger className="w-36 border-white/10 bg-white/5 text-white">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="focus:bg-white/10">
                  All types
                </SelectItem>
                {Object.entries(DOCUMENT_TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value} className="focus:bg-white/10">
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={teacherFilter} onValueChange={(v) => { setTeacherFilter(v); setDocumentsPage(1); }}>
              <SelectTrigger className="w-44 border-white/10 bg-white/5 text-white">
                <SelectValue placeholder="Teacher" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="focus:bg-white/10">
                  All teachers
                </SelectItem>
                {teachers.map((t) => (
                  <SelectItem key={t.id} value={t.id} className="focus:bg-white/10">
                    {t.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {docsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-16 rounded-xl bg-white/5" />
              ))}
            </div>
          ) : allDocs.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-white/10 bg-white/5 py-12">
              <FolderOpen className="h-12 w-12 text-white/30" />
              <p className="mt-3 text-sm font-medium text-white/70">
                No documents found
              </p>
              <p className="text-xs text-white/50">
                Upload documents from a teacher&apos;s profile
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {allDocs.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-4 transition-all hover:border-white/20"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/20">
                      <FileText className="h-5 w-5 text-violet-300" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-white truncate">{doc.name}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-white/60">
                        <Badge variant="outline" className="border-white/20 text-[10px]">
                          {getTypeLabel(doc.type)}
                        </Badge>
                        {doc.teacher && (
                          <Link
                            href={`/admin/teachers/${doc.teacher.id}?tab=documents`}
                            className="hover:text-white/90 transition-colors"
                          >
                            {doc.teacher.name}
                          </Link>
                        )}
                        {doc.expiryStatus && (
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px]",
                              doc.expiryStatus === "expired" && "border-red-500/30 text-red-300",
                              doc.expiryStatus === "expiring_soon" && "border-amber-500/30 text-amber-300",
                              doc.expiryStatus === "valid" && "border-emerald-500/30 text-emerald-300"
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
                        className="h-8 gap-1 text-white/70 hover:text-white"
                        onClick={() => window.open(doc.fileUrl, "_blank")}
                      >
                        <Download className="h-4 w-4" />
                        Download
                      </Button>
                      {doc.teacher && (
                        <Link href={`/admin/teachers/${doc.teacher.id}?tab=documents`}>
                          <Button variant="outline" size="sm" className="h-8 gap-1 border-white/20">
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
                  <p className="text-xs text-white/50">
                    Page {docsPagination.page} of {docsPagination.totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={docsPagination.page <= 1}
                      onClick={() => setDocumentsPage((p) => Math.max(1, p - 1))}
                      className="border-white/10"
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={docsPagination.page >= docsPagination.totalPages}
                      onClick={() => setDocumentsPage((p) => p + 1)}
                      className="border-white/10"
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
  );
}
