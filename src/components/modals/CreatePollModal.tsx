// src/components/modals/CreatePollModal.tsx
"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, Trash2, X, GripVertical } from "lucide-react";
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
import { useCreatePoll, QuestionType, AudienceScope, RevealResults } from "@/hooks/admin/useCommunityPolls";
import { useBusyToast } from "@/hooks/useBusyToast";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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

interface TemplateData {
  id: string;
  name: string;
  description: string;
  category: string;
  questions: Array<{
    prompt: string;
    description?: string;
    type: QuestionType;
    options?: Array<{ label: string; order: number }>;
    required: boolean;
    allowOther: boolean;
    order: number;
  }>;
  defaults: {
    durationDays: number;
    anonymity: string;
    revealResults: RevealResults;
    allowComments: boolean;
    minResponseRate: number;
    audienceScope: AudienceScope;
    audienceType: string;
    requiresApproval: boolean;
  };
}

interface CreatePollModalProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onSuccess?: () => void;
  readonly template?: TemplateData | null;
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
}

function QuestionEditor({ question, index, onChange, onRemove, canRemove }: QuestionEditorProps) {
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
        {canRemove && (
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
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label className="text-white/70">Question Type</Label>
            <PremiumSelect
              value={question.type}
              onValueChange={(v) => onChange({ ...question, type: v as QuestionType })}
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
              />
              <Label className="text-sm text-white/60">Required</Label>
            </div>
            {needsOptions && (
              <div className="flex items-center gap-2">
                <Switch
                  checked={question.allowOther}
                  onCheckedChange={(checked) => onChange({ ...question, allowOther: checked })}
                />
                <Label className="text-sm text-white/60">Allow "Other"</Label>
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
                />
                {question.options.length > 2 && (
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
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Main Modal Component
// ============================================================================

export default function CreatePollModal({ open, onOpenChange, onSuccess, template }: CreatePollModalProps) {
  const createMutation = useCreatePoll();
  const busyToast = useBusyToast();

  // Convert template questions to form data
  const templateQuestionsToFormData = React.useCallback((templateQuestions: TemplateData["questions"]): QuestionFormData[] => {
    return templateQuestions.map((q, index) => ({
      id: `q_${Date.now()}_${index}`,
      prompt: q.prompt,
      type: q.type,
      options: q.options?.map((opt, oIndex) => ({
        id: `opt_${Date.now()}_${index}_${oIndex}`,
        label: opt.label,
      })) || [
        { id: `opt_${Date.now()}_${index}_0`, label: "" },
        { id: `opt_${Date.now()}_${index}_1`, label: "" },
      ],
      required: q.required,
      allowOther: q.allowOther,
    }));
  }, []);

  // Form state - initialize from template if provided
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [audienceScope, setAudienceScope] = React.useState<AudienceScope>("school");
  const [revealResults, setRevealResults] = React.useState<RevealResults>("after_close");
  const [allowAnonymous, setAllowAnonymous] = React.useState(false);
  const [allowComments, setAllowComments] = React.useState(false);
  const [minResponseRate, setMinResponseRate] = React.useState(60);
  const [templateId, setTemplateId] = React.useState<string | null>(null);
  const [questions, setQuestions] = React.useState<QuestionFormData[]>([
    {
      id: `q_${Date.now()}`,
      prompt: "",
      type: "single_choice",
      options: [
        { id: "opt_1", label: "" },
        { id: "opt_2", label: "" },
      ],
      required: true,
      allowOther: false,
    },
  ]);

  // Initialize from template when it changes
  React.useEffect(() => {
    if (template) {
      setTitle(""); // Let user enter title
      setDescription(template.description || "");
      setAudienceScope(template.defaults.audienceScope);
      setRevealResults(template.defaults.revealResults);
      setAllowAnonymous(template.defaults.anonymity === "anonymous");
      setAllowComments(template.defaults.allowComments);
      setMinResponseRate(template.defaults.minResponseRate);
      setTemplateId(template.id);
      setQuestions(templateQuestionsToFormData(template.questions));
    }
  }, [template, templateQuestionsToFormData]);

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setAudienceScope("school");
    setRevealResults("after_close");
    setAllowAnonymous(false);
    setAllowComments(false);
    setMinResponseRate(60);
    setTemplateId(null);
    setQuestions([
      {
        id: `q_${Date.now()}`,
        prompt: "",
        type: "single_choice",
        options: [
          { id: "opt_1", label: "" },
          { id: "opt_2", label: "" },
        ],
        required: true,
        allowOther: false,
      },
    ]);
  };

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

    // Validation
    if (!title.trim()) {
      toast.error("Please enter a poll title");
      return;
    }

    if (questions.length === 0) {
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

    busyToast.show("Creating poll...");

    try {
      await createMutation.mutateAsync({
        templateId: templateId || undefined,
        title: title.trim(),
        description: description.trim() || undefined,
        audience: { scope: audienceScope },
        revealResults,
        allowAnonymous,
        allowComments,
        minResponseRate,
        questions: questions.map((q, index) => ({
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
        })),
      });

      toast.success("Poll created successfully");
      resetForm();
      onOpenChange(false);
      onSuccess?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create poll");
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
            <div>
              <h2 className="text-xl font-bold text-white">Create Poll</h2>
              {template && (
                <p className="mt-1 text-sm text-violet-400">
                  Using template: {template.name}
                </p>
              )}
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
                <PremiumSelect value={audienceScope} onValueChange={(v) => setAudienceScope(v as AudienceScope)}>
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
                <PremiumSelect value={revealResults} onValueChange={(v) => setRevealResults(v as RevealResults)}>
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
                <Switch checked={allowAnonymous} onCheckedChange={setAllowAnonymous} />
                <Label className="text-sm text-white/60">Allow anonymous voting</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={allowComments} onCheckedChange={setAllowComments} />
                <Label className="text-sm text-white/60">Allow comments</Label>
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-sm text-white/60">Min response rate:</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={minResponseRate}
                  onChange={(e) => setMinResponseRate(Number(e.target.value))}
                  className="w-20 border-white/10 bg-white/5 text-white text-center"
                />
                <span className="text-sm text-white/60">%</span>
              </div>
            </div>

            {/* Questions */}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <Label className="text-white">Questions *</Label>
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
                disabled={createMutation.isPending}
                className="bg-violet-600 text-white hover:bg-violet-700"
              >
                Create Poll
              </Button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
