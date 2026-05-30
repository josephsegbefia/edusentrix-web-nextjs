"use client";

import * as React from "react";
import { Archive, Pencil, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GlassPanel } from "@/components/ui/glass-panel";
import { AssessmentItemDrawer } from "@/components/teacher/marks/AssessmentItemDrawer";
import {
  canArchiveAssessmentItem,
  canEditAssessmentItem,
} from "@/components/teacher/marks/assessment-item-form";
import { useUpdateAssessmentItem } from "@/hooks/teacher/useTeacherAssessmentItems";
import { useBusyToast } from "@/hooks/useBusyToast";
import { useConfirmationDialog } from "@/hooks/useConfirmationDialog";
import { ASSESSMENT_SOURCE_TYPE_LABELS } from "@/constants/academics/assessment-engine";
import {
  glassInsetClass,
  glassPrimaryButtonClass,
  glassSecondaryButtonClass,
} from "@/lib/ui/glass-surfaces";
import { cn } from "@/lib/utils";
import type { AssessmentItemDTO, TeacherGradebookV2DTO } from "@/types/academics/assessment-engine";

function formatStatus(status: string) {
  return status.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

type AssessmentItemsTabProps = {
  gradebook: TeacherGradebookV2DTO;
  classGroupId: string;
  subjectId: string;
  canRecord: boolean;
  onRefresh?: () => void;
};

export function AssessmentItemsTab({
  gradebook,
  classGroupId,
  subjectId,
  canRecord,
  onRefresh,
}: AssessmentItemsTabProps) {
  const busy = useBusyToast();
  const { confirm, confirmationDialog } = useConfirmationDialog();
  const updateItem = useUpdateAssessmentItem();
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [selectedItem, setSelectedItem] = React.useState<AssessmentItemDTO | null>(null);

  const plan = gradebook.assessmentPlan;
  const canCreateOffline = Boolean(plan?.allowOfflineMarks && canRecord);

  function openCreateDrawer() {
    setSelectedItem(null);
    setDrawerOpen(true);
  }

  function openEditDrawer(item: AssessmentItemDTO) {
    setSelectedItem(item);
    setDrawerOpen(true);
  }

  async function handleArchive(item: AssessmentItemDTO) {
    const result = await confirm({
      title: "Archive assessment item?",
      description: `"${item.title}" will be archived and hidden from active mark entry.`,
      confirmLabel: "Archive",
      intent: "destructive",
    });
    if (result !== "confirm") return;

    try {
      await busy.promise(
        updateItem.mutateAsync({
          id: item._id,
          classGroupId,
          subjectId,
          input: { status: "archived" },
        }),
        {
          loading: "Archiving assessment item…",
          success: "Assessment item archived.",
          error: (err) => err.message,
        }
      );
      onRefresh?.();
    } catch {
      // handled by busy.promise
    }
  }

  return (
    <>
      {confirmationDialog}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-white">Assessment items</h3>
            <p className="mt-1 text-sm text-white/55">
              Create offline columns tied to your active assessment plan components.
            </p>
          </div>
          {canCreateOffline ? (
            <Button type="button" className={glassPrimaryButtonClass} onClick={openCreateDrawer}>
              <Plus className="mr-2 h-4 w-4" />
              New item
            </Button>
          ) : null}
        </div>

        {!canCreateOffline ? (
          <div className={cn(glassInsetClass, "rounded-2xl p-4 text-sm text-white/60")}>
            {canRecord
              ? "This assessment plan does not allow offline/manual items."
              : "You can view items, but creating or editing requires gradebook recording permission."}
          </div>
        ) : null}

        {gradebook.assessmentItems.length === 0 ? (
          <GlassPanel className="p-8 text-center">
            <p className="text-sm text-white/60">
              No assessment items yet. Create a manual item to start recording marks for this
              subject.
            </p>
            {canCreateOffline ? (
              <Button
                type="button"
                className={cn("mt-4", glassPrimaryButtonClass)}
                onClick={openCreateDrawer}
              >
                <Plus className="mr-2 h-4 w-4" />
                Create assessment item
              </Button>
            ) : null}
          </GlassPanel>
        ) : (
          <GlassPanel className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/5 text-left text-xs uppercase tracking-wide text-white/45">
                    <th className="px-4 py-3">Title</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Component</th>
                    <th className="px-4 py-3">Source</th>
                    <th className="px-4 py-3">Max</th>
                    <th className="px-4 py-3">Report</th>
                    <th className="px-4 py-3">Status</th>
                    {canRecord ? <th className="px-4 py-3">Actions</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {gradebook.assessmentItems.map((item) => (
                    <tr key={item._id} className="border-b border-white/5">
                      <td className="px-4 py-3 text-white">{item.title}</td>
                      <td className="px-4 py-3 text-white/65">{item.assessmentType}</td>
                      <td className="px-4 py-3 text-white/65">{item.componentKey ?? "—"}</td>
                      <td className="px-4 py-3 text-white/65">
                        {ASSESSMENT_SOURCE_TYPE_LABELS[item.sourceType] ?? item.sourceType}
                      </td>
                      <td className="px-4 py-3 text-white/65">{item.maxScore}</td>
                      <td className="px-4 py-3">
                        {item.contributesToReport ? (
                          <Badge
                            variant="outline"
                            className="border-emerald-500/30 text-emerald-100"
                          >
                            Yes
                          </Badge>
                        ) : (
                          <span className="text-white/45">No</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-white/65">{formatStatus(item.status)}</td>
                      {canRecord ? (
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            {canEditAssessmentItem(item) ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className={glassSecondaryButtonClass}
                                onClick={() => openEditDrawer(item)}
                              >
                                <Pencil className="mr-1.5 h-3.5 w-3.5" />
                                Edit
                              </Button>
                            ) : null}
                            {canArchiveAssessmentItem(item) ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="border-rose-500/25 bg-rose-500/5 text-rose-100 hover:bg-rose-500/10"
                                onClick={() => void handleArchive(item)}
                              >
                                <Archive className="mr-1.5 h-3.5 w-3.5" />
                                Archive
                              </Button>
                            ) : null}
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </GlassPanel>
        )}
      </div>

      <AssessmentItemDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        gradebook={gradebook}
        classGroupId={classGroupId}
        subjectId={subjectId}
        item={selectedItem}
        onSaved={onRefresh}
      />
    </>
  );
}
