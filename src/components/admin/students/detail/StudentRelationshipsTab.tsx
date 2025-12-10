"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, FileText, School } from "lucide-react";
import type { StudentDetailDTO } from "@/hooks/admin/useStudentDetail";

type Props = {
  student: StudentDetailDTO;
};

export function StudentRelationshipsTab({ student }: Props) {
  const { guardians, documents, grade, classGroup } = student;

  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1.1fr)]">
      {/* Left: guardians */}
      <div className="space-y-4">
        <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <CardHeader className="relative z-10 flex items-center justify-between pb-3">
            <CardTitle className="text-sm font-semibold text-white/80">
              Parents & Guardians
            </CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-white/20 bg-black/40 text-[11px]"
            >
              <Users className="mr-1.5 h-3.5 w-3.5" />
              Manage Guardians
            </Button>
          </CardHeader>
          <CardContent className="relative z-10 space-y-3 text-xs">
            {guardians.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/15 bg-black/30 px-4 py-6 text-center text-[11px] text-muted-foreground/90">
                No guardians have been linked to this student yet. When you add
                parents or guardians, their contact information and relationship
                will appear here.
              </div>
            ) : (
              <div className="grid gap-2 md:grid-cols-2">
                {guardians.map((g) => (
                  <div
                    key={g.id}
                    className="flex flex-col gap-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[11px] font-semibold">
                        {g.fullName}
                      </div>
                      {g.isPrimary && (
                        <Badge className="bg-primary/20 text-[9px]">
                          Primary
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground/85">
                      <span>{g.relationship}</span>
                      {g.phone && (
                        <span className="rounded-full border border-white/15 bg-black/30 px-2 py-0.5">
                          {g.phone}
                        </span>
                      )}
                      {g.email && (
                        <span className="truncate text-[10px]">{g.email}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Right: class info + documents */}
      <div className="space-y-4">
        <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <CardHeader className="relative z-10 pb-3">
            <CardTitle className="text-sm font-semibold text-white/80">
              Class & Enrollment
            </CardTitle>
          </CardHeader>
          <CardContent className="relative z-10 space-y-2 text-xs">
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <School className="h-3.5 w-3.5" />
              Current Placement
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {grade && (
                <Badge className="bg-white/10 text-[11px] font-medium">
                  {grade.label}
                </Badge>
              )}
              {classGroup && (
                <Badge
                  variant="outline"
                  className="border-white/20 bg-black/30 text-[11px]"
                >
                  {classGroup.label}
                </Badge>
              )}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground/85">
              This section can be extended to show historical classes, promotion
              records and any special placement notes.
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
          <CardHeader className="relative z-10 flex items-center justify-between pb-3">
            <CardTitle className="text-sm font-semibold text-white/80">
              Documents
            </CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-white/20 bg-black/40 text-[11px]"
            >
              <FileText className="mr-1.5 h-3.5 w-3.5" />
              Upload Document
            </Button>
          </CardHeader>
          <CardContent className="relative z-10 space-y-2 text-xs">
            {documents.length === 0 ? (
              <p className="text-[11px] text-muted-foreground/90">
                No documents have been uploaded for this student yet.
                You&apos;ll be able to attach report cards, medical forms and
                other files here.
              </p>
            ) : (
              <ul className="max-h-64 space-y-1 overflow-auto text-[11px]">
                {documents.map((doc) => (
                  <li
                    key={doc.id}
                    className="flex items-center justify-between rounded-lg bg-white/5 px-2 py-1.5"
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">{doc.name}</span>
                      <span className="text-[10px] text-muted-foreground/80">
                        {doc.type} • {new Date(doc.uploadedAt).toLocaleString()}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
