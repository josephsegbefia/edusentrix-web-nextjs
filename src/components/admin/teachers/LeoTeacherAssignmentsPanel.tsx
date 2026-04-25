"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Info, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { LeoIcon } from "@/components/icons/LeoIcon";
import { useToast } from "@/hooks/useToast";
import { useBusyToast } from "@/hooks/useBusyToast";
import { useAcademicPeriods } from "@/hooks/admin/useAcademicPeriods";

type LeoSuggestionRow = {
  subjectId: string;
  classGroupId: string;
  gradeId: string;
  label?: string;
};

type LeoPreviewState = {
  confirmationText: string;
  leoSummary: string | null;
  suggestions: LeoSuggestionRow[];
  unmatched: string[];
};

function LeoCallout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 rounded-xl border border-violet-500/20 bg-violet-500/[0.07] p-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-violet-400/25 bg-violet-500/15">
        <LeoIcon className="h-5 w-5 text-violet-200" />
      </div>
      <div className="min-w-0 flex-1 text-sm text-white/85">{children}</div>
    </div>
  );
}

type Props = {
  teacherId: string;
  teacherName: string;
};

export function LeoTeacherAssignmentsPanel({ teacherId, teacherName }: Props) {
  const { success, error: showError, info, warning } = useToast();
  const busy = useBusyToast();
  const queryClient = useQueryClient();
  const { data: periodsData } = useAcademicPeriods();

  const currentPeriodId = React.useMemo(() => {
    const periods = periodsData?.periods ?? [];
    const cur = periods.find((p) => p.isCurrent);
    return cur?._id ?? null;
  }, [periodsData?.periods]);

  const [leoHint, setLeoHint] = React.useState("");
  const [leoLoading, setLeoLoading] = React.useState(false);
  const [applyLoading, setApplyLoading] = React.useState(false);
  const [leoPreview, setLeoPreview] = React.useState<LeoPreviewState | null>(null);
  const [leoClash, setLeoClash] = React.useState<{
    rows: LeoSuggestionRow[];
    summary: string;
  } | null>(null);

  async function runLeoSuggest() {
    const hint = leoHint.trim();
    if (hint.length < 3) {
      showError("Add a few words for Leo", {
        description: "e.g. “Teaches Math in P4 A and P4 B, Science in JHS1 A”.",
      });
      return;
    }
    setLeoLoading(true);
    setLeoPreview(null);
    try {
      const res = await fetch("/api/admin/teachers/leo-suggest-assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hint }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Could not get suggestions");
      }
      if (json.fallback && !(json.suggestions || []).length) {
        showError("Leo can’t suggest rows yet", {
          description:
            json.leoSummary ||
            "Configure OpenAI, or add grades, classes, and subjects first.",
        });
        return;
      }

      const suggestions: LeoSuggestionRow[] = Array.isArray(json.suggestions)
        ? json.suggestions
        : [];
      const unmatched: string[] = Array.isArray(json.unmatched)
        ? json.unmatched
        : [];
      const confirmationText = String(
        json.confirmationText ||
          json.leoSummary ||
          "Review the assignments below, then accept or dismiss."
      );

      setLeoPreview({
        confirmationText,
        leoSummary: json.leoSummary ? String(json.leoSummary) : null,
        suggestions,
        unmatched,
      });

      if (suggestions.length === 0) {
        showError("No classes matched", {
          description:
            unmatched.length > 0
              ? "Check the note below or spell grade/stream names like in your directory."
              : "Try naming subjects and grades the same way they appear under Admin.",
        });
      }
    } catch (e: unknown) {
      showError("Leo could not help right now", {
        description: e instanceof Error ? e.message : "Try again later.",
      });
    } finally {
      setLeoLoading(false);
    }
  }

  function invalidateAfterSave() {
    queryClient.invalidateQueries({ queryKey: ["teachers", "detail", teacherId] });
    queryClient.invalidateQueries({ queryKey: ["teachers", "subjects", teacherId] });
    queryClient.invalidateQueries({ queryKey: ["teachers", "homeroom", teacherId] });
    queryClient.invalidateQueries({ queryKey: ["teacher-workload", teacherId] });
    queryClient.invalidateQueries({ queryKey: ["teachers", "assignments", teacherId] });
    queryClient.invalidateQueries({ queryKey: ["teachers", "assignments"] });
    queryClient.invalidateQueries({ queryKey: ["teachers"] });
    queryClient.invalidateQueries({ queryKey: ["subjects"] });
  }

  async function applyLeoRows(
    rows: LeoSuggestionRow[],
    resolution?: "add_alongside" | "replace"
  ) {
    if (!rows.length || !currentPeriodId) return { added: 0, skippedDuplicate: 0, clashRows: [] as LeoSuggestionRow[], failures: [] as string[], clashSummary: "" };

    let added = 0;
    let skippedDuplicate = 0;
    const clashRows: LeoSuggestionRow[] = [];
    const failures: string[] = [];
    let clashSummary = "";

    for (const s of rows) {
      const body: Record<string, unknown> = {
        academicPeriodId: currentPeriodId,
        subjectId: s.subjectId,
        classGroupId: s.classGroupId,
      };
      if (resolution) body.resolution = resolution;

      const res = await fetch(
        `/api/admin/teachers/${encodeURIComponent(teacherId)}/assignments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      const json = await res.json().catch(() => ({}));

      if (res.status === 409) {
        const ct = (json as { conflict?: { type?: string; message?: string } })?.conflict?.type;
        if (ct === "other_teachers_on_slot") {
          clashRows.push(s);
          if (!clashSummary && typeof (json as { conflict?: { message?: string } }).conflict?.message === "string") {
            clashSummary = String((json as { conflict: { message: string } }).conflict.message);
          }
          continue;
        }
        if (ct === "duplicate_self") {
          skippedDuplicate++;
          continue;
        }
        failures.push(
          typeof (json as { error?: string }).error === "string"
            ? (json as { error: string }).error
            : `${s.label || "Row"} could not be saved`
        );
        continue;
      }

      if (!res.ok) {
        failures.push(
          typeof (json as { error?: string }).error === "string"
            ? (json as { error: string }).error
            : `${s.label || "Row"} failed`
        );
        continue;
      }
      added++;
    }

    return { added, skippedDuplicate, clashRows, failures, clashSummary };
  }

  async function applyLeoPreview() {
    if (!leoPreview?.suggestions.length) return;
    if (!currentPeriodId) {
      showError("No current academic period", {
        description: "Set a current term under Academic Calendar / Periods, then try again.",
      });
      return;
    }

    setApplyLoading(true);
    setLeoClash(null);
    busy.show("Saving assignments…");

    try {
      const { added, skippedDuplicate, clashRows, failures, clashSummary } = await applyLeoRows(
        leoPreview.suggestions
      );

      invalidateAfterSave();

      if (clashRows.length > 0) {
        setLeoClash({
          rows: clashRows,
          summary:
            clashSummary ||
            (clashRows.length === 1
              ? "This slot already has another teacher for this subject and class."
              : `${clashRows.length} slots already have another teacher for those subjects and classes.`),
        });
        if (added > 0) {
          info("Partly saved", {
            description: `${added} assignment(s) added. Choose how to handle the remaining ${clashRows.length}.`,
          });
        }
        if (failures.length > 0) {
          showError("Some rows could not be saved", {
            description: failures.slice(0, 2).join(" · "),
          });
        }
        return;
      }

      if (added > 0) {
        success("Teaching assignments added", {
          description: `${added} row(s) for ${teacherName}.${skippedDuplicate ? ` ${skippedDuplicate} already existed for this teacher.` : ""}`,
        });
        setLeoPreview(null);
        setLeoHint("");
      } else if (skippedDuplicate > 0 && failures.length === 0) {
        info("No new assignments", {
          description: "These subject/class pairs were already assigned to this teacher for this term.",
        });
      }
      if (failures.length > 0) {
        showError("Some rows could not be saved", {
          description: failures.slice(0, 2).join(" · "),
        });
      }
    } catch (e: unknown) {
      showError("Could not save assignments", {
        description: e instanceof Error ? e.message : "Try again.",
      });
    } finally {
      busy.hide();
      setApplyLoading(false);
    }
  }

  async function resolveLeoClash(mode: "add_alongside" | "replace") {
    if (!leoClash?.rows.length) return;
    setApplyLoading(true);
    busy.show(mode === "replace" ? "Replacing assignments…" : "Adding co-teacher assignments…");
    try {
      const { added, skippedDuplicate, clashRows, failures } = await applyLeoRows(
        leoClash.rows,
        mode
      );

      invalidateAfterSave();
      setLeoClash(null);

      if (clashRows.length > 0) {
        setLeoClash({
          rows: clashRows,
          summary: "Some slots still conflict. Try again or adjust in the directory.",
        });
        warning("Could not resolve every row", {
          description: "You may need to fix these manually.",
        });
      } else if (added > 0) {
        success(
          mode === "replace" ? "Assignments updated" : "Co-teaching assignments added",
          {
            description: `${added} row(s) for ${teacherName}.${skippedDuplicate ? ` ${skippedDuplicate} skipped (already assigned to this teacher).` : ""}`,
          }
        );
        setLeoPreview(null);
        setLeoHint("");
      } else if (skippedDuplicate > 0 && failures.length === 0) {
        info("Already set", {
          description: "These were already assigned to this teacher.",
        });
      }
      if (failures.length > 0) {
        showError("Some rows could not be saved", {
          description: failures.slice(0, 2).join(" · "),
        });
      }
    } catch (e: unknown) {
      showError("Could not save assignments", {
        description: e instanceof Error ? e.message : "Try again.",
      });
    } finally {
      busy.hide();
      setApplyLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <LeoCallout>
        <p className="mb-2 font-medium text-violet-100">
          Hi, I&apos;m <span className="font-semibold text-violet-200">Leo</span>.
        </p>
        <p className="mb-3 text-sm text-white/80">
          Describe what {teacherName} teaches in plain language (e.g. &quot;Math in JHS 2A and B,
          Science in JHS 1&quot;). I&apos;ll match it to your subjects and class groups for the{" "}
          <span className="font-medium text-white/90">current term</span>—confirm before anything is
          saved.
        </p>
        {!currentPeriodId && (
          <p className="mb-3 text-xs text-amber-200/90">
            Set a <strong className="font-semibold">current academic period</strong> first so
            assignments attach to the right term.
          </p>
        )}
        <Textarea
          value={leoHint}
          onChange={(e) => setLeoHint(e.target.value)}
          placeholder='Example: "Mathematics in JHS 2A and B; Science in JHS 1"'
          className="mb-3 min-h-[88px] border-white/10 bg-white/5 text-white placeholder:text-white/35"
        />
        <Button
          type="button"
          variant="outline"
          disabled={leoLoading}
          onClick={() => void runLeoSuggest()}
          className="gap-2 border-violet-400/30 bg-violet-500/10 text-violet-100 hover:bg-violet-500/20"
        >
          <LeoIcon className="h-4 w-4" />
          {leoLoading ? "Leo is thinking…" : "Ask Leo"}
        </Button>
      </LeoCallout>

      {leoPreview && (
        <div className="space-y-3 rounded-xl border border-violet-400/30 bg-violet-500/12 p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-violet-200/90">
            Confirm with Leo
          </div>
          <p className="text-sm leading-relaxed text-white/90">{leoPreview.confirmationText}</p>
          {leoPreview.leoSummary &&
            leoPreview.leoSummary !== leoPreview.confirmationText && (
              <p className="text-xs text-white/55">{leoPreview.leoSummary}</p>
            )}
          {leoPreview.suggestions.length > 0 && (
            <ul className="space-y-1 border-t border-white/10 pt-3 text-xs text-white/75">
              {leoPreview.suggestions.map((s, i) => (
                <li key={`${s.subjectId}-${s.classGroupId}-${i}`}>
                  {s.label || `${s.subjectId} · ${s.classGroupId}`}
                </li>
              ))}
            </ul>
          )}
          {leoPreview.unmatched.length > 0 && (
            <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-100/95">
              Couldn&apos;t match: {leoPreview.unmatched.join("; ")}. Add those manually or adjust
              your note and try again.
            </div>
          )}

          {leoClash && leoClash.rows.length > 0 && (
            <div className="rounded-lg border border-violet-400/30 bg-violet-500/15 px-3 py-3 text-sm">
              <div className="flex gap-2">
                <Info className="h-4 w-4 shrink-0 text-violet-200 mt-0.5" />
                <div className="min-w-0 space-y-2">
                  <p className="font-medium text-white">Another teacher is already on these slots</p>
                  <p className="text-xs text-white/70 leading-relaxed">{leoClash.summary}</p>
                  <ul className="text-xs text-white/60 list-disc pl-4 space-y-0.5 border-t border-white/10 pt-2">
                    {leoClash.rows.map((r, i) => (
                      <li key={`${r.subjectId}-${r.classGroupId}-${i}`}>
                        {r.label || "Subject · class"}
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-white/55 pt-1">
                    Add {teacherName} as a co-teacher, or replace the current teacher on these slots for this term.
                  </p>
                  <div className="flex w-full min-w-0 flex-col gap-2 pt-1">
                    <Button
                      type="button"
                      size="sm"
                      className="h-auto min-h-8 w-full max-w-full shrink gap-2 whitespace-normal bg-violet-500 px-3 py-2.5 text-center leading-snug text-white hover:bg-violet-600"
                      disabled={applyLoading}
                      onClick={() => void resolveLeoClash("add_alongside")}
                    >
                      <UserPlus className="h-3.5 w-3.5 shrink-0" />
                      Add as co-teacher
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-auto min-h-8 w-full max-w-full shrink whitespace-normal border-white/15 bg-white/5 px-3 py-2.5 text-center leading-snug text-white hover:bg-white/10"
                      disabled={applyLoading}
                      onClick={() => void resolveLeoClash("replace")}
                    >
                      Replace previous teacher(s)
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              type="button"
              disabled={
                leoPreview.suggestions.length < 1 || !currentPeriodId || applyLoading
              }
              onClick={() => void applyLeoPreview()}
              className="gap-2 bg-brand text-black hover:opacity-90"
            >
              {applyLoading ? "Saving…" : `Add to ${teacherName}`}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setLeoPreview(null);
                setLeoClash(null);
              }}
              className="text-white/70 hover:bg-white/10 hover:text-white"
            >
              Dismiss
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
