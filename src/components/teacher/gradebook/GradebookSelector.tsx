"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Layers, Users } from "lucide-react";
import { PremiumSelect, PremiumSelectContent, PremiumSelectItem, PremiumSelectTrigger, PremiumSelectValue } from "@/components/ui/premium-select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type GradebookSubjectOption = {
  id: string;
  name: string;
  studentCount?: number;
};

export type GradebookClassOption = {
  id: string;
  name: string;
  subjects: GradebookSubjectOption[];
};

type GradebookSelectorProps = {
  classes: GradebookClassOption[];
  loading?: boolean;
};

export function GradebookSelector({ classes, loading }: GradebookSelectorProps) {
  const router = useRouter();
  const [selectedClassId, setSelectedClassId] = React.useState<string>(classes[0]?.id ?? "");
  const [selectedSubjectId, setSelectedSubjectId] = React.useState<string>("");

  const selectedClass = React.useMemo(
    () => classes.find((item) => item.id === selectedClassId),
    [classes, selectedClassId]
  );

  const subjectOptions = selectedClass?.subjects ?? [];

  React.useEffect(() => {
    if (!selectedClassId && classes.length > 0) {
      setSelectedClassId(classes[0].id);
    }
  }, [classes, selectedClassId]);

  React.useEffect(() => {
    if (subjectOptions.length === 0) {
      setSelectedSubjectId("");
      return;
    }

    const currentValid = subjectOptions.some((subject) => subject.id === selectedSubjectId);
    if (!currentValid) {
      setSelectedSubjectId(subjectOptions[0].id);
    }
  }, [subjectOptions, selectedSubjectId]);

  const handleOpen = () => {
    if (!selectedClassId || !selectedSubjectId) return;
    router.push(`/teacher/gradebook/${selectedClassId}/${selectedSubjectId}`);
  };

  if (loading) {
    return (
      <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-lg">Gradebook access</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="h-12 animate-pulse rounded-2xl border border-white/10 bg-white/5" />
            <div className="h-12 animate-pulse rounded-2xl border border-white/10 bg-white/5" />
            <div className="h-10 w-40 animate-pulse rounded-full border border-white/10 bg-white/5" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (classes.length === 0) {
    return (
      <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/60">
              <BookOpen className="h-4 w-4" />
            </span>
            Gradebook access
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
            You have no active class assignments yet. Ask an admin to assign you a class and subject to unlock the gradebook.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-indigo-500/20 text-indigo-200">
              <Layers className="h-4 w-4" />
            </span>
            Open a gradebook
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
                Class group
              </label>
              <PremiumSelect value={selectedClassId} onValueChange={setSelectedClassId}>
                <PremiumSelectTrigger>
                  <PremiumSelectValue placeholder="Select class" />
                </PremiumSelectTrigger>
                <PremiumSelectContent>
                  {classes.map((item) => (
                    <PremiumSelectItem key={item.id} value={item.id}>
                      {item.name}
                    </PremiumSelectItem>
                  ))}
                </PremiumSelectContent>
              </PremiumSelect>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
                Subject
              </label>
              <PremiumSelect
                value={selectedSubjectId}
                onValueChange={setSelectedSubjectId}
                disabled={!selectedClass}
              >
                <PremiumSelectTrigger>
                  <PremiumSelectValue placeholder="Select subject" />
                </PremiumSelectTrigger>
                <PremiumSelectContent>
                  {subjectOptions.map((subject) => (
                    <PremiumSelectItem key={subject.id} value={subject.id}>
                      {subject.name}
                    </PremiumSelectItem>
                  ))}
                </PremiumSelectContent>
              </PremiumSelect>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={handleOpen}
              disabled={!selectedClassId || !selectedSubjectId}
              className="bg-indigo-500/20 text-indigo-100 hover:bg-indigo-500/30"
            >
              Open gradebook
            </Button>
            {selectedClass && (
              <span className="text-xs text-white/50">
                {subjectOptions.length} subject{subjectOptions.length !== 1 ? "s" : ""} available
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {classes.map((group) =>
          group.subjects.map((subject) => (
            <button
              key={`${group.id}-${subject.id}`}
              type="button"
              onClick={() => router.push(`/teacher/gradebook/${group.id}/${subject.id}`)}
              className={cn(
                "group text-left rounded-2xl border border-white/10 bg-linear-to-br from-white/5 to-transparent p-4 transition hover:-translate-y-0.5 hover:border-white/20",
                "shadow-lg shadow-black/20"
              )}
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-white">{group.name}</div>
                  <div className="text-xs text-white/50">{subject.name}</div>
                </div>
                <div className="flex items-center gap-2 text-xs text-white/60">
                  <Users className="h-4 w-4" />
                  {subject.studentCount ?? 0}
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
