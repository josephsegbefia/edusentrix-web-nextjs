"use client";

import * as React from "react";
import { Compass, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ResponsiveModal } from "@/components/ui/responsive-modal";
import { useBusyToast } from "@/hooks/useBusyToast";
import { glassInsetClass } from "@/lib/ui/glass-surfaces";
import { cn } from "@/lib/utils";

type ExploreContent = {
  title: string;
  intro: string;
  deepDiveExplanation?: {
    title: string;
    conceptBridge: string;
    deeperExplanation: string;
    realWorldConnection: string;
  };
  misconceptions?: Array<{
    id: string;
    misconception: string;
    whyStudentsThinkThis: string;
    leoCorrection: string;
    quickCheckPrompt: string;
  }>;
  tryItActivity?: {
    id: string;
    title: string;
    type: string;
    safetyLevel: string;
    instructions: string[];
    reflectionPrompt: string;
  };
  readingTasks?: Array<{ id: string; title: string; passage: string; readingLevel: string; questions: string[] }>;
  funFacts?: Array<{ id: string; headline: string; fact: string; whyItMatters: string }>;
  endingQuiz: {
    id: string;
    title: string;
    questions: Array<{
      id: string;
      prompt: string;
      options: Array<{ id: string; letter: string; label: string }>;
      correctOptionId: string;
      explanation: string;
    }>;
  };
  [key: string]: unknown;
};

type ExploreDetail = {
  adventureId: string;
  title: string;
  subjectName: string;
  classGroupName: string;
  gradeLevel: string;
  missionType: string;
  estimatedMinutes?: number;
  content: ExploreContent;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  classGroupId?: string | null;
  canWrite: boolean;
  onSaved?: () => void;
};

function exploreContentUrl(sessionId: string, classGroupId?: string | null) {
  const base = `/api/teacher/lesson-sessions/${sessionId}/explore/content`;
  if (!classGroupId) return base;
  return `${base}?classGroupId=${encodeURIComponent(classGroupId)}`;
}

const fieldClass =
  "rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/35";
const textareaClass = cn(fieldClass, "min-h-[88px] resize-y");

async function readJsonResponse(res: Response) {
  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    if (res.status === 401 || res.redirected) {
      throw new Error("Your teacher session has expired. Please sign in again.");
    }
    throw new Error("The server returned an unexpected response. Please refresh and try again.");
  }
  return res.json();
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className={cn(glassInsetClass, "space-y-3 p-4")}>
      <h3 className="text-sm font-semibold text-violet-100">{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-white/55">{label}</Label>
      {children}
    </div>
  );
}

export function TeacherSessionExploreReviewModal({
  open,
  onOpenChange,
  sessionId,
  classGroupId,
  canWrite,
  onSaved,
}: Props) {
  const busyToast = useBusyToast();
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [detail, setDetail] = React.useState<ExploreDetail | null>(null);
  const [content, setContent] = React.useState<ExploreContent | null>(null);

  const loadDetail = React.useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    try {
      const res = await fetch(exploreContentUrl(sessionId, classGroupId), {
        cache: "no-store",
        credentials: "include",
      });
      const json = await readJsonResponse(res);
      if (!res.ok || !json.success) {
        throw new Error(
          res.status === 401
            ? "Your teacher session has expired. Please sign in again."
            : json.error || "Failed to load Explore mission.",
        );
      }
      setDetail(json.data as ExploreDetail);
      setContent(structuredClone(json.data.content) as ExploreContent);
    } catch (error) {
      busyToast.error(error instanceof Error ? error.message : "Failed to load.");
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  }, [sessionId, classGroupId, busyToast, onOpenChange]);

  React.useEffect(() => {
    if (open && sessionId) {
      void loadDetail();
    } else if (!open) {
      setDetail(null);
      setContent(null);
    }
  }, [open, sessionId, loadDetail]);

  async function save() {
    if (!canWrite || !sessionId || !content) return;
    setSaving(true);
    try {
      await busyToast.promise(
        fetch(exploreContentUrl(sessionId, classGroupId), {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        }).then(async (res) => {
          const json = await readJsonResponse(res);
          if (!res.ok || !json.success) {
            throw new Error(
              res.status === 401
                ? "Your teacher session has expired. Please sign in again."
                : json.error || "Save failed",
            );
          }
          return json.data as ExploreDetail;
        }),
        {
          loading: "Saving Explore edits…",
          success: "Explore mission updated.",
          error: (e) => (e instanceof Error ? e.message : "Save failed"),
        },
      );
      onSaved?.();
      await loadDetail();
    } finally {
      setSaving(false);
    }
  }

  function updateTryItInstructions(value: string) {
    if (!content?.tryItActivity) return;
    setContent({
      ...content,
      tryItActivity: {
        ...content.tryItActivity,
        instructions: value
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean),
      },
    });
  }

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title="Review Explore with Leo"
      description="Read and edit the mission students will see before you publish."
      className="sm:max-w-3xl"
      zIndexClass="z-[120]"
      contentZIndexClass="z-[121]"
    >
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-white/55">
          <Loader2 className="h-5 w-5 animate-spin text-violet-200" />
          Loading mission content…
        </div>
      ) : detail && content ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-white/60">
            <p>
              {detail.subjectName} · {detail.classGroupName} · {detail.gradeLevel} ·{" "}
              {detail.missionType.replaceAll("_", " ")}
            </p>
          </div>

          <div className="space-y-4">
            <Section title="Mission overview">
              <Field label="Title">
                <Input
                  value={content.title}
                  disabled={!canWrite}
                  onChange={(e) => setContent({ ...content, title: e.target.value })}
                  className={fieldClass}
                />
              </Field>
              <Field label="Intro">
                <Textarea
                  value={content.intro}
                  disabled={!canWrite}
                  onChange={(e) => setContent({ ...content, intro: e.target.value })}
                  className={textareaClass}
                />
              </Field>
            </Section>

            {content.deepDiveExplanation ? (
              <Section title="Leo goes deeper">
                <Field label="Section title">
                  <Input
                    value={content.deepDiveExplanation.title}
                    disabled={!canWrite}
                    onChange={(e) =>
                      setContent({
                        ...content,
                        deepDiveExplanation: {
                          ...content.deepDiveExplanation!,
                          title: e.target.value,
                        },
                      })
                    }
                    className={fieldClass}
                  />
                </Field>
                <Field label="Deeper explanation">
                  <Textarea
                    value={content.deepDiveExplanation.deeperExplanation}
                    disabled={!canWrite}
                    onChange={(e) =>
                      setContent({
                        ...content,
                        deepDiveExplanation: {
                          ...content.deepDiveExplanation!,
                          deeperExplanation: e.target.value,
                        },
                      })
                    }
                    className={textareaClass}
                  />
                </Field>
                <Field label="Real-world connection">
                  <Textarea
                    value={content.deepDiveExplanation.realWorldConnection}
                    disabled={!canWrite}
                    onChange={(e) =>
                      setContent({
                        ...content,
                        deepDiveExplanation: {
                          ...content.deepDiveExplanation!,
                          realWorldConnection: e.target.value,
                        },
                      })
                    }
                    className={textareaClass}
                  />
                </Field>
              </Section>
            ) : null}

            {content.misconceptions?.length ? (
              <Section title="Misconceptions addressed">
                {content.misconceptions.map((row, index) => (
                  <div key={row.id} className="space-y-2 border-t border-white/10 pt-3 first:border-0 first:pt-0">
                    <p className="text-xs text-white/40">Misconception {index + 1}</p>
                    <Field label="What students might think">
                      <Textarea
                        value={row.misconception}
                        disabled={!canWrite}
                        onChange={(e) => {
                          const misconceptions = [...(content.misconceptions ?? [])];
                          misconceptions[index] = { ...row, misconception: e.target.value };
                          setContent({ ...content, misconceptions });
                        }}
                        className={textareaClass}
                      />
                    </Field>
                    <Field label="Leo correction">
                      <Textarea
                        value={row.leoCorrection}
                        disabled={!canWrite}
                        onChange={(e) => {
                          const misconceptions = [...(content.misconceptions ?? [])];
                          misconceptions[index] = { ...row, leoCorrection: e.target.value };
                          setContent({ ...content, misconceptions });
                        }}
                        className={textareaClass}
                      />
                    </Field>
                  </div>
                ))}
              </Section>
            ) : null}

            {content.tryItActivity ? (
              <Section title="Try it activity">
                <Field label="Activity title">
                  <Input
                    value={content.tryItActivity.title}
                    disabled={!canWrite}
                    onChange={(e) =>
                      setContent({
                        ...content,
                        tryItActivity: { ...content.tryItActivity!, title: e.target.value },
                      })
                    }
                    className={fieldClass}
                  />
                </Field>
                <Field label="Instructions (one step per line)">
                  <Textarea
                    value={content.tryItActivity.instructions.join("\n")}
                    disabled={!canWrite}
                    onChange={(e) => updateTryItInstructions(e.target.value)}
                    className={cn(textareaClass, "min-h-[120px]")}
                  />
                </Field>
              </Section>
            ) : null}

            {content.funFacts?.length ? (
              <Section title="Fun facts">
                {content.funFacts.map((fact, index) => (
                  <div key={fact.id} className="space-y-2 border-t border-white/10 pt-3 first:border-0 first:pt-0">
                    <Field label={`Headline ${index + 1}`}>
                      <Input
                        value={fact.headline}
                        disabled={!canWrite}
                        onChange={(e) => {
                          const funFacts = [...(content.funFacts ?? [])];
                          funFacts[index] = { ...fact, headline: e.target.value };
                          setContent({ ...content, funFacts });
                        }}
                        className={fieldClass}
                      />
                    </Field>
                    <Field label="Fact">
                      <Textarea
                        value={fact.fact}
                        disabled={!canWrite}
                        onChange={(e) => {
                          const funFacts = [...(content.funFacts ?? [])];
                          funFacts[index] = { ...fact, fact: e.target.value };
                          setContent({ ...content, funFacts });
                        }}
                        className={textareaClass}
                      />
                    </Field>
                  </div>
                ))}
              </Section>
            ) : null}

            {content.readingTasks?.length ? (
              <Section title="Reading tasks">
                {content.readingTasks.map((task, index) => (
                  <div key={task.id} className="space-y-2 border-t border-white/10 pt-3 first:border-0 first:pt-0">
                    <Field label={`Task title ${index + 1}`}>
                      <Input
                        value={task.title}
                        disabled={!canWrite}
                        onChange={(e) => {
                          const readingTasks = [...(content.readingTasks ?? [])];
                          readingTasks[index] = { ...task, title: e.target.value };
                          setContent({ ...content, readingTasks });
                        }}
                        className={fieldClass}
                      />
                    </Field>
                    <Field label="Passage">
                      <Textarea
                        value={task.passage}
                        disabled={!canWrite}
                        onChange={(e) => {
                          const readingTasks = [...(content.readingTasks ?? [])];
                          readingTasks[index] = { ...task, passage: e.target.value };
                          setContent({ ...content, readingTasks });
                        }}
                        className={cn(textareaClass, "min-h-[140px]")}
                      />
                    </Field>
                  </div>
                ))}
              </Section>
            ) : null}

            <Section title="Ending quiz">
              {content.endingQuiz.questions.map((question, qIndex) => (
                <div
                  key={question.id}
                  className="space-y-2 border-t border-white/10 pt-3 first:border-0 first:pt-0"
                >
                  <p className="text-xs text-white/40">Question {qIndex + 1}</p>
                  <Field label="Prompt">
                    <Textarea
                      value={question.prompt}
                      disabled={!canWrite}
                      onChange={(e) => {
                        const questions = [...content.endingQuiz.questions];
                        questions[qIndex] = { ...question, prompt: e.target.value };
                        setContent({
                          ...content,
                          endingQuiz: { ...content.endingQuiz, questions },
                        });
                      }}
                      className={textareaClass}
                    />
                  </Field>
                  {question.options.map((option, oIndex) => (
                    <Field key={option.id} label={`Option ${option.letter}`}>
                      <Input
                        value={option.label}
                        disabled={!canWrite}
                        onChange={(e) => {
                          const questions = [...content.endingQuiz.questions];
                          const options = [...question.options];
                          options[oIndex] = { ...option, label: e.target.value };
                          questions[qIndex] = { ...question, options };
                          setContent({
                            ...content,
                            endingQuiz: { ...content.endingQuiz, questions },
                          });
                        }}
                        className={fieldClass}
                      />
                    </Field>
                  ))}
                  <Field label="Explanation (shown after quiz)">
                    <Textarea
                      value={question.explanation}
                      disabled={!canWrite}
                      onChange={(e) => {
                        const questions = [...content.endingQuiz.questions];
                        questions[qIndex] = { ...question, explanation: e.target.value };
                        setContent({
                          ...content,
                          endingQuiz: { ...content.endingQuiz, questions },
                        });
                      }}
                      className={textareaClass}
                    />
                  </Field>
                </div>
              ))}
            </Section>
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-white/10 pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="rounded-xl text-white/70 hover:bg-white/10 hover:text-white"
            >
              Close
            </Button>
            {canWrite ? (
              <Button
                type="button"
                disabled={saving}
                onClick={() => void save()}
                className="rounded-xl bg-violet-500/25 text-violet-100 hover:bg-violet-500/35"
              >
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save changes
              </Button>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 py-10 text-sm text-white/55">
          <Compass className="h-4 w-4" />
          No Explore mission to review yet.
        </div>
      )}
    </ResponsiveModal>
  );
}
