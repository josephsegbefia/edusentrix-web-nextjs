"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Users,
  FileText,
  School,
  Phone,
  Mail,
  GraduationCap,
  FolderOpen,
  Star,
  Briefcase,
  Plus,
} from "lucide-react";
import type { StudentDetailDTO } from "@/hooks/admin/useStudentDetail";
import { ManageGuardiansContent } from "./ManageGuardiansModal";
import { ResponsiveModal } from "@/components/modals/ResponsiveModal";
import { useGuardianSSE } from "@/hooks/admin/useGuardianSSE";
import { useGuardians } from "@/hooks/admin/useGuardians";
import { useDocumentSSE } from "@/hooks/admin/useDocumentSSE";
import { cn } from "@/lib/utils";

type Props = {
  student: StudentDetailDTO;
};

function getInitials(fullName: string): string {
  const parts = fullName.trim().split(" ");
  const first = parts[0]?.charAt(0)?.toUpperCase() || "";
  const last = parts[parts.length - 1]?.charAt(0)?.toUpperCase() || "";
  return first + last || "?";
}

function getRelationshipLabel(relationship: string): string {
  const labels: Record<string, string> = {
    mother: "Mother",
    father: "Father",
    guardian: "Guardian",
    step_mother: "Step Mother",
    step_father: "Step Father",
    grandmother: "Grandmother",
    grandfather: "Grandfather",
    aunt: "Aunt",
    uncle: "Uncle",
    other: "Other",
  };
  return labels[relationship] || relationship;
}

export function StudentRelationshipsTab({ student }: Props) {
  const { documents, grade, classGroup } = student;
  const [manageGuardiansOpen, setManageGuardiansOpen] = React.useState(false);

  // Real-time updates for guardians and documents
  useGuardianSSE(student.id);
  useDocumentSSE(student.id);

  // Fetch guardians with real-time updates
  const { data: guardians = [] } = useGuardians(student.id);

  return (
    <div className="space-y-6">
      {/* Premium Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 via-slate-950/90 to-black shadow-2xl shadow-black/40 backdrop-blur-xl">
          <div
            className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-linear-to-br from-cyan-500/15 via-teal-500/10 to-transparent blur-3xl"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/20 to-transparent"
            aria-hidden="true"
          />
          <CardContent className="relative z-10 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] font-medium uppercase tracking-wide text-white/50">
                  Guardians
                </div>
                <div className="mt-1 text-2xl font-bold text-white">
                  {guardians.length}
                </div>
                <p className="text-[10px] text-white/50">
                  {guardians.filter((g) => g.isPrimary).length > 0
                    ? `${guardians.filter((g) => g.isPrimary).length} primary`
                    : "No primary guardian"}
                </p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-500/30 bg-linear-to-br from-cyan-500/20 to-teal-500/20 shadow-inner shadow-white/5">
                <Users className="h-5 w-5 text-cyan-300" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 via-slate-950/90 to-black shadow-2xl shadow-black/40 backdrop-blur-xl">
          <div
            className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-linear-to-br from-emerald-500/15 via-emerald-500/10 to-transparent blur-3xl"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/20 to-transparent"
            aria-hidden="true"
          />
          <CardContent className="relative z-10 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] font-medium uppercase tracking-wide text-white/50">
                  Current Class
                </div>
                <div className="mt-1 text-lg font-bold text-white">
                  {grade?.label ?? "--"}
                </div>
                <p className="text-[10px] text-white/50">
                  {classGroup?.label ?? "No class group"}
                </p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-500/30 bg-linear-to-br from-emerald-500/20 to-emerald-600/20 shadow-inner shadow-white/5">
                <GraduationCap className="h-5 w-5 text-emerald-300" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 via-slate-950/90 to-black shadow-2xl shadow-black/40 backdrop-blur-xl">
          <div
            className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-linear-to-br from-violet-500/15 via-violet-500/10 to-transparent blur-3xl"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/20 to-transparent"
            aria-hidden="true"
          />
          <CardContent className="relative z-10 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] font-medium uppercase tracking-wide text-white/50">
                  Documents
                </div>
                <div className="mt-1 text-2xl font-bold text-white">
                  {documents.length}
                </div>
                <p className="text-[10px] text-white/50">Files uploaded</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-violet-500/30 bg-linear-to-br from-violet-500/20 to-violet-600/20 shadow-inner shadow-white/5">
                <FolderOpen className="h-5 w-5 text-violet-300" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Parents & Guardians */}
      <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 via-slate-950/90 to-black shadow-2xl shadow-black/40 backdrop-blur-xl">
        <div
          className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-linear-to-br from-teal-500/15 via-cyan-500/10 to-transparent blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/20 to-transparent"
          aria-hidden="true"
        />

        <CardHeader className="relative z-10 flex flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-linear-to-br from-teal-500/20 to-cyan-500/20 shadow-inner shadow-white/5">
              <Users className="h-5 w-5 text-teal-300" />
            </div>
            <div className="space-y-0.5">
              <CardTitle className="text-lg font-semibold tracking-tight text-white">
                Parents & Guardians
              </CardTitle>
              <p className="text-xs text-white/50">
                {guardians.length} guardian{guardians.length !== 1 ? "s" : ""}{" "}
                linked
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setManageGuardiansOpen(true)}
            className="gap-2 rounded-xl border-teal-500/30 bg-teal-500/10 text-teal-300 hover:bg-teal-500/20"
          >
            <Users className="h-4 w-4" />
            Manage Guardians
          </Button>
        </CardHeader>

        <CardContent className="relative z-10 space-y-4">
          {guardians.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/2 p-8">
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-linear-to-br from-teal-500/20 to-cyan-500/20">
                  <Users className="h-7 w-7 text-teal-300" />
                </div>
                <div className="space-y-1">
                  <p className="text-base font-semibold text-white">
                    No guardians linked
                  </p>
                  <p className="text-sm text-white/50">
                    Add parents or guardians to manage contact information and
                    relationships.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setManageGuardiansOpen(true)}
                  className="mt-2 gap-2 rounded-xl border-teal-500/30 bg-teal-500/10 text-teal-300 hover:bg-teal-500/20"
                >
                  <Plus className="h-4 w-4" />
                  Add Guardian
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {guardians.map((g) => (
                <div
                  key={g.id}
                  className={cn(
                    "group relative overflow-hidden rounded-xl border border-white/10 bg-white/2 p-5 transition-all duration-200 hover:border-teal-500/30 hover:bg-white/5"
                  )}
                >
                  {/* Accent bar */}
                  <div
                    className={cn(
                      "absolute inset-y-0 left-0 w-1 bg-linear-to-b",
                      g.isPrimary
                        ? "from-teal-500 to-cyan-500"
                        : "from-white/20 to-white/10"
                    )}
                    aria-hidden="true"
                  />

                  {/* Content */}
                  <div className="space-y-4 pl-3">
                    {/* Header: Avatar and Primary Badge */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="relative">
                        <Avatar className="h-14 w-14 border-2 border-white/20 shadow-lg ring-2 ring-slate-800/50">
                          {g.photoUrl ? (
                            <AvatarImage src={g.photoUrl} alt={g.fullName} />
                          ) : null}
                          <AvatarFallback className="bg-linear-to-br from-slate-700 to-slate-900 text-base font-bold text-slate-200">
                            {getInitials(g.fullName)}
                          </AvatarFallback>
                        </Avatar>
                        {g.isPrimary && (
                          <div className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-slate-900 bg-teal-500 shadow-lg">
                            <Star className="h-3 w-3 fill-white text-white" />
                          </div>
                        )}
                      </div>

                      {g.isPrimary && (
                        <Badge className="border-teal-500/30 bg-teal-500/10 px-2 py-1 text-[10px] font-semibold text-teal-200 shadow-sm">
                          Primary Contact
                        </Badge>
                      )}
                    </div>

                    {/* Name and Relationship */}
                    <div className="space-y-1">
                      <h3 className="text-sm font-bold leading-tight text-white">
                        {g.fullName}
                      </h3>
                      <div className="flex items-center gap-2">
                        <div className="h-1 w-1 rounded-full bg-teal-500/60" />
                        <span className="text-[11px] font-medium text-white/70">
                          {getRelationshipLabel(g.relationship)}
                        </span>
                      </div>
                    </div>

                    {/* Contact Information */}
                    <div className="space-y-2 border-t border-white/10 pt-3">
                      {g.phone && (
                        <div className="flex items-center gap-2.5 text-[11px]">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5">
                            <Phone className="h-3.5 w-3.5 text-white/60" />
                          </div>
                          <span className="flex-1 truncate text-white/70">
                            {g.phone}
                          </span>
                        </div>
                      )}
                      {g.email && (
                        <div className="flex items-center gap-2.5 text-[11px]">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5">
                            <Mail className="h-3.5 w-3.5 text-white/60" />
                          </div>
                          <span className="flex-1 truncate text-white/70">
                            {g.email}
                          </span>
                        </div>
                      )}
                      {g.occupation && (
                        <div className="flex items-center gap-2.5 text-[11px]">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5">
                            <Briefcase className="h-3.5 w-3.5 text-white/60" />
                          </div>
                          <span className="flex-1 truncate text-white/70">
                            {g.occupation}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Class & Enrollment */}
      <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 via-slate-950/90 to-black shadow-2xl shadow-black/40 backdrop-blur-xl">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,var(--tw-gradient-stops))] from-emerald-500/5 via-transparent to-transparent"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/15 to-transparent"
          aria-hidden="true"
        />

        <CardHeader className="relative z-10 pb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-500/30 bg-linear-to-br from-emerald-500/20 to-emerald-600/20">
              <School className="h-4 w-4 text-emerald-300" />
            </div>
            <CardTitle className="text-base font-semibold text-white">
              Class & Enrollment
            </CardTitle>
          </div>
        </CardHeader>

        <CardContent className="relative z-10 space-y-4">
          <div className="text-[11px] font-medium uppercase tracking-wide text-white/50">
            Current Placement
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {grade ? (
              <Badge className="border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-200">
                {grade.label}
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="border-white/20 bg-white/5 text-[11px] text-white/60"
              >
                No grade assigned
              </Badge>
            )}
            {classGroup ? (
              <Badge
                variant="outline"
                className="border-white/20 bg-white/5 px-3 py-1 text-[11px] font-medium text-emerald-200"
              >
                {classGroup.label}
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="border-white/20 bg-white/5 text-[11px] text-white/60"
              >
                No class group
              </Badge>
            )}
          </div>
          <div className="rounded-xl border border-dashed border-white/10 bg-white/2 px-4 py-3">
            <p className="text-[10px] text-white/50">
              This section can be extended to show historical classes, promotion
              records and any special placement notes.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Documents */}
      <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 via-slate-950/90 to-black shadow-2xl shadow-black/40 backdrop-blur-xl">
        <div
          className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-linear-to-br from-violet-500/15 via-violet-500/10 to-transparent blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/20 to-transparent"
          aria-hidden="true"
        />

        <CardHeader className="relative z-10 flex flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-violet-500/30 bg-linear-to-br from-violet-500/20 to-violet-600/20 shadow-inner shadow-white/5">
              <FileText className="h-5 w-5 text-violet-300" />
            </div>
            <div className="space-y-0.5">
              <CardTitle className="text-lg font-semibold tracking-tight text-white">
                Documents
              </CardTitle>
              <p className="text-xs text-white/50">
                {documents.length} file{documents.length !== 1 ? "s" : ""}{" "}
                uploaded
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2 rounded-xl border-violet-500/30 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20"
          >
            <FileText className="h-4 w-4" />
            Upload Document
          </Button>
        </CardHeader>

        <CardContent className="relative z-10 space-y-3">
          {documents.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/2 p-8">
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-linear-to-br from-violet-500/20 to-violet-600/20">
                  <FolderOpen className="h-7 w-7 text-violet-300" />
                </div>
                <div className="space-y-1">
                  <p className="text-base font-semibold text-white">
                    No documents uploaded
                  </p>
                  <p className="text-sm text-white/50">
                    Upload report cards, medical forms and other files here.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-2 gap-2 rounded-xl border-violet-500/30 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20"
                >
                  <Plus className="h-4 w-4" />
                  Upload Document
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="group relative overflow-hidden rounded-xl border border-white/10 bg-white/2 p-4 transition-all duration-200 hover:border-violet-500/30 hover:bg-white/5"
                >
                  {/* Accent bar */}
                  <div
                    className="absolute inset-y-0 left-0 w-1 bg-linear-to-b from-violet-500 to-violet-600"
                    aria-hidden="true"
                  />

                  <div className="flex items-center justify-between gap-3 pl-3">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-violet-500/30 bg-violet-500/10">
                        <FileText className="h-4 w-4 text-violet-300" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-white">
                          {doc.name}
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-[10px] text-white/50">
                          <Badge
                            variant="outline"
                            className="border-white/20 bg-white/5 text-[9px]"
                          >
                            {doc.type}
                          </Badge>
                          <span>•</span>
                          <span>
                            {new Date(doc.uploadedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Manage Guardians Modal */}
      <ResponsiveModal
        open={manageGuardiansOpen}
        onClose={() => setManageGuardiansOpen(false)}
        title="Manage Guardians"
        widthClass="max-w-[60vw]"
      >
        <ManageGuardiansContent studentId={student.id} />
      </ResponsiveModal>
    </div>
  );
}
