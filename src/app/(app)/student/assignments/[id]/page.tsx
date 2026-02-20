"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { format } from "date-fns/format";
import {
  ArrowLeft,
  Clock3,
  Eye,
  EyeOff,
  FileText,
  RefreshCw,
  Upload,
  AlertCircle,
  Paperclip,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { DocumentUploader } from "@/components/upload/DocumentUploader";

type LatePolicy = "accept" | "reject" | "penalize";

interface SubmissionAttachment {
  name: string;
  url: string;
  type: string;
  size?: number;
}

interface AssignmentDetail {
  id: string;
  title: string;
  instructions?: string | null;
  type: string;
  dueDate: string | null;
  status: "published" | "closed";
  maxScore: number;
  latePolicy: LatePolicy;
  latePenaltyPercent: number | null;
  quizTimeLimitMinutes: number | null;
  attachments: SubmissionAttachment[];
  questions: Array<{
    id: string;
    prompt: string;
    points: number;
    explanation?: string | null;
    choices: Array<{
      id: string;
      text: string;
    }>;
  }>;
  subject: { id: string; name: string } | null;
  rubric:
    | {
        id: string;
        title: string;
        criteria: Array<{
          name?: string;
          title?: string;
          maxScore?: number;
          description?: string;
        }>;
  }
    | null;
}

interface StudentSubmission {
  id: string;
  content: string;
  attachments: SubmissionAttachment[];
  questionResponses: Array<{
    questionId: string;
    selectedChoiceId: string | null;
  }>;
  status: string;
  submittedAt: string | null;
  isLate: boolean;
  attempts: number;
  score: number | null;
  feedback: string | null;
  gradedAt: string | null;
  returnedAt: string | null;
  returnReason: string | null;
  quizStartedAt: string | null;
  quizExpiresAt: string | null;
  autoSubmittedAt: string | null;
}

interface QuizTimerDetail {
  enabled: boolean;
  durationMinutes: number | null;
  startedAt: string | null;
  expiresAt: string | null;
  serverNow: string;
  expired: boolean;
}

const FINALIZED_SUBMISSION_STATUSES = new Set(["submitted", "late", "graded"]);

function latePolicyLabel(policy: LatePolicy, penaltyPercent: number | null) {
  if (policy === "reject") return "Late submissions are not allowed";
  if (policy === "penalize") {
    return `Late submissions allowed with ${
      penaltyPercent ?? 0
    }% penalty`;
  }
  return "Late submissions are allowed";
}

function buildUploadAttachmentName(publicId: string, format?: string) {
  const baseName = publicId.split("/").pop() || "attachment";
  return format ? `${baseName}.${format}` : baseName;
}

function formatTimerCountdown(totalSeconds: number) {
  const safeSeconds = Math.max(0, totalSeconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  if (hours > 0) {
    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }
  return `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
}

export default function StudentAssignmentDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [isLoading, setIsLoading] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [assignment, setAssignment] = React.useState<AssignmentDetail | null>(
    null
  );
  const [submission, setSubmission] = React.useState<StudentSubmission | null>(
    null
  );
  const [schoolId, setSchoolId] = React.useState<string | null>(null);
  const [submissionAttachments, setSubmissionAttachments] = React.useState<
    SubmissionAttachment[]
  >([]);
  const [content, setContent] = React.useState("");
  const [questionResponses, setQuestionResponses] = React.useState<
    Array<{ questionId: string; selectedChoiceId: string | null }>
  >([]);
  const [quizTimer, setQuizTimer] = React.useState<QuizTimerDetail | null>(
    null
  );
  const [timerHidden, setTimerHidden] = React.useState(false);
  const [serverTimeOffsetMs, setServerTimeOffsetMs] = React.useState(0);
  const [timerTickMs, setTimerTickMs] = React.useState(Date.now());
  const autoSubmitTriggeredRef = React.useRef(false);

  const loadAssignment = React.useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch(`/api/student/assignments/${id}`, {
        cache: "no-store",
      });
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "Failed to load assignment");
      }

      setSchoolId(payload.data?.schoolId || null);
      setAssignment(payload.data?.assignment || null);
      setSubmission(payload.data?.submission || null);
      setContent(payload.data?.submission?.content || "");
      setSubmissionAttachments(payload.data?.submission?.attachments || []);
      setQuestionResponses(payload.data?.submission?.questionResponses || []);
      const nextTimer = payload.data?.quizTimer || null;
      setQuizTimer(nextTimer);
      const serverNowMs = nextTimer?.serverNow
        ? new Date(nextTimer.serverNow).getTime()
        : Date.now();
      setServerTimeOffsetMs(serverNowMs - Date.now());
      setTimerTickMs(Date.now());
      autoSubmitTriggeredRef.current = Boolean(
        payload.data?.submission?.submittedAt &&
          FINALIZED_SUBMISSION_STATUSES.has(payload.data?.submission?.status || "")
      );
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Failed to load assignment"
      );
      setSchoolId(null);
      setAssignment(null);
      setSubmission(null);
      setSubmissionAttachments([]);
      setQuestionResponses([]);
      setQuizTimer(null);
      setServerTimeOffsetMs(0);
      autoSubmitTriggeredRef.current = false;
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  React.useEffect(() => {
    void loadAssignment();
  }, [loadAssignment]);

  React.useEffect(() => {
    autoSubmitTriggeredRef.current = false;
  }, [id]);

  React.useEffect(() => {
    if (!quizTimer?.enabled || !quizTimer.expiresAt) return;
    setTimerTickMs(Date.now());
    const interval = window.setInterval(() => {
      setTimerTickMs(Date.now());
    }, 1_000);
    return () => window.clearInterval(interval);
  }, [quizTimer?.enabled, quizTimer?.expiresAt]);

  const timedQuizEnabled = Boolean(
    assignment?.type === "quiz" && quizTimer?.enabled && quizTimer?.expiresAt
  );
  const remainingSeconds = React.useMemo(() => {
    if (!timedQuizEnabled || !quizTimer?.expiresAt) return null;
    const expiresAtMs = new Date(quizTimer.expiresAt).getTime();
    if (Number.isNaN(expiresAtMs)) return 0;
    const currentServerMs = timerTickMs + serverTimeOffsetMs;
    return Math.max(0, Math.ceil((expiresAtMs - currentServerMs) / 1_000));
  }, [quizTimer?.expiresAt, serverTimeOffsetMs, timedQuizEnabled, timerTickMs]);
  const isTimerExpired = timedQuizEnabled && (remainingSeconds ?? 0) <= 0;
  const hasFinalizedTimedSubmission = Boolean(
    timedQuizEnabled &&
      submission &&
      FINALIZED_SUBMISSION_STATUSES.has(submission.status || "")
  );
  const lockedByTimer = timedQuizEnabled && (isTimerExpired || hasFinalizedTimedSubmission);
  const isInteractionLocked = assignment
    ? assignment.status !== "published" || isSubmitting || lockedByTimer
    : true;

  const handleSubmit = React.useCallback(async (options?: { autoSubmit?: boolean }) => {
    const isAutoSubmit = Boolean(options?.autoSubmit);
    const trimmedContent = content.trim();
    if (!assignment) return;

    if (timedQuizEnabled && isTimerExpired && !isAutoSubmit) {
      toast.error("Quiz time is up. Your answers are locked.");
      return;
    }

    if (assignment.questions.length > 0 && !isAutoSubmit) {
      const unanswered = assignment.questions.filter(
        (question) =>
          !questionResponses.find(
            (response) =>
              response.questionId === question.id && response.selectedChoiceId
          )
      );
      if (unanswered.length > 0) {
        toast.error("Please answer all questions before submitting.");
        return;
      }
    }

    if (
      assignment.questions.length === 0 &&
      !trimmedContent &&
      submissionAttachments.length === 0 &&
      !isAutoSubmit
    ) {
      toast.error(
        "Please enter your response or upload at least one attachment."
      );
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await fetch(`/api/student/assignments/${id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: trimmedContent || undefined,
          attachments: submissionAttachments,
          questionResponses,
          autoSubmit: isAutoSubmit || undefined,
        }),
      });
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "Failed to submit assignment");
      }

      if (isAutoSubmit) {
        toast.success("Time is up. Quiz auto-submitted.");
      } else {
        toast.success("Submission received successfully.");
      }
      await loadAssignment();
    } catch (submitError) {
      toast.error(
        submitError instanceof Error
          ? submitError.message
          : "Failed to submit assignment"
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [
    assignment,
    content,
    id,
    isTimerExpired,
    loadAssignment,
    questionResponses,
    submissionAttachments,
    timedQuizEnabled,
  ]);

  React.useEffect(() => {
    if (!assignment || !timedQuizEnabled || !isTimerExpired) return;
    if (assignment.status !== "published") return;
    if (submission && FINALIZED_SUBMISSION_STATUSES.has(submission.status || "")) {
      return;
    }
    if (autoSubmitTriggeredRef.current) return;

    autoSubmitTriggeredRef.current = true;
    void handleSubmit({ autoSubmit: true });
  }, [assignment, handleSubmit, isTimerExpired, submission, timedQuizEnabled]);

  const removeAttachment = (targetUrl: string) => {
    setSubmissionAttachments((prev) =>
      prev.filter((attachment) => attachment.url !== targetUrl)
    );
  };

  const setQuestionChoice = (questionId: string, selectedChoiceId: string) => {
    setQuestionResponses((prev) => {
      const existingIndex = prev.findIndex(
        (response) => response.questionId === questionId
      );
      if (existingIndex === -1) {
        return [...prev, { questionId, selectedChoiceId }];
      }

      const next = [...prev];
      next[existingIndex] = { questionId, selectedChoiceId };
      return next;
    });
  };

  return (
    <div className="min-h-screen p-6 md:p-8">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/student/assignments">
          <Button
            variant="outline"
            className="border-white/10 bg-white/5 hover:bg-white/10"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Assignments
          </Button>
        </Link>
        <Button
          variant="outline"
          size="icon"
          onClick={() => void loadAssignment()}
          disabled={isLoading}
          className="border-white/10 bg-white/5 hover:bg-white/10"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      ) : error ? (
        <Card className="rounded-2xl border border-red-500/20 bg-red-500/10">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-red-200">
              <AlertCircle className="h-5 w-5" />
              <p>{error}</p>
            </div>
          </CardContent>
        </Card>
      ) : !assignment ? (
        <Card className="rounded-2xl border border-white/10 bg-white/5">
          <CardContent className="p-6 text-sm text-white/60">
            Assignment not found.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 xl:grid-cols-3">
          <div className="space-y-6 xl:col-span-2">
            <Card className="rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/60 via-slate-950/60 to-black/60">
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-xl text-white">
                    {assignment.title}
                  </CardTitle>
                  <Badge
                    variant="outline"
                    className={
                      assignment.status === "published"
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                        : "border-slate-500/30 bg-slate-500/10 text-slate-300"
                    }
                  >
                    {assignment.status === "published" ? "Open" : "Closed"}
                  </Badge>
                </div>
                <p className="text-sm text-white/60">
                  {assignment.subject?.name || "General"} •{" "}
                  <span className="capitalize">{assignment.type}</span> • Max score:{" "}
                  {assignment.maxScore}
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-wide text-white/40">
                    Instructions
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-white/80">
                    {assignment.instructions || "No instructions provided."}
                  </p>
                </div>

                {assignment.attachments.length > 0 && (
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-wide text-white/40">
                      Attachment{assignment.attachments.length > 1 ? "s" : ""}
                    </p>
                    <div className="mt-3 space-y-2">
                      {assignment.attachments.map((attachment, index) => (
                        <a
                          key={`${attachment.url}-${index}`}
                          href={attachment.url}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="flex items-center gap-2 text-sm text-brand hover:text-brand/80"
                        >
                          <Paperclip className="h-4 w-4" />
                          {attachment.name || `Attachment ${index + 1}`}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {assignment.rubric && assignment.rubric.criteria.length > 0 && (
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-wide text-white/40">
                      Grading Rubric
                    </p>
                    <p className="mt-1 text-sm text-white/70">
                      {assignment.rubric.title}
                    </p>
                    <div className="mt-3 space-y-2">
                      {assignment.rubric.criteria.map((criterion, index) => (
                        <div
                          key={`${criterion.title || criterion.name || "criterion"}-${index}`}
                          className="rounded-lg border border-white/10 bg-black/20 p-3"
                        >
                          <p className="text-sm font-medium text-white">
                            {criterion.title || criterion.name || `Criterion ${index + 1}`}
                          </p>
                          {criterion.maxScore !== undefined && (
                            <p className="text-xs text-white/50">
                              Max Score: {criterion.maxScore}
                            </p>
                          )}
                          {criterion.description && (
                            <p className="mt-1 text-xs text-white/60">
                              {criterion.description}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {timedQuizEnabled && quizTimer && (
              <Card className="rounded-2xl border border-cyan-400/30 bg-cyan-500/10">
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-[0.2em] text-cyan-100/70">
                      Quiz Timer
                    </p>
                    {!timerHidden ? (
                      <p className="text-2xl font-semibold text-cyan-50">
                        {formatTimerCountdown(remainingSeconds ?? 0)}
                      </p>
                    ) : (
                      <p className="text-sm text-cyan-100/75">Timer hidden</p>
                    )}
                    {isTimerExpired && (
                      <p className="text-xs text-rose-200">
                        Time is up. This quiz is locked and auto-submitted.
                      </p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setTimerHidden((prev) => !prev)}
                    className="border-cyan-200/30 bg-cyan-950/40 text-cyan-100 hover:bg-cyan-900/50"
                  >
                    {timerHidden ? (
                      <>
                        <Eye className="h-4 w-4" />
                        Show timer
                      </>
                    ) : (
                      <>
                        <EyeOff className="h-4 w-4" />
                        Hide timer
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            )}

            {assignment.questions.length > 0 && (
              <Card className="rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/60 via-slate-950/60 to-black/60">
                <CardHeader>
                  <CardTitle className="text-lg text-white">Questions</CardTitle>
                  <p className="text-sm text-white/60">
                    {lockedByTimer
                      ? "Time is up. Responses are locked."
                      : "Choose the best answer for each question."}
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  {assignment.questions.map((question, index) => {
                    const selectedChoiceId =
                      questionResponses.find(
                        (response) => response.questionId === question.id
                      )?.selectedChoiceId || null;

                    return (
                      <div
                        key={question.id || index}
                        className="rounded-xl border border-white/10 bg-white/5 p-4"
                      >
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <p className="text-sm font-medium text-white">
                            {index + 1}. {question.prompt}
                          </p>
                          <Badge className="border-white/10 bg-white/10 text-xs text-white/70">
                            {question.points} pt
                            {question.points === 1 ? "" : "s"}
                          </Badge>
                        </div>
                        <div className="space-y-2">
                          {question.choices.map((choice) => (
                            <button
                              key={choice.id}
                              type="button"
                              onClick={() =>
                                !isInteractionLocked
                                  ? setQuestionChoice(question.id, choice.id)
                                  : undefined
                              }
                              className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                                selectedChoiceId === choice.id
                                  ? "border-brand/50 bg-brand/15 text-white"
                                  : "border-white/10 bg-black/20 text-white/75 hover:bg-white/10"
                              }`}
                              disabled={isInteractionLocked}
                            >
                              {choice.text}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}

            <Card className="rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/60 via-slate-950/60 to-black/60">
              <CardHeader>
                <CardTitle className="text-lg text-white">Your Submission</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  placeholder={
                    assignment.questions.length > 0
                      ? "Optional: add notes for your teacher..."
                      : "Write your answer here..."
                  }
                  className="min-h-[180px] border-white/10 bg-white/5 text-white"
                  disabled={isInteractionLocked}
                />
                <div className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-wide text-white/40">
                    Attachments
                  </p>
                  {assignment.status === "published" && schoolId && !isInteractionLocked ? (
                    <DocumentUploader
                      schoolId={schoolId}
                      category="assignments"
                      maxSizeMB={15}
                      label="Upload assignment file"
                      onUploaded={({ publicId, url, bytes, format }) => {
                        setSubmissionAttachments((prev) => {
                          if (prev.some((attachment) => attachment.url === url)) {
                            return prev;
                          }
                          return [
                            ...prev,
                            {
                              name: buildUploadAttachmentName(publicId, format),
                              url,
                              type: (format || "document").slice(0, 40),
                              size: bytes,
                            },
                          ];
                        });
                        toast.success("Attachment uploaded.");
                      }}
                      onError={(message) => toast.error(message)}
                    />
                  ) : assignment.status === "published" && !schoolId ? (
                    <p className="text-xs text-white/55">
                      Loading upload settings...
                    </p>
                  ) : lockedByTimer ? (
                    <p className="text-xs text-white/55">
                      Attachments are locked because the quiz timer has ended.
                    </p>
                  ) : (
                    <p className="text-xs text-white/55">
                      Attachments are locked because this assignment is closed.
                    </p>
                  )}

                  {submissionAttachments.length > 0 && (
                    <div className="space-y-2">
                      {submissionAttachments.map((attachment, index) => (
                        <div
                          key={`${attachment.url}-${index}`}
                          className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2"
                        >
                          <a
                            href={attachment.url}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="truncate text-sm text-brand hover:text-brand/80"
                          >
                            {attachment.name || `Attachment ${index + 1}`}
                          </a>
                          {assignment.status === "published" && !isInteractionLocked && (
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              onClick={() => removeAttachment(attachment.url)}
                              className="h-7 w-7 text-white/60 hover:bg-white/10 hover:text-white"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <Button
                  onClick={() => void handleSubmit()}
                  disabled={isInteractionLocked}
                  className="bg-brand text-brand-foreground hover:bg-brand/90"
                >
                  {isSubmitting ? (
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="mr-2 h-4 w-4" />
                  )}
                  {assignment.status !== "published"
                    ? "Submission Closed"
                    : lockedByTimer
                      ? "Time Expired"
                      : "Submit Assignment"}
                </Button>
                {submission && (
                  <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-xs text-white/60">
                    Last saved submission:
                    {submission.submittedAt
                      ? ` ${format(
                          new Date(submission.submittedAt),
                          "MMM d, yyyy h:mm a"
                        )}`
                      : " Draft"}
                    {` • Attempts: ${submission.attempts}`}
                    {submission.isLate ? " • Marked late" : ""}
                    {submissionAttachments.length > 0
                      ? ` • Attachments: ${submissionAttachments.length}`
                      : ""}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/60 via-slate-950/60 to-black/60 xl:col-span-1 h-max">
            <CardHeader>
              <CardTitle className="text-lg text-white">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-xs text-white/40">Due Date</p>
                <p className="text-sm text-white">
                  {assignment.dueDate
                    ? format(new Date(assignment.dueDate), "EEEE, MMM d, yyyy h:mm a")
                    : "No due date"}
                </p>
              </div>
              {assignment.type !== "quiz" && (
                <>
                  <Separator className="bg-white/5" />
                  <div>
                    <p className="text-xs text-white/40">Late Policy</p>
                    <p className="text-sm text-white/80">
                      {latePolicyLabel(
                        assignment.latePolicy,
                        assignment.latePenaltyPercent
                      )}
                    </p>
                  </div>
                </>
              )}
              {timedQuizEnabled && (
                <>
                  <Separator className="bg-white/5" />
                  <div>
                    <p className="inline-flex items-center gap-2 text-xs text-white/40">
                      <Clock3 className="h-3.5 w-3.5" />
                      Quiz Timer
                    </p>
                    <p className="text-sm text-white/80">
                      {quizTimer?.durationMinutes || assignment.quizTimeLimitMinutes || 0} minute
                      {(quizTimer?.durationMinutes || assignment.quizTimeLimitMinutes || 0) === 1
                        ? ""
                        : "s"}
                    </p>
                    {quizTimer?.expiresAt && (
                      <p className="mt-1 text-xs text-white/55">
                        Ends at {format(new Date(quizTimer.expiresAt), "MMM d, yyyy h:mm a")}
                      </p>
                    )}
                  </div>
                </>
              )}
              {assignment.questions.length > 0 && (
                <>
                  <Separator className="bg-white/5" />
                  <div>
                    <p className="text-xs text-white/40">Auto-graded Questions</p>
                    <p className="text-sm text-white/80">
                      {assignment.questions.length} question
                      {assignment.questions.length === 1 ? "" : "s"}
                    </p>
                  </div>
                </>
              )}
              <Separator className="bg-white/5" />
              <div>
                <p className="text-xs text-white/40">Assignment ID</p>
                <p className="break-all font-mono text-xs text-white/60">
                  {assignment.id}
                </p>
              </div>
              <Separator className="bg-white/5" />
              {submission && (
                <>
                  <div>
                    <p className="text-xs text-white/40">Submission Status</p>
                    <p className="text-sm text-white capitalize">
                      {submission.status.replace("_", " ")}
                    </p>
                  </div>
                  {submission.score !== null && (
                    <>
                      <Separator className="bg-white/5" />
                      <div>
                        <p className="text-xs text-white/40">Score</p>
                        <p className="text-sm text-white">
                          {submission.score} / {assignment.maxScore}
                        </p>
                      </div>
                    </>
                  )}
                  {submission.feedback && (
                    <>
                      <Separator className="bg-white/5" />
                      <div>
                        <p className="text-xs text-white/40">Teacher Feedback</p>
                        <p className="text-sm text-white/80 whitespace-pre-wrap">
                          {submission.feedback}
                        </p>
                      </div>
                    </>
                  )}
                  <Separator className="bg-white/5" />
                </>
              )}
              <div className="flex items-center gap-2 text-xs text-white/45">
                <FileText className="h-3.5 w-3.5" />
                Keep your response concise and on-topic.
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
