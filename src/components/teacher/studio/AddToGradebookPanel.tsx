"use client";

import * as React from "react";
import Link from "next/link";
import { BookOpenCheck, ClipboardList, Info, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import { cn } from "@/lib/utils";
import { glassInsetClass, glassPrimaryButtonClass } from "@/lib/ui/glass-surfaces";
import {
  useAddStudioToGradebook,
  useStudioGradebookLink,
} from "@/hooks/teacher/useStudioGradebookLink";
import { useBusyToast } from "@/hooks/useBusyToast";

type Props = {
  homeworkId: string;
  compact?: boolean;
};

export function AddToGradebookPanel({ homeworkId, compact = false }: Props) {
  const busyToast = useBusyToast();
  const { data, isLoading, refetch, isFetching } = useStudioGradebookLink(homeworkId);
  const addMutation = useAddStudioToGradebook(homeworkId);

  const link = data?.data;
  const classGroups = link?.classGroups ?? [];
  const [classGroupId, setClassGroupId] = React.useState("");
  const [contributionMode, setContributionMode] = React.useState<"non_report" | "report">(
    "non_report"
  );
  const [componentKey, setComponentKey] = React.useState<string>("");

  React.useEffect(() => {
    if (!classGroupId && classGroups[0]?.id) {
      setClassGroupId(classGroups[0].id);
    }
  }, [classGroupId, classGroups]);

  const selectedClassGroup = classGroups.find((group) => group.id === classGroupId);
  const alreadyLinked = Boolean(selectedClassGroup?.linkedAssessmentItemId);
  const canSubmit =
    Boolean(link?.eligible) &&
    Boolean(classGroupId) &&
    (contributionMode === "non_report" || Boolean(componentKey));

  const handleSubmit = async () => {
    if (!classGroupId) return;

    try {
      const result = await busyToast.promise(
        addMutation.mutateAsync({
          classGroupId,
          contributionMode,
          componentKey: contributionMode === "report" ? componentKey : null,
        }),
        {
          loading: alreadyLinked ? "Updating gradebook marks..." : "Adding to gradebook...",
          success: alreadyLinked
            ? "Gradebook marks updated from studio submissions"
            : "Added to gradebook as an assessment item",
          error: (error) =>
            error instanceof Error ? error.message : "Failed to add marks to gradebook",
        }
      );

      await refetch();

      if (result.marksWorkspacePath) {
        busyToast.success("Open Marks & Reports to review imported scores.");
      }
    } catch {
      // toast handled by promise helper
    }
  };

  if (isLoading) {
    return (
      <Card className={cn("border border-white/10 bg-white/5", compact && "shadow-none")}>
        <CardContent className="flex items-center gap-3 p-5 text-sm text-white/60">
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking gradebook link status...
        </CardContent>
      </Card>
    );
  }

  if (!link) {
    return null;
  }

  return (
    <Card className={cn("border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur", compact && "shadow-none")}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <BookOpenCheck className="h-5 w-5 text-teal-300" />
          Add to Gradebook
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-white/65">
          Import graded studio submissions into Marks & Reports as an assessment item. This does not
          submit official subject results — review and submit from the marks workspace when ready.
        </p>

        {!link.eligible && link.eligibilityNotes.length > 0 ? (
          <div className={cn(glassInsetClass, "space-y-2 rounded-xl p-4 text-sm text-amber-100/85")}>
            <div className="flex items-center gap-2 font-medium text-amber-100">
              <Info className="h-4 w-4" />
              Not ready yet
            </div>
            {link.eligibilityNotes.map((note) => (
              <p key={note}>{note}</p>
            ))}
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
              Class group
            </label>
            <PremiumSelect value={classGroupId} onValueChange={setClassGroupId}>
              <PremiumSelectTrigger>
                <PremiumSelectValue placeholder="Select class" />
              </PremiumSelectTrigger>
              <PremiumSelectContent>
                {classGroups.map((group) => (
                  <PremiumSelectItem
                    key={group.id}
                    value={group.id}
                    description={
                      group.linkedAssessmentItemId
                        ? "Already linked"
                        : `${group.gradedSubmissionCount} graded`
                    }
                  >
                    {group.name}
                  </PremiumSelectItem>
                ))}
              </PremiumSelectContent>
            </PremiumSelect>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
              Import mode
            </label>
            <PremiumSelect
              value={contributionMode}
              onValueChange={(value) =>
                setContributionMode(value as "non_report" | "report")
              }
            >
              <PremiumSelectTrigger>
                <PremiumSelectValue placeholder="Choose mode" />
              </PremiumSelectTrigger>
              <PremiumSelectContent>
                <PremiumSelectItem value="non_report">
                  Add as non-report mark
                </PremiumSelectItem>
                <PremiumSelectItem
                  value="report"
                  disabled={!link.canMarkReportContributing}
                  description={
                    link.canMarkReportContributing
                      ? "Counts toward report card component"
                      : "Not allowed by assessment plan"
                  }
                >
                  Add as report-contributing mark
                </PremiumSelectItem>
              </PremiumSelectContent>
            </PremiumSelect>
          </div>
        </div>

        {contributionMode === "report" ? (
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
              Report component
            </label>
            <PremiumSelect value={componentKey} onValueChange={setComponentKey}>
              <PremiumSelectTrigger>
                <PremiumSelectValue placeholder="Select component" />
              </PremiumSelectTrigger>
              <PremiumSelectContent>
                {link.scoreComponents.map((component) => (
                  <PremiumSelectItem key={component.key} value={component.key}>
                    {component.label}
                  </PremiumSelectItem>
                ))}
              </PremiumSelectContent>
            </PremiumSelect>
          </div>
        ) : null}

        {selectedClassGroup?.linkedAssessmentItemId ? (
          <div className="flex flex-wrap items-center gap-2 text-xs text-white/60">
            <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-100">
              Linked
            </Badge>
            <span>
              {selectedClassGroup.contributesToReport
                ? `Report component: ${selectedClassGroup.componentKey ?? "—"}`
                : "Stored as non-report mark"}
            </span>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            disabled={!canSubmit || addMutation.isPending || isFetching}
            onClick={handleSubmit}
            className={glassPrimaryButtonClass}
          >
            {addMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ClipboardList className="h-4 w-4" />
            )}
            {alreadyLinked ? "Update gradebook marks" : "Add to gradebook"}
          </Button>

          {classGroupId && link.subjectId ? (
            <Button asChild variant="outline" className="border-white/10 bg-white/5 text-white/75">
              <Link href={`/teacher/marks/${classGroupId}/${link.subjectId}`}>
                Open marks workspace
              </Link>
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
