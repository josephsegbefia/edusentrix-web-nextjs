"use client";

import * as React from "react";
import { Loader2, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GlassPanel } from "@/components/ui/glass-panel";
import { MarksScoreCell } from "@/components/teacher/marks/MarksScoreCell";
import {
  markEntryCellKey,
  validateMarkEntryScore,
} from "@/components/teacher/marks/mark-entry-utils";
import { useBulkAssessmentScores } from "@/hooks/teacher/useBulkAssessmentScores";
import { useBusyToast } from "@/hooks/useBusyToast";
import {
  glassInsetClass,
  glassPrimaryButtonClass,
} from "@/lib/ui/glass-surfaces";
import { cn } from "@/lib/utils";
import type {
  AssessmentItemDTO,
  AssessmentScoreStatus,
  TeacherGradebookV2DTO,
} from "@/types/academics/assessment-engine";

type CellState = {
  score: number | null;
  status: AssessmentScoreStatus;
  invalid: string | null;
  dirty: boolean;
  saving: boolean;
};

type MarkEntryTabProps = {
  gradebook: TeacherGradebookV2DTO;
  classGroupId: string;
  subjectId: string;
  canRecord: boolean;
  onSaved?: () => void;
};

function buildInitialCellState(gradebook: TeacherGradebookV2DTO) {
  const next = new Map<string, CellState>();

  for (const student of gradebook.students) {
    for (const score of student.scores) {
      next.set(markEntryCellKey(student._id, score.assessmentItemId), {
        score: score.score,
        status: score.status,
        invalid: null,
        dirty: false,
        saving: false,
      });
    }
  }

  return next;
}

function entryItems(items: AssessmentItemDTO[]) {
  return items.filter((item) => item.status !== "archived" && item.status !== "locked");
}

export function MarkEntryTab({
  gradebook,
  classGroupId,
  subjectId,
  canRecord,
  onSaved,
}: MarkEntryTabProps) {
  const busy = useBusyToast();
  const bulkSave = useBulkAssessmentScores();
  const [cellState, setCellState] = React.useState<Map<string, CellState>>(() =>
    buildInitialCellState(gradebook)
  );
  const [savingAll, setSavingAll] = React.useState(false);

  const items = entryItems(gradebook.assessmentItems);

  React.useEffect(() => {
    setCellState((current) => {
      const next = buildInitialCellState(gradebook);
      for (const [key, state] of current.entries()) {
        if (state.dirty || state.saving) {
          next.set(key, state);
        }
      }
      return next;
    });
  }, [gradebook]);

  const dirtyCount = React.useMemo(
    () =>
      Array.from(cellState.values()).filter(
        (state) => state.dirty && !state.invalid && !state.saving
      ).length,
    [cellState]
  );

  function getCellState(studentId: string, itemId: string, fallbackStatus: AssessmentScoreStatus) {
    const key = markEntryCellKey(studentId, itemId);
    return (
      cellState.get(key) ?? {
        score: null,
        status: fallbackStatus,
        invalid: null,
        dirty: false,
        saving: false,
      }
    );
  }

  function updateCellState(studentId: string, itemId: string, patch: Partial<CellState>) {
    const key = markEntryCellKey(studentId, itemId);
    setCellState((current) => {
      const next = new Map(current);
      const existing =
        next.get(key) ??
        ({
          score: null,
          status: "missing" as AssessmentScoreStatus,
          invalid: null,
          dirty: false,
          saving: false,
        } satisfies CellState);
      next.set(key, { ...existing, ...patch });
      return next;
    });
  }

  async function persistRecords(
    assessmentItemId: string,
    records: Array<{ studentId: string; score: number | null }>
  ) {
    if (records.length === 0) return;

    for (const record of records) {
      updateCellState(record.studentId, assessmentItemId, { saving: true });
    }

    try {
      await bulkSave.mutateAsync({
        body: {
          assessmentItemId,
          records: records.map((record) => ({
            studentId: record.studentId,
            score: record.score,
          })),
        },
        classGroupId,
        subjectId,
      });

      for (const record of records) {
        updateCellState(record.studentId, assessmentItemId, {
          saving: false,
          dirty: false,
          invalid: null,
          score: record.score,
          status: record.score == null ? "missing" : "recorded",
        });
      }

      onSaved?.();
    } catch (error) {
      for (const record of records) {
        updateCellState(record.studentId, assessmentItemId, { saving: false });
      }
      throw error;
    }
  }

  async function handleCommitCell(
    studentId: string,
    item: AssessmentItemDTO,
    score: number | null
  ) {
    if (!canRecord) return;

    const error = validateMarkEntryScore(score, item.maxScore);
    if (error) {
      updateCellState(studentId, item._id, { invalid: error, dirty: true });
      return;
    }

    const current = getCellState(studentId, item._id, "missing");
    if (current.score === score && !current.dirty) return;

    try {
      await busy.promise(
        persistRecords(item._id, [{ studentId, score }]),
        {
          loading: "Saving mark…",
          success: "Mark saved.",
          error: (err) => err.message,
        }
      );
    } catch {
      updateCellState(studentId, item._id, {
        dirty: true,
        score,
        invalid: null,
      });
    }
  }

  async function handleSaveAll() {
    if (!canRecord || dirtyCount === 0) return;

    const grouped = new Map<string, Array<{ studentId: string; score: number | null }>>();

    for (const [key, state] of cellState.entries()) {
      if (!state.dirty || state.invalid || state.saving) continue;
      const separatorIndex = key.indexOf(":");
      if (separatorIndex <= 0) continue;
      const studentId = key.slice(0, separatorIndex);
      const assessmentItemId = key.slice(separatorIndex + 1);
      const list = grouped.get(assessmentItemId) ?? [];
      list.push({ studentId, score: state.score });
      grouped.set(assessmentItemId, list);
    }

    setSavingAll(true);
    try {
      for (const [assessmentItemId, records] of grouped.entries()) {
        await persistRecords(assessmentItemId, records);
      }
      busy.success(`Saved ${dirtyCount} mark${dirtyCount === 1 ? "" : "s"}.`);
    } catch (error) {
      busy.error(error instanceof Error ? error.message : "Failed to save marks.");
    } finally {
      setSavingAll(false);
    }
  }

  if (items.length === 0) {
    return (
      <GlassPanel className="p-8 text-center">
        <p className="text-sm text-white/60">
          Add assessment items first, then return here to record marks for each student.
        </p>
      </GlassPanel>
    );
  }

  if (gradebook.students.length === 0) {
    return (
      <GlassPanel className="p-8 text-center">
        <p className="text-sm text-white/60">No active students found in this class group.</p>
      </GlassPanel>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-white">Mark entry</h3>
          <p className="mt-1 text-sm text-white/55">
            Enter scores inline. Changes save when you leave a cell, or use Save all for pending
            edits.
          </p>
        </div>
        {canRecord ? (
          <Button
            type="button"
            className={glassPrimaryButtonClass}
            disabled={dirtyCount === 0 || savingAll || bulkSave.isPending}
            onClick={() => void handleSaveAll()}
          >
            {savingAll || bulkSave.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save all changes{dirtyCount > 0 ? ` (${dirtyCount})` : ""}
          </Button>
        ) : null}
      </div>

      {!canRecord ? (
        <div className={cn(glassInsetClass, "rounded-2xl p-4 text-sm text-white/60")}>
          You can view marks, but recording requires gradebook recording permission.
        </div>
      ) : null}

      <GlassPanel className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/5 text-left text-xs uppercase tracking-wide text-white/45">
                <th className="sticky left-0 z-10 bg-slate-950/95 px-4 py-3">Student</th>
                {items.map((item) => (
                  <th key={item._id} className="min-w-[96px] px-3 py-3">
                    <div className="max-w-[140px] truncate normal-case text-white/75">
                      {item.title}
                    </div>
                    <div className="mt-1 text-[10px] font-normal normal-case text-white/35">
                      /{item.maxScore}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {gradebook.students.map((student) => (
                <tr key={student._id} className="border-b border-white/5">
                  <td className="sticky left-0 z-10 bg-slate-950/95 px-4 py-3">
                    <div className="font-medium text-white">{student.name}</div>
                    {student.admissionNo ? (
                      <div className="text-xs text-white/45">{student.admissionNo}</div>
                    ) : null}
                  </td>
                  {items.map((item) => {
                    const serverCell = student.scores.find(
                      (score) => score.assessmentItemId === item._id
                    );
                    const state = getCellState(
                      student._id,
                      item._id,
                      serverCell?.status ?? "missing"
                    );
                    const disabled = !canRecord || state.status === "locked";

                    return (
                      <td key={item._id} className="px-3 py-3 align-top">
                        <MarksScoreCell
                          value={state.dirty ? state.score : (serverCell?.score ?? state.score)}
                          maxScore={item.maxScore}
                          status={state.status}
                          disabled={disabled}
                          isSaving={state.saving}
                          invalidMessage={state.invalid}
                          onDraftChange={(score, invalidMessage) => {
                            updateCellState(student._id, item._id, {
                              score,
                              invalid: invalidMessage,
                              dirty:
                                score !== (serverCell?.score ?? null) ||
                                Boolean(invalidMessage),
                            });
                          }}
                          onCommit={(score) => {
                            if (disabled) return;
                            void handleCommitCell(student._id, item, score);
                          }}
                        />
                        {state.dirty && !state.invalid && !state.saving ? (
                          <Badge
                            variant="outline"
                            className="mt-1 border-amber-500/20 text-[10px] text-amber-100"
                          >
                            Unsaved
                          </Badge>
                        ) : null}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassPanel>
    </div>
  );
}
