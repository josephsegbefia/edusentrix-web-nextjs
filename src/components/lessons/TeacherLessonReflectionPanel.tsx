"use client";

import * as React from "react";
import { ClipboardList, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import { useBusyToast } from "@/hooks/useBusyToast";
import {
  useTeacherLessonReflection,
  useTeacherUpsertLessonReflection,
} from "@/hooks/teacher/useTeacherLessonReflection";
import type { LessonObjectivesMet } from "@/models/LessonReflection";

const OBJECTIVES_LABEL: Record<LessonObjectivesMet, string> = {
  yes: "Objectives met",
  partially: "Partially met",
  no: "Not met",
};

type Props = {
  lessonId: string;
  canWrite: boolean;
};

export function TeacherLessonReflectionPanel({ lessonId, canWrite }: Props) {
  const busyToast = useBusyToast();
  const { data, isLoading, error } = useTeacherLessonReflection(lessonId, true);
  const saveMut = useTeacherUpsertLessonReflection(lessonId);

  const ref = data?.data.reflection;

  const [completed, setCompleted] = React.useState(false);
  const [objectivesMet, setObjectivesMet] = React.useState<LessonObjectivesMet>("partially");
  const [notes, setNotes] = React.useState("");
  const [struggledRaw, setStruggledRaw] = React.useState("");
  const [followUpRequired, setFollowUpRequired] = React.useState(false);
  const [followUpNotes, setFollowUpNotes] = React.useState("");
  const [nextStep, setNextStep] = React.useState("");

  React.useEffect(() => {
    if (!ref) {
      setCompleted(false);
      setObjectivesMet("partially");
      setNotes("");
      setStruggledRaw("");
      setFollowUpRequired(false);
      setFollowUpNotes("");
      setNextStep("");
      return;
    }
    setCompleted(ref.completed);
    setObjectivesMet(ref.objectivesMet);
    setNotes(ref.notes ?? "");
    setStruggledRaw(ref.studentsWhoStruggled.join("\n"));
    setFollowUpRequired(ref.followUpRequired);
    setFollowUpNotes(ref.followUpNotes ?? "");
    setNextStep(ref.nextStep ?? "");
  }, [ref]);

  const save = async () => {
    const studentsWhoStruggled = struggledRaw
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 60);
    await busyToast.promise(
      saveMut.mutateAsync({
        completed,
        objectivesMet,
        notes: notes.trim() || null,
        studentsWhoStruggled,
        followUpRequired,
        followUpNotes: followUpNotes.trim() || null,
        nextStep: nextStep.trim() || null,
      }),
      {
        loading: "Saving reflection…",
        success: "Reflection saved",
        error: (e) => (e instanceof Error ? e.message : "Failed"),
      }
    );
  };

  return (
    <Card
      id="lesson-reflection"
      className="scroll-mt-24 border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur"
    >
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-500/15 text-teal-200">
            <ClipboardList className="h-4 w-4" />
          </div>
          <div>
            <CardTitle className="text-lg text-white">Reflection</CardTitle>
            <p className="text-xs text-white/50">After teaching — outcomes and follow-up</p>
          </div>
        </div>
        {canWrite && (
          <Button
            type="button"
            size="sm"
            onClick={() => void save()}
            disabled={saveMut.isPending}
            className="bg-teal-500/20 text-teal-100 hover:bg-teal-500/30"
          >
            <Save className="mr-1 h-4 w-4" />
            Save reflection
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-5">
        {error && <p className="text-sm text-rose-300">{error.message}</p>}
        {isLoading ? (
          <div className="h-40 animate-pulse rounded-xl bg-white/5" />
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="space-y-1">
                <Label className="text-white/80">Mark as taught</Label>
                <p className="text-xs text-white/45">Use when you’ve delivered this lesson.</p>
              </div>
              <Switch
                checked={completed}
                onCheckedChange={setCompleted}
                disabled={!canWrite}
                className="data-[state=checked]:bg-teal-500/50"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-white/80">Learning objectives</Label>
              <PremiumSelect
                value={objectivesMet}
                onValueChange={(v) => setObjectivesMet(v as LessonObjectivesMet)}
                disabled={!canWrite}
              >
                <PremiumSelectTrigger className="border-white/10 bg-white/5 text-white">
                  <PremiumSelectValue />
                </PremiumSelectTrigger>
                <PremiumSelectContent>
                  {(Object.keys(OBJECTIVES_LABEL) as LessonObjectivesMet[]).map((k) => (
                    <PremiumSelectItem key={k} value={k}>
                      {OBJECTIVES_LABEL[k]}
                    </PremiumSelectItem>
                  ))}
                </PremiumSelectContent>
              </PremiumSelect>
            </div>

            <div className="space-y-2">
              <Label className="text-white/80">Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={!canWrite}
                className="min-h-[100px] border-white/10 bg-white/5 text-white"
                placeholder="What went well, what to adjust…"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-white/80">Learners who need support (one per line)</Label>
              <Textarea
                value={struggledRaw}
                onChange={(e) => setStruggledRaw(e.target.value)}
                disabled={!canWrite}
                className="min-h-[80px] border-white/10 bg-white/5 text-white"
                placeholder="Optional — names or identifiers your school uses"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="space-y-1">
                <Label className="text-white/80">Follow-up required</Label>
                <p className="text-xs text-white/45">Extra help, reteach, or parent contact.</p>
              </div>
              <Switch
                checked={followUpRequired}
                onCheckedChange={setFollowUpRequired}
                disabled={!canWrite}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-white/80">Follow-up details</Label>
              <Textarea
                value={followUpNotes}
                onChange={(e) => setFollowUpNotes(e.target.value)}
                disabled={!canWrite}
                className="min-h-[72px] border-white/10 bg-white/5 text-white"
                placeholder="What you’ll do next…"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-white/80">Next step</Label>
              <Textarea
                value={nextStep}
                onChange={(e) => setNextStep(e.target.value)}
                disabled={!canWrite}
                className="min-h-[64px] border-white/10 bg-white/5 text-white"
                placeholder="Link to next lesson, homework, or assessment"
              />
            </div>

            {!canWrite && (
              <p className="text-sm text-white/50">You have view-only access for this school.</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
