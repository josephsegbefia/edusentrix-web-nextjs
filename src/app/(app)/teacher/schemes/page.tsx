"use client";

import Link from "next/link";
import { BookOpenCheck, Eye, FileText, Route } from "lucide-react";
import { useTeacherSchemes } from "@/hooks/teacher/useTeacherSchemes";
import type { SchemeStatus } from "@/types/schemes";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
        : "border-white/15 bg-white/8 text-white/70";
  return (
    <Badge variant="outline" className={cn(tone)}>
      {statusLabels[status]}
    </Badge>
  );
}

export default function TeacherSchemesPage() {
  const { data = [], isLoading, error } = useTeacherSchemes();

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 p-4 md:p-6">
      <section className="rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.16),transparent_34%),linear-gradient(135deg,rgba(15,23,42,0.94),rgba(2,6,23,0.82))] p-5 shadow-2xl shadow-black/20">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/70">
              <BookOpenCheck className="h-3.5 w-3.5 text-emerald-200" />
              Read-only teaching plan
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">Schemes of Learning</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/65">
              View the approved schemes uploaded by your school admin for the grades and subjects you teach.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {[
            { icon: Route, label: "Matched to you", text: "Only schemes for your assigned grade and subject appear here" },
            { icon: Eye, label: "Read-only", text: "Open a scheme to review the weekly plan without changing it" },
            { icon: FileText, label: "Admin managed", text: "Uploads, imports, approvals, and edits stay with school admins" },
          ].map((item) => (
            <div key={item.label} className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
              <item.icon className="h-4 w-4 text-emerald-200" />
              <p className="mt-2 text-sm font-medium text-white">{item.label}</p>
              <p className="mt-0.5 text-xs text-white/45">{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      {error ? <p className="text-sm text-rose-300">{error.message}</p> : null}
      {isLoading ? <p className="text-sm text-white/70">Loading schemes of learning...</p> : null}

      {!isLoading && data.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-5 py-12 text-center">
          <BookOpenCheck className="mx-auto h-10 w-10 text-white/25" />
          <p className="mt-4 text-sm font-medium text-white/75">No schemes available yet</p>
          <p className="mt-1 text-sm text-white/45">
            When an admin uploads and approves a scheme for a grade and subject you teach, it will appear here.
          </p>
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {data.map((scheme) => (
          <Link key={scheme.id} href={`/teacher/schemes/${scheme.id}`} className="group block">
            <Card className="h-full border-white/10 bg-slate-950/40 text-white transition hover:border-emerald-300/30 hover:bg-slate-950/55">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="line-clamp-2 text-base font-semibold text-white">
                    {scheme.title}
                  </CardTitle>
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
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
