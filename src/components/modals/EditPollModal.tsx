// src/components/modals/EditPollModal.tsx
"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, Trash2, X, GripVertical, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import { Switch } from "@/components/ui/switch";
import {
  useUpdatePoll,
  QuestionType,
  AudienceScope,
  RevealResults,
  PollDetailDTO,
} from "@/hooks/admin/useCommunityPolls";
import { useBusyToast } from "@/hooks/useBusyToast";
import { toast } from "sonner";

// ============================================================================
// Types
// ============================================================================

interface QuestionFormData {
  id: string;
  prompt: string;
  type: QuestionType;
  options: Array<{ id: string; label: string }>;
  required: boolean;
  allowOther: boolean;
}

interface EditPollModalProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly poll: PollDetailDTO;
  readonly onSuccess?: () => void;
}

// ============================================================================
// Question Type Options
// ============================================================================

const QUESTION_TYPES: Array<{ value: QuestionType; label: string; needsOptions: boolean }> = [
  { value: "single_choice", label: "Single Choice", needsOptions: true },
  { value: "multi_choice", label: "Multiple Choice", needsOptions: true },
  { value: "ranked_choice", label: "Ranked Choice", needsOptions: true },
  { value: "likert", label: "Likert Scale (1-5)", needsOptions: false },
  { value: "yes_no", label: "Yes/No", needsOptions: false },
  { value: "comment", label: "Open Text", needsOptions: false },
];

const AUDIENCE_SCOPES: Array<{ value: AudienceScope; label: string }> = [
  { value: "school", label: "Entire School" },
  { value: "parents", label: "Parents Only" },
  { value: "students", label: "Students Only" },
  { value: "staff", label: "Staff Only" },
  { value: "grade", label: "Specific Grades" },
  { value: "class", label: "Specific Classes" },
];

// ============================================================================
// Question Editor Component
// ============================================================================

interface QuestionEditorProps {
  question: QuestionFormData;
  index: number;
  onChange: (question: QuestionFormData) => void;
  onRemove: () => void;
  canRemove: boolean;
  disabled: boolean;
}

function QuestionEditor({ question, index, onChange, onRemove, canRemove, disabled }: QuestionEditorProps) {
  const typeInfo = QUESTION_TYPES.find((t) => t.value === question.type);
  const needsOptions = typeInfo?.needsOptions ?? false;

  const addOption = () => {
    onChange({
      ...question,
      options: [
        ...question.options,
        { id: `opt_${Date.now()}`, label: "" },
      ],
    });
  };

  const updateOption = (optionId: string, label: string) => {
    onChange({
      ...question,
      options: question.options.map((o) =>
        o.id === optionId ? { ...o, label } : o
      ),
    });
  };

  const removeOption = (optionId: string) => {
    onChange({
      ...question,
      options: question.options.filter((o) => o.id !== optionId),
    });
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="mb-4 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <GripVertical className="h-4 w-4 text-white/30" />
          <span className="text-sm font-medium text-white/60">Question {index + 1}</span>
        </div>
        {canRemove && !disabled && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onRemove}
            className="h-7 w-7 text-white/40 hover:text-rose-400"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="space-y-4">
        <div>
          <Label className="text-white/70">Question Text</Label>
          <Input
            value={question.prompt}
            onChange={(e) => onChange({ ...question, prompt: e.target.value })}
            placeholder="Enter your question..."
            className="mt-1 border-white/10 bg-white/5 text-white"
            disabled={disabled}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label className="text-white/70">Question Type</Label>
            <PremiumSelect
              value={question.type}
              onValueChange={(v) => onChange({ ...question, type: v as QuestionType })}
              disabled={disabled}
            >
              <PremiumSelectTrigger className="mt-1">
                <PremiumSelectValue />
              </PremiumSelectTrigger>
              <PremiumSelectContent>
                {QUESTION_TYPES.map((t) => (
                  <PremiumSelectItem key={t.value} value={t.value}>
                    {t.label}
                  </PremiumSelectItem>
                ))}
              </PremiumSelectContent>
            </PremiumSelect>
          </div>

          <div className="flex items-end gap-6">
            <div className="flex items-center gap-2">
              <Switch
                checked={question.required}
                onCheckedChange={(checked) => onChange({ ...question, required: checked })}
                disabled={disabled}
              />
              <Label className="text-sm text-white/60">Required</Label>
            </div>
            {needsOptions && (
              <div className="flex items-center gap-2">
                <Switch
                  checked={question.allowOther}
                  onCheckedChange={(checked) => onChange({ ...question, allowOther: checked })}
                  disabled={disabled}
                />
                <Label className="text-sm text-white/60">Allow &quot;Other&quot;</Label>
              </div>
            )}
          </div>
        </div>

        {needsOptions && (
          <div className="space-y-2">
            <Label className="text-white/70">Options</Label>
            {question.options.map((option, optIndex) => (
              <div key={option.id} className="flex items-center gap-2">
                <span className="w-6 text-center text-sm text-white/40">{optIndex + 1}.</span>
                <Input
                  value={option.label}
                  onChange={(e) => updateOption(option.id, e.target.value)}
                  placeholder={`Option ${optIndex + 1}`}
                  className="flex-1 border-white/10 bg-white/5 text-white"
                  disabled={disabled}
                />
                {question.options.length > 2 && !disabled && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeOption(option.id)}
                    className="h-8 w-8 text-white/40 hover:text-rose-400"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            {!disabled && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addOption}
                className="mt-2 gap-1 border-white/10 text-white/60"
              >
                <Plus className="h-4 w-4" />
                Add Option
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Main Modal Component
// ============================================================================

export default function EditPollModal({ open, onOpenChange, poll, onSuccess }: EditPollModalProps) {
  const updateMutation = useUpdatePoll();
  const busyToast = useBusyToast();

  // Check if poll is editable (only draft or pending_approval can edit questions)
  const canEditQuestions = ["draft", "pending_approval", "approved"].includes(poll.status);
  const isLive = poll.status === "live";

  // Form state
  const [title, setTitle] = React.useState(poll.title);
  const [description, setDescription] = React.useState(poll.description || "");
  const [audienceScope, setAudienceScope] = React.useState<AudienceScope>(poll.audience.scope);
  const [revealResults, setRevealResults] = React.useState<RevealResults>(poll.revealResults);
  const [allowAnonymous, setAllowAnonymous] = React.useState(poll.allowAnonymous);
  const [allowComments, setAllowComments] = React.useState(poll.allowComments);
  const [questions, setQuestions] = React.useState<QuestionFormData[]>(
    poll.questions.map((q) => ({
      id: q.id,
      prompt: q.prompt,
      type: q.type,
      options: q.options.map((o) => ({ id: o.id, label: o.label })),
      required: q.required,
      allowOther: q.allowOther,
    }))
  );

  // Reset form when poll changes
  React.useEffect(() => {
    if (open) {
      setTitle(poll.title);
      setDescription(poll.description || "");
      setAudienceScope(poll.audience.scope);
      setRevealResults(poll.revealResults);
      setAllowAnonymous(poll.allowAnonymous);
      setAllowComments(poll.allowComments);
      setQuestions(
        poll.questions.map((q) => ({
          id: q.id,
          prompt: q.prompt,
          type: q.type,
          options: q.options.map((o) => ({ id: o.id, label: o.label })),
          required: q.required,
          allowOther: q.allowOther,
        }))
      );
    }
  }, [open, poll]);

  const addQuestion = () => {
    setQuestions([
      ...questions,
      {
        id: `q_${Date.now()}`,
        prompt: "",
        type: "single_choice",
        options: [
          { id: `opt_${Date.now()}_1`, label: "" },
          { id: `opt_${Date.now()}_2`, label: "" },
        ],
        required: true,
        allowOther: false,
      },
    ]);
  };

  const updateQuestion = (index: number, question: QuestionFormData) => {
    const updated = [...questions];
    updated[index] = question;
    setQuestions(updated);
  };

  const removeQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      toast.error("Please enter a poll title");
      return;
    }

    if (canEditQuestions && questions.length === 0) {
      toast.error("Please add at least one question");
      return;
    }

    for (const q of questions) {
      if (!q.prompt.trim()) {
        toast.error("All questions must have text");
        return;
      }
      const typeInfo = QUESTION_TYPES.find((t) => t.value === q.type);
      if (typeInfo?.needsOptions) {
        const validOptions = q.options.filter((o) => o.label.trim());
        if (validOptions.length < 2) {
          toast.error(`Question "${q.prompt}" needs at least 2 options`);
          return;
        }
      }
    }

    busyToast.show("Updating poll...");

    try {
      const updateData: Record<string, unknown> = {
        title: title.trim(),
        description: description.trim() || null,
        audience: { scope: audienceScope },
        revealResults,
        allowAnonymous,
        allowComments,
      };

      if (canEditQuestions) {
        updateData.questions = questions.map((q, index) => ({
          prompt: q.prompt.trim(),
          type: q.type,
          required: q.required,
          allowOther: q.allowOther,
          order: index,
          options: QUESTION_TYPES.find((t) => t.value === q.type)?.needsOptions
            ? q.options
                .filter((o) => o.label.trim())
                .map((o, oIndex) => ({ label: o.label.trim(), order: oIndex }))
            : undefined,
        }));
      }

      await updateMutation.mutateAsync({ pollId: poll.id, data: updateData });

      toast.success("Poll updated successfully");
      onOpenChange(false);
      onSuccess?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update poll");
    } finally {
      busyToast.hide();
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 pt-20"
        onClick={() => onOpenChange(false)}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="relative w-full max-w-2xl rounded-2xl border border-white/10 bg-[#0f0f14] p-6 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-violet-500/30 bg-violet-500/10">
                <Pencil className="h-5 w-5 text-violet-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Edit Poll</h2>
                {isLive && (
                  <p className="text-xs text-amber-400">
                    Poll is live - questions cannot be modified
                  </p>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="text-white/60 hover:text-white"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Info */}
            <div className="space-y-4">
              <div>
                <Label className="text-white">Poll Title *</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter poll title..."
                  className="mt-1 border-white/10 bg-white/5 text-white"
                />
              </div>
              <div>
                <Label className="text-white/70">Description</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional description..."
                  className="mt-1 min-h-[80px] border-white/10 bg-white/5 text-white"
                />
              </div>
            </div>

            {/* Settings */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label className="text-white/70">Audience</Label>
                <PremiumSelect
                  value={audienceScope}
                  onValueChange={(v) => setAudienceScope(v as AudienceScope)}
                  disabled={isLive}
                >
                  <PremiumSelectTrigger className="mt-1">
                    <PremiumSelectValue />
                  </PremiumSelectTrigger>
                  <PremiumSelectContent>
                    {AUDIENCE_SCOPES.map((s) => (
                      <PremiumSelectItem key={s.value} value={s.value}>
                        {s.label}
                      </PremiumSelectItem>
                    ))}
                  </PremiumSelectContent>
                </PremiumSelect>
              </div>
              <div>
                <Label className="text-white/70">Show Results</Label>
                <PremiumSelect
                  value={revealResults}
                  onValueChange={(v) => setRevealResults(v as RevealResults)}
                >
                  <PremiumSelectTrigger className="mt-1">
                    <PremiumSelectValue />
                  </PremiumSelectTrigger>
                  <PremiumSelectContent>
                    <PremiumSelectItem value="live">Live (During Voting)</PremiumSelectItem>
                    <PremiumSelectItem value="after_close">After Poll Closes</PremiumSelectItem>
                    <PremiumSelectItem value="admin_only">Admin Only</PremiumSelectItem>
                  </PremiumSelectContent>
                </PremiumSelect>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  checked={allowAnonymous}
                  onCheckedChange={setAllowAnonymous}
                  disabled={isLive}
                />
                <Label className="text-sm text-white/60">Allow anonymous voting</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={allowComments} onCheckedChange={setAllowComments} />
                <Label className="text-sm text-white/60">Allow comments</Label>
              </div>
            </div>

            {/* Questions */}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <Label className="text-white">Questions *</Label>
                {canEditQuestions && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addQuestion}
                    className="gap-1 border-white/10 text-white/60"
                  >
                    <Plus className="h-4 w-4" />
                    Add Question
                  </Button>
                )}
              </div>
              <div className="space-y-4">
                {questions.map((q, index) => (
                  <QuestionEditor
                    key={q.id}
                    question={q}
                    index={index}
                    onChange={(updated) => updateQuestion(index, updated)}
                    onRemove={() => removeQuestion(index)}
                    canRemove={questions.length > 1}
                    disabled={!canEditQuestions}
                  />
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="border-white/10 text-white/60"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateMutation.isPending}
                className="bg-violet-600 text-white hover:bg-violet-700"
              >
                Save Changes
              </Button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
