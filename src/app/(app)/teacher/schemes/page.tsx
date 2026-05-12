"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BookOpenCheck, CheckCircle2, FileSpreadsheet, Plus, Route, Trash2 } from "lucide-react";
import {
  useTeacherSchemeCreate,
  useTeacherSchemeDelete,
  useTeacherSchemes,
} from "@/hooks/teacher/useTeacherSchemes";
import { useTeacherClasses } from "@/hooks/teacher/useTeacherClasses";
import { useTeacherContext } from "@/hooks/teacher/useTeacherContext";
import { useBusyToast } from "@/hooks/useBusyToast";
import { useConfirmationDialog } from "@/hooks/useConfirmationDialog";
import { can } from "@/lib/auth/can";
import { PERMISSIONS, type Permission } from "@/lib/rbac";
import type { SchemeRow, SchemeStatus } from "@/types/schemes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import { cn } from "@/lib/utils";

const statusLabels: Record<SchemeStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  needs_revision: "Needs revision",
  approved: "Approved",
  active: "Active",
  archived: "Archived",
  rejected: "Rejected",
};

function SchemeStatusBadge({ status }: { status: SchemeStatus }) {
  const tone =
    status === "active"
      ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-100"
      : status === "approved"
        ? "border-blue-400/30 bg-blue-500/15 text-blue-100"
        : status === "submitted"
          ? "border-amber-400/30 bg-amber-500/15 text-amber-100"
          : status === "needs_revision"
            ? "border-orange-400/30 bg-orange-500/15 text-orange-100"
            : status === "rejected"
              ? "border-rose-400/30 bg-rose-500/15 text-rose-100"
              : "border-white/15 bg-white/8 text-white/70";
  return (
    <Badge variant="outline" className={cn(tone)}>
      {statusLabels[status]}
    </Badge>
  );
}

function teacherMayDeleteSchemeClient(
  scheme: SchemeRow,
  teacherId: string,
  permissions: Permission[]
): boolean {
  if (!can(permissions, PERMISSIONS.schemeOfWorkUpdate)) return false;
  if (!["draft", "needs_revision", "rejected"].includes(scheme.status)) return false;
  if (can(permissions, PERMISSIONS.schemeOfWorkApprove)) return true;
  return Boolean(scheme.ownerTeacherId && scheme.ownerTeacherId === teacherId);
}

export default function TeacherSchemesPage() {
  const [title, setTitle] = useState("");
  const [assignmentKey, setAssignmentKey] = useState("");
  const { data = [], isLoading, error } = useTeacherSchemes();
  const { data: classesData } = useTeacherClasses();
  const createMutation = useTeacherSchemeCreate();
  const deleteMutation = useTeacherSchemeDelete();
  const busyToast = useBusyToast();
  const { confirm, confirmationDialog } = useConfirmationDialog();
  const { data: ctxRes } = useTeacherContext();
  const permissions = (ctxRes?.data?.permissions ?? []) as Permission[];
  const teacherId = ctxRes?.data?.teacher?._id ?? "";
  const schoolCurriculumCode = ctxRes?.data?.school?.curriculumCode;
  const isNaCCASchool = schoolCurriculumCode === "ghana_nacca";
  const canImport = isNaCCASchool && can(permissions, PERMISSIONS.schemeImportUpload);
  const currentPeriodId = ctxRes?.data?.currentPeriod?._id;

  const assignmentOptions = useMemo(() => {
    const rows = classesData?.data?.classes || [];
    const seen = new Set<string>();
    return rows
      .filter((row) => row._id && row.gradeId && row.subjectId)
      .map((row) => ({
        key: `${row.gradeId}|${row.subjectId}`,
        gradeId: row.gradeId,
        gradeName: row.gradeName,
        subjectId: row.subjectId,
        subjectName: row.subjectName,
        label: `${row.gradeName} · ${row.subjectName}`,
        description: "Applies to all class groups in this grade",
      }))
      .filter((row) => {
        if (seen.has(row.key)) return false;
        seen.add(row.key);
        return true;
      });
  }, [classesData]);

  const selectedAssignment = assignmentOptions.find((option) => option.key === assignmentKey);

  async function createScheme() {
    const trimmed = title.trim();
    if (!trimmed || !selectedAssignment) return;
    await createMutation.mutateAsync({
      title: trimmed,
      academicPeriodId: currentPeriodId,
      gradeId: selectedAssignment.gradeId,
      subjectId: selectedAssignment.subjectId,
    });
    setTitle("");
    setAssignmentKey("");
  }

  async function handleDeleteScheme(scheme: SchemeRow) {
    const result = await confirm({
      title: "Delete scheme",
      description: `Permanently delete “${scheme.title}”? All weekly rows and review history for this Scheme of Learning will be removed. This cannot be undone.`,
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
      intent: "destructive",
    });
    if (result !== "confirm") return;
    await busyToast.promise(deleteMutation.mutateAsync(scheme.id), {
      loading: "Deleting scheme…",
      success: "Scheme deleted",
      error: "Could not delete scheme",
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 p-4 md:p-6">
      {confirmationDialog}
      <section className="rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.16),transparent_34%),linear-gradient(135deg,rgba(15,23,42,0.94),rgba(2,6,23,0.82))] p-5 shadow-2xl shadow-black/20">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/70">
              <BookOpenCheck className="h-3.5 w-3.5 text-emerald-200" />
              Teaching plan
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">Schemes of Learning</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/65">
              Prepare grade and subject learning plans
              {isNaCCASchool ? ", import official GES-style documents," : ""} and submit them for review.
            </p>
          </div>
          {canImport ? (
            <Button asChild className="bg-emerald-500 text-white hover:bg-emerald-400">
              <Link href="/teacher/schemes/import">
                <FileSpreadsheet className="h-4 w-4" />
                Import Scheme
              </Link>
            </Button>
          ) : null}
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-4">
          {[
            { icon: FileSpreadsheet, label: "Upload", text: "Use the official scheme document" },
            { icon: Route, label: "Tie context", text: "Select exact grade and subject" },
            { icon: CheckCircle2, label: "Review", text: "Check extracted weekly rows" },
            { icon: BookOpenCheck, label: "Submit", text: "Send the plan for admin approval" },
          ].map((step, index) => (
            <div key={step.label} className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-white/5 text-xs text-white/65">
                  {index + 1}
                </span>
                <step.icon className="h-4 w-4 text-emerald-200" />
              </div>
              <p className="mt-2 text-sm font-medium text-white">{step.label}</p>
              <p className="mt-0.5 text-xs text-white/45">{step.text}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(260px,360px)_auto]">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="New Scheme of Learning title"
            className="border-white/10 bg-white/[0.07] text-white placeholder:text-white/35 focus-visible:border-emerald-300/45 focus-visible:ring-emerald-400/20"
          />
          <PremiumSelect value={assignmentKey} onValueChange={setAssignmentKey}>
            <PremiumSelectTrigger className="border-white/10 bg-white/[0.07] text-white">
              <PremiumSelectValue placeholder="Select class and subject" />
            </PremiumSelectTrigger>
            <PremiumSelectContent>
              {assignmentOptions.map((option) => (
                <PremiumSelectItem key={option.key} value={option.key} description={option.description}>
                  {option.label}
                </PremiumSelectItem>
              ))}
            </PremiumSelectContent>
          </PremiumSelect>
          <Button
            type="button"
            onClick={createScheme}
            disabled={createMutation.isPending || !title.trim() || !selectedAssignment}
            className="bg-emerald-500 text-white hover:bg-emerald-400"
          >
            <Plus className="h-4 w-4" />
            {createMutation.isPending ? "Creating..." : "Create"}
          </Button>
        </div>
      </section>

      {error ? <p className="text-sm text-rose-300">{error.message}</p> : null}
      {isLoading ? <p className="text-sm text-white/70">Loading Schemes of Learning...</p> : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {data.map((scheme) => {
          const showDelete = teacherMayDeleteSchemeClient(scheme, teacherId, permissions);
          return (
            <Card
              key={scheme.id}
              className="relative h-full border-white/10 bg-slate-950/40 text-white transition hover:border-emerald-300/30 hover:bg-slate-950/55"
            >
              {showDelete ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={deleteMutation.isPending}
                  className="absolute right-3 top-3 z-10 h-9 w-9 text-white/50 hover:bg-rose-500/15 hover:text-rose-200"
                  aria-label={`Delete ${scheme.title}`}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    void handleDeleteScheme(scheme);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              ) : null}
              <Link href={`/teacher/schemes/${scheme.id}`} className="group block">
                <CardHeader className="pb-3 pr-14">
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle className="line-clamp-2 text-base font-semibold text-white">{scheme.title}</CardTitle>
                    <SchemeStatusBadge status={scheme.status} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <p className="text-white/60">
                    {scheme.gradeName || "Grade pending"} · {scheme.subjectName || "Subject pending"}
                    {!scheme.classGroupId ? " · All class groups" : ""}
                  </p>
                  <div className="flex items-center justify-between border-t border-white/10 pt-3 text-xs text-white/45">
                    <span>{scheme.academicPeriodLabel || "Current period"}</span>
                    <span>Updated {new Date(scheme.updatedAt).toLocaleDateString()}</span>
                  </div>
                </CardContent>
              </Link>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
