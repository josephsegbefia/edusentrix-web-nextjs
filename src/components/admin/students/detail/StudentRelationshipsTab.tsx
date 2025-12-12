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
  UserCheck,
  GraduationCap,
  FolderOpen,
  Star,
  Briefcase,
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
    <div className="mt-4 space-y-6">
      {/* Premium Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-blue-500/10 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <div
            className="pointer-events-none absolute inset-0 bg-linear-to-br from-blue-500/10 via-blue-500/5 to-transparent"
            aria-hidden="true"
          />
          <CardContent className="relative z-10 p-4">
            <div className="mb-2 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/20 border border-blue-400/30">
                <Users className="h-4 w-4 text-blue-200" />
              </div>
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/90">
                Guardians
              </span>
            </div>
            <div className="mb-1 text-2xl font-bold text-foreground">
              {guardians.length}
            </div>
            <p className="text-[10px] text-muted-foreground/80">
              {guardians.filter((g) => g.isPrimary).length > 0
                ? `${guardians.filter((g) => g.isPrimary).length} primary`
                : "No primary guardian"}
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-emerald-500/10 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <div
            className="pointer-events-none absolute inset-0 bg-linear-to-br from-emerald-500/10 via-emerald-500/5 to-transparent"
            aria-hidden="true"
          />
          <CardContent className="relative z-10 p-4">
            <div className="mb-2 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20 border border-emerald-400/30">
                <GraduationCap className="h-4 w-4 text-emerald-200" />
              </div>
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/90">
                Current Class
              </span>
            </div>
            <div className="mb-1 text-lg font-bold text-foreground">
              {grade?.label ?? "--"}
            </div>
            <p className="text-[10px] text-muted-foreground/80">
              {classGroup?.label ?? "No class group"}
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-purple-500/10 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <div
            className="pointer-events-none absolute inset-0 bg-linear-to-br from-purple-500/10 via-purple-500/5 to-transparent"
            aria-hidden="true"
          />
          <CardContent className="relative z-10 p-4">
            <div className="mb-2 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/20 border border-purple-400/30">
                <FolderOpen className="h-4 w-4 text-purple-200" />
              </div>
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/90">
                Documents
              </span>
            </div>
            <div className="mb-1 text-2xl font-bold text-foreground">
              {documents.length}
            </div>
            <p className="text-[10px] text-muted-foreground/80">
              Files uploaded
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Parents & Guardians */}
      <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
        <div
          className="pointer-events-none absolute inset-0 bg-linear-to-br from-primary/5 via-primary/2 to-transparent"
          aria-hidden="true"
        />
        <CardHeader className="relative z-10 flex flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20 border border-primary/30">
              <Users className="h-4 w-4 text-primary-200" />
            </div>
            <CardTitle className="text-sm font-semibold text-white/80">
              Parents & Guardians
            </CardTitle>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setManageGuardiansOpen(true)}
            className="cursor-pointer border border-white/20 bg-black/40 text-[11px] text-white/80 transition-all duration-200 hover:scale-105 hover:border-primary/50 hover:bg-primary/20 hover:text-primary-50 hover:shadow-md hover:shadow-primary/20 active:scale-95"
          >
            <Users className="mr-1.5 h-3.5 w-3.5" />
            Manage Guardians
          </Button>
        </CardHeader>
        <CardContent className="relative z-10 space-y-3 text-xs">
          {guardians.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/15 bg-black/30 px-4 py-8 text-center">
              <Users className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
              <p className="text-[11px] text-muted-foreground/90">
                No guardians have been linked to this student yet.
              </p>
              <p className="mt-1 text-[10px] text-muted-foreground/70">
                When you add parents or guardians, their contact information and
                relationship will appear here.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {guardians.map((g) => (
                <div
                  key={g.id}
                  className={cn(
                    "group relative flex flex-col gap-3 rounded-xl border bg-linear-to-br",
                    "from-blue-500/10 via-blue-500/5 to-transparent",
                    "border-blue-400/30 px-4 py-3 shadow-lg shadow-black/30 backdrop-blur-md",
                    "transition-all duration-150 hover:-translate-y-[2px] hover:border-blue-400/50 hover:shadow-2xl hover:shadow-black/40 cursor-pointer"
                  )}
                >
                  {/* Accent bar */}
                  <div className="pointer-events-none absolute inset-y-0 left-0 w-1 rounded-l-xl bg-blue-400/80" />

                  {/* Subtle top glow */}
                  <div
                    className="pointer-events-none absolute inset-x-8 top-0 h-px bg-linear-to-r from-transparent via-white/30 to-transparent opacity-60"
                    aria-hidden="true"
                  />

                  {/* Top row: avatar + name + badges */}
                  <div className="flex items-start gap-3">
                    <div className="relative shrink-0">
                      <Avatar className="h-12 w-12 border-2 border-white/30 shadow-xl shadow-black/50 ring-2 ring-blue-400/20">
                        {g.photoUrl ? (
                          <AvatarImage src={g.photoUrl} alt={g.fullName} />
                        ) : null}
                        <AvatarFallback className="bg-linear-to-br from-blue-500/30 to-blue-600/20 text-sm font-bold text-blue-50">
                          {getInitials(g.fullName)}
                        </AvatarFallback>
                      </Avatar>
                      {g.isPrimary && (
                        <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full border-2 border-card bg-primary ring-2 ring-card flex items-center justify-center">
                          <Star className="h-2.5 w-2.5 fill-primary text-primary" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 space-y-1.5 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h3 className="truncate text-sm font-semibold text-white">
                          {g.fullName}
                        </h3>
                        {g.isPrimary && (
                          <Badge className="bg-primary/20 border border-primary/30 text-primary-100 text-[9px] font-medium px-1.5 py-0.5">
                            <Star className="mr-1 h-2.5 w-2.5 fill-primary" />
                            Primary
                          </Badge>
                        )}
                      </div>
                      <Badge
                        variant="outline"
                        className="border-white/20 bg-white/5 text-[10px] font-medium"
                      >
                        {getRelationshipLabel(g.relationship)}
                      </Badge>
                    </div>
                  </div>

                  {/* Middle row: contact info */}
                  <div className="flex flex-col gap-1.5 pl-14">
                    {g.phone && (
                      <div className="flex items-center gap-2 text-[11px] text-white/80">
                        <Phone className="h-3 w-3 shrink-0 text-white/60" />
                        <span className="truncate">{g.phone}</span>
                      </div>
                    )}
                    {g.email && (
                      <div className="flex items-center gap-2 text-[11px] text-white/80">
                        <Mail className="h-3 w-3 shrink-0 text-white/60" />
                        <span className="truncate">{g.email}</span>
                      </div>
                    )}
                    {g.occupation && (
                      <div className="flex items-center gap-2 text-[11px] text-white/80">
                        <Briefcase className="h-3 w-3 shrink-0 text-white/60" />
                        <span className="truncate">{g.occupation}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Class & Enrollment */}
      <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
        <div
          className="pointer-events-none absolute inset-0 bg-linear-to-br from-emerald-500/5 via-emerald-500/2 to-transparent"
          aria-hidden="true"
        />
        <CardHeader className="relative z-10 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20 border border-emerald-400/30">
              <School className="h-4 w-4 text-emerald-200" />
            </div>
            <CardTitle className="text-sm font-semibold text-white/80">
              Class & Enrollment
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="relative z-10 space-y-3 text-xs">
          <div className="text-[11px] text-muted-foreground">
            <span className="font-medium">Current Placement</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {grade ? (
              <Badge className="bg-emerald-500/20 border border-emerald-400/30 text-emerald-100 text-[11px] font-semibold px-3 py-1">
                {grade.label}
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="border-white/20 bg-black/30 text-[11px]"
              >
                No grade assigned
              </Badge>
            )}
            {classGroup ? (
              <Badge
                variant="outline"
                className="border-white/20 bg-black/30 text-emerald-100 text-[11px] font-medium px-3 py-1"
              >
                {classGroup.label}
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="border-white/20 bg-black/30 text-[11px]"
              >
                No class group
              </Badge>
            )}
          </div>
          <div className="mt-3 rounded-lg border border-dashed border-white/15 bg-black/30 px-3 py-2">
            <p className="text-[10px] text-muted-foreground/80">
              This section can be extended to show historical classes, promotion
              records and any special placement notes.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Documents */}
      <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
        <div
          className="pointer-events-none absolute inset-0 bg-linear-to-br from-purple-500/5 via-purple-500/2 to-transparent"
          aria-hidden="true"
        />
        <CardHeader className="relative z-10 flex flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/20 border border-purple-400/30">
              <FileText className="h-4 w-4 text-purple-200" />
            </div>
            <CardTitle className="text-sm font-semibold text-white/80">
              Documents
            </CardTitle>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="cursor-pointer border border-white/20 bg-black/40 text-[11px] text-white/80 transition-all duration-200 hover:scale-105 hover:border-blue-400/50 hover:bg-blue-500/20 hover:text-blue-100 hover:shadow-md hover:shadow-blue-500/20 active:scale-95"
          >
            <FileText className="mr-1.5 h-3.5 w-3.5" />
            Upload Document
          </Button>
        </CardHeader>
        <CardContent className="relative z-10 space-y-2 text-xs">
          {documents.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/15 bg-black/30 px-4 py-8 text-center">
              <FolderOpen className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
              <p className="text-[11px] text-muted-foreground/90">
                No documents have been uploaded for this student yet.
              </p>
              <p className="mt-1 text-[10px] text-muted-foreground/70">
                You&apos;ll be able to attach report cards, medical forms and
                other files here.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {documents.map((doc) => (
                <li
                  key={doc.id}
                  className="group flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/30 px-4 py-3 transition-all hover:border-white/20 hover:bg-black/40"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-purple-500/20 border border-purple-400/30">
                      <FileText className="h-4 w-4 text-purple-200" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-semibold text-foreground truncate">
                        {doc.name}
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground/80">
                        <Badge
                          variant="outline"
                          className="border-white/20 bg-white/5 text-[9px]"
                        >
                          {doc.type}
                        </Badge>
                        <span>•</span>
                        <span>{new Date(doc.uploadedAt).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
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
        <ManageGuardiansContent
          studentId={student.id}
          onClose={() => setManageGuardiansOpen(false)}
        />
      </ResponsiveModal>
    </div>
  );
}
