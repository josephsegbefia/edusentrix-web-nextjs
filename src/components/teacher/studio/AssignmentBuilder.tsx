"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import {
  useTeacherClasses,
  type TeacherClass,
} from "@/hooks/teacher/useTeacherClasses";
import {
  useTeacherRubrics,
  type RubricSummary,
} from "@/hooks/teacher/useTeacherRubrics";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CustomDatePicker } from "@/components/ui/custom-date-picker";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import {
  PremiumDropdownMenu,
  PremiumDropdownMenuCheckboxItem,
  PremiumDropdownMenuContent,
  PremiumDropdownMenuTrigger,
} from "@/components/ui/premium-dropdown-menu";
import { RubricWizardModal, type RubricWizardResult } from "./RubricWizardModal";
import { cn } from "@/lib/utils";
import {
  glassInsetClass,
  glassPanelClass,
  glassPrimaryButtonClass,
  glassSecondaryButtonClass,
} from "@/lib/ui/glass-surfaces";

export type AssignmentAttachment = {
  name: string;
  url: string;
  type: "pdf" | "image" | "video" | "audio" | "link";
  size?: number;
};

export type AssignmentQuestionChoice = {
  id: string;
  text: string;
  isCorrect: boolean;
};

export type AssignmentQuestion = {
  id: string;
  prompt: string;
  points: number;
  explanation?: string | null;
  choices: AssignmentQuestionChoice[];
};

export type AssignmentFormValues = {
  title: string;
  instructions: string;
  type: "assignment" | "quiz" | "project" | "practice";
  subjectId: string;
  classGroupIds: string[];
  dueDate: Date | null;
  latePolicy: "accept" | "reject" | "penalize";
  latePenaltyPercent?: number | null;
  maxScore: number;
  quizTimeLimitMinutes?: number | null;
  weight?: number | null;
  rubricId?: string | null;
  attachments: AssignmentAttachment[];
  questions: AssignmentQuestion[];
};

export type AssignmentBuilderProps = {
  initialValues?: Partial<AssignmentFormValues>;
  mode?: "create" | "edit";
  layout?: "default" | "wizard";
  allowedTypes?: AssignmentFormValues["type"][];
  onSubmit: (values: AssignmentFormValues, options?: { publish?: boolean }) => Promise<void>;
  showPublish?: boolean;
};

const defaultValues: AssignmentFormValues = {
  title: "",
  instructions: "",
  type: "assignment",
  subjectId: "",
  classGroupIds: [],
  dueDate: new Date(),
  latePolicy: "accept",
  latePenaltyPercent: null,
  maxScore: 100,
  quizTimeLimitMinutes: null,
  weight: null,
  rubricId: null,
  attachments: [],
  questions: [],
};

function createId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function createChoice(overrides?: Partial<AssignmentQuestionChoice>): AssignmentQuestionChoice {
  return {
    id: createId("choice"),
    text: "",
    isCorrect: false,
    ...overrides,
  };
}

function createQuestion(overrides?: Partial<AssignmentQuestion>): AssignmentQuestion {
  const firstChoice = createChoice({ isCorrect: true });
  return {
    id: createId("question"),
    prompt: "",
    points: 1,
    explanation: "",
    choices: [firstChoice, createChoice()],
    ...overrides,
  };
}

type UnknownQuestionChoice = {
  id?: string;
  choiceId?: string;
  _id?: string;
  text?: string;
  label?: string;
  value?: string;
  option?: string;
  answer?: string;
  isCorrect?: boolean;
  correct?: boolean;
  isAnswer?: boolean;
};

type UnknownQuestion = {
  id?: string;
  questionId?: string;
  _id?: string;
  prompt?: string;
  question?: string;
  text?: string;
  title?: string;
  points?: number | string | null;
  score?: number | string | null;
  explanation?: string | null;
  rationale?: string | null;
  choices?: unknown;
  options?: unknown;
  answers?: unknown;
  correctChoiceId?: string;
  correctOptionId?: string;
  correctAnswerId?: string;
  correctAnswer?: string;
  correctOption?: string;
  correctIndex?: number;
  correctOptionIndex?: number;
};

function toBooleanFlag(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "1" || normalized === "yes";
  }
  return false;
}

function normalizeChoiceForEdit(choice: unknown): AssignmentQuestionChoice {
  if (typeof choice === "string") {
    return createChoice({ text: choice });
  }

  if (!choice || typeof choice !== "object") {
    return createChoice();
  }

  const value = choice as UnknownQuestionChoice;
  const text =
    (typeof value.text === "string" && value.text) ||
    (typeof value.label === "string" && value.label) ||
    (typeof value.value === "string" && value.value) ||
    (typeof value.option === "string" && value.option) ||
    (typeof value.answer === "string" && value.answer) ||
    "";
  const rawId =
    (typeof value.id === "string" && value.id) ||
    (typeof value.choiceId === "string" && value.choiceId) ||
    (typeof value._id === "string" && value._id) ||
    "";

  return createChoice({
    id: rawId.trim() || createId("choice"),
    text,
    isCorrect: toBooleanFlag(value.isCorrect ?? value.correct ?? value.isAnswer),
  });
}

function normalizeQuestionsForEdit(rawQuestions: unknown): AssignmentQuestion[] {
  if (!Array.isArray(rawQuestions)) return [];

  return rawQuestions.map((rawQuestion) => {
    if (!rawQuestion || typeof rawQuestion !== "object") {
      return createQuestion();
    }

    const question = rawQuestion as UnknownQuestion;
    const prompt =
      (typeof question.prompt === "string" && question.prompt) ||
      (typeof question.question === "string" && question.question) ||
      (typeof question.text === "string" && question.text) ||
      (typeof question.title === "string" && question.title) ||
      "";
    const rawQuestionId =
      (typeof question.id === "string" && question.id) ||
      (typeof question.questionId === "string" && question.questionId) ||
      (typeof question._id === "string" && question._id) ||
      "";
    const pointsValue =
      typeof question.points === "number"
        ? question.points
        : typeof question.points === "string"
          ? Number(question.points)
          : typeof question.score === "number"
            ? question.score
            : typeof question.score === "string"
              ? Number(question.score)
              : 1;
    const points = Number.isFinite(pointsValue) ? Math.max(0, pointsValue) : 1;
    const explanation =
      (typeof question.explanation === "string" && question.explanation) ||
      (typeof question.rationale === "string" && question.rationale) ||
      "";

    const rawChoices = question.choices ?? question.options ?? question.answers;
    let choices = Array.isArray(rawChoices)
      ? rawChoices.map((choice) => normalizeChoiceForEdit(choice))
      : [];

    if (choices.length === 0) {
      choices = [createChoice({ isCorrect: true }), createChoice()];
    }
    if (choices.length === 1) {
      choices = [...choices, createChoice()];
    }

    const explicitCorrectId =
      (typeof question.correctChoiceId === "string" && question.correctChoiceId) ||
      (typeof question.correctOptionId === "string" && question.correctOptionId) ||
      (typeof question.correctAnswerId === "string" && question.correctAnswerId) ||
      "";
    const explicitCorrectText =
      (typeof question.correctAnswer === "string" && question.correctAnswer.trim()) ||
      (typeof question.correctOption === "string" && question.correctOption.trim()) ||
      "";
    const explicitCorrectIndex =
      typeof question.correctIndex === "number"
        ? question.correctIndex
        : typeof question.correctOptionIndex === "number"
          ? question.correctOptionIndex
          : -1;

    if (explicitCorrectId) {
      choices = choices.map((choice) => ({
        ...choice,
        isCorrect: choice.id === explicitCorrectId,
      }));
    } else if (explicitCorrectText) {
      const normalized = explicitCorrectText.toLowerCase();
      choices = choices.map((choice) => ({
        ...choice,
        isCorrect: choice.text.trim().toLowerCase() === normalized,
      }));
    } else if (explicitCorrectIndex >= 0 && explicitCorrectIndex < choices.length) {
      choices = choices.map((choice, index) => ({
        ...choice,
        isCorrect: index === explicitCorrectIndex,
      }));
    }

    const correctIndices = choices.reduce<number[]>((acc, choice, index) => {
      if (choice.isCorrect) acc.push(index);
      return acc;
    }, []);

    if (correctIndices.length === 0) {
      choices[0] = { ...choices[0], isCorrect: true };
    } else if (correctIndices.length > 1) {
      choices = choices.map((choice, index) => ({
        ...choice,
        isCorrect: index === correctIndices[0],
      }));
    }

    return createQuestion({
      id: rawQuestionId.trim() || createId("question"),
      prompt,
      points,
      explanation,
      choices,
    });
  });
}

const WIZARD_STEPS = [
  { id: "basics", label: "Basics" },
  { id: "audience", label: "Audience" },
  { id: "questions", label: "Questions" },
  { id: "grading", label: "Grading" },
  { id: "attachments", label: "Attachments" },
] as const;

const ALL_WORK_TYPES: AssignmentFormValues["type"][] = [
  "assignment",
  "quiz",
  "project",
  "practice",
];

const WORK_TYPE_LABEL: Record<AssignmentFormValues["type"], string> = {
  assignment: "Assignment",
  quiz: "Quiz",
  project: "Project",
  practice: "Practice",
};

export function AssignmentBuilder({
  initialValues,
  mode = "create",
  layout = "default",
  allowedTypes,
  onSubmit,
  showPublish = true,
}: AssignmentBuilderProps) {
  const { data: classesData } = useTeacherClasses();
  const { data: rubricsData, refetch: refetchRubrics } = useTeacherRubrics();
  const selectableTypes = React.useMemo(() => {
    if (!allowedTypes || allowedTypes.length === 0) return ALL_WORK_TYPES;
    return ALL_WORK_TYPES.filter((type) => allowedTypes.includes(type));
  }, [allowedTypes]);
  const defaultType = selectableTypes[0] || "assignment";
  const normalizedInitialQuestions = React.useMemo(
    () => normalizeQuestionsForEdit(initialValues?.questions),
    [initialValues?.questions]
  );

  const [values, setValues] = React.useState<AssignmentFormValues>({
    ...defaultValues,
    ...initialValues,
    type:
      initialValues?.type && selectableTypes.includes(initialValues.type)
        ? initialValues.type
        : defaultType,
    questions: normalizedInitialQuestions,
  });
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [wizardStep, setWizardStep] = React.useState(1);
  const [rubricModalOpen, setRubricModalOpen] = React.useState(false);
  const [createdRubric, setCreatedRubric] = React.useState<RubricSummary | null>(null);

  React.useEffect(() => {
    if (initialValues) {
      setValues((prev) => ({
        ...prev,
        ...initialValues,
        type:
          initialValues.type && selectableTypes.includes(initialValues.type)
            ? initialValues.type
            : defaultType,
        questions: normalizedInitialQuestions,
      }));
    }
  }, [defaultType, initialValues, normalizedInitialQuestions, selectableTypes]);

  React.useEffect(() => {
    setValues((prev) => {
      if (selectableTypes.includes(prev.type)) return prev;
      return { ...prev, type: defaultType };
    });
  }, [defaultType, selectableTypes]);

  React.useEffect(() => {
    if (values.type === "quiz") return;
    setValues((prev) => {
      if (prev.quizTimeLimitMinutes == null) return prev;
      return { ...prev, quizTimeLimitMinutes: null };
    });
  }, [values.type]);

  const classAssignments = React.useMemo(
    () => classesData?.data.classes ?? [],
    [classesData]
  );
  const subjectOptions = React.useMemo(() => {
    const map = new Map<string, string>();
    classAssignments.forEach((item: TeacherClass) => {
      if (item.subjectId && item.subjectName) {
        map.set(item.subjectId, item.subjectName);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [classAssignments]);

  const classOptions = React.useMemo(() => {
    if (!values.subjectId) return [];
    return classAssignments
      .filter((item: TeacherClass) => item.subjectId === values.subjectId)
      .map((item: TeacherClass) => ({ id: item._id, name: item.name }));
  }, [classAssignments, values.subjectId]);

  const rubrics = React.useMemo(
    () => rubricsData?.data.rubrics ?? [],
    [rubricsData]
  );
  const rubricOptions = React.useMemo(() => {
    if (!createdRubric) return rubrics;
    if (rubrics.some((rubric) => rubric.id === createdRubric.id)) return rubrics;
    return [createdRubric, ...rubrics];
  }, [createdRubric, rubrics]);

  const updateValue = <K extends keyof AssignmentFormValues>(
    key: K,
    value: AssignmentFormValues[K]
  ) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const toggleClassGroup = (id: string) => {
    setValues((prev) => {
      const next = new Set(prev.classGroupIds);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return { ...prev, classGroupIds: Array.from(next) };
    });
  };

  const addAttachment = () => {
    setValues((prev) => ({
      ...prev,
      attachments: [...prev.attachments, { name: "", url: "", type: "link" }],
    }));
  };

  const updateAttachment = (index: number, patch: Partial<AssignmentAttachment>) => {
    setValues((prev) => {
      const next = [...prev.attachments];
      next[index] = { ...next[index], ...patch };
      return { ...prev, attachments: next };
    });
  };

  const removeAttachment = (index: number) => {
    setValues((prev) => {
      const next = [...prev.attachments];
      next.splice(index, 1);
      return { ...prev, attachments: next };
    });
  };

  const addQuestion = () => {
    setValues((prev) => ({
      ...prev,
      questions: [...prev.questions, createQuestion()],
    }));
  };

  const updateQuestion = (index: number, patch: Partial<AssignmentQuestion>) => {
    setValues((prev) => {
      const next = [...prev.questions];
      next[index] = { ...next[index], ...patch };
      return { ...prev, questions: next };
    });
  };

  const removeQuestion = (index: number) => {
    setValues((prev) => {
      const next = [...prev.questions];
      next.splice(index, 1);
      return { ...prev, questions: next };
    });
  };

  const addChoice = (questionIndex: number) => {
    setValues((prev) => {
      const nextQuestions = [...prev.questions];
      const target = nextQuestions[questionIndex];
      nextQuestions[questionIndex] = {
        ...target,
        choices: [...target.choices, createChoice()],
      };
      return { ...prev, questions: nextQuestions };
    });
  };

  const updateChoice = (
    questionIndex: number,
    choiceIndex: number,
    patch: Partial<AssignmentQuestionChoice>
  ) => {
    setValues((prev) => {
      const nextQuestions = [...prev.questions];
      const target = nextQuestions[questionIndex];
      const nextChoices = [...target.choices];
      nextChoices[choiceIndex] = { ...nextChoices[choiceIndex], ...patch };
      nextQuestions[questionIndex] = { ...target, choices: nextChoices };
      return { ...prev, questions: nextQuestions };
    });
  };

  const removeChoice = (questionIndex: number, choiceIndex: number) => {
    setValues((prev) => {
      const nextQuestions = [...prev.questions];
      const target = nextQuestions[questionIndex];
      if (target.choices.length <= 2) return prev;

      const nextChoices = [...target.choices];
      const removed = nextChoices[choiceIndex];
      nextChoices.splice(choiceIndex, 1);

      if (removed?.isCorrect && nextChoices.length > 0) {
        nextChoices[0] = { ...nextChoices[0], isCorrect: true };
      }

      nextQuestions[questionIndex] = { ...target, choices: nextChoices };
      return { ...prev, questions: nextQuestions };
    });
  };

  const setCorrectChoice = (questionIndex: number, choiceIndex: number) => {
    setValues((prev) => {
      const nextQuestions = [...prev.questions];
      const target = nextQuestions[questionIndex];
      nextQuestions[questionIndex] = {
        ...target,
        choices: target.choices.map((choice, index) => ({
          ...choice,
          isCorrect: index === choiceIndex,
        })),
      };
      return { ...prev, questions: nextQuestions };
    });
  };

  const hasValidQuestions = React.useMemo(() => {
    return values.questions.every((question) => {
      const promptValid = question.prompt.trim().length > 0;
      const choicesValid =
        question.choices.length >= 2 &&
        question.choices.every((choice) => choice.text.trim().length > 0);
      const correctCount = question.choices.filter((choice) => choice.isCorrect).length;
      return promptValid && choicesValid && correctCount === 1;
    });
  }, [values.questions]);

  const isStepValid = React.useMemo(() => {
    const validations = [
      Boolean(values.title.trim() && values.instructions.trim()),
      Boolean(values.subjectId && values.classGroupIds.length > 0 && values.dueDate),
      hasValidQuestions,
      values.maxScore >= 0,
      true,
    ];
    return validations[wizardStep - 1] ?? false;
  }, [hasValidQuestions, values, wizardStep]);

  const currentStepLabel = WIZARD_STEPS[wizardStep - 1]?.label || "Setup";

  const handleSubmit = async (publish?: boolean) => {
    setIsSubmitting(true);
    try {
      await onSubmit(values, { publish });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreatedRubric = async (rubric: RubricWizardResult) => {
    const mapped: RubricSummary = {
      id: rubric.id,
      title: rubric.title,
      description: rubric.description,
      criteria: rubric.criteria,
      createdAt: null,
    };
    setCreatedRubric(mapped);
    updateValue("rubricId", rubric.id);
    await refetchRubrics();
  };

  const basicsSection = (
    <Card className={glassPanelClass}>
      <CardHeader>
        <CardTitle className="text-lg">Assignment Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.2em] text-white/40">Title</label>
            <Input
              value={values.title}
              onChange={(event) => updateValue("title", event.target.value)}
              placeholder={`${WORK_TYPE_LABEL[values.type]} title`}
              className="border-white/10 bg-white/5 text-white/80"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.2em] text-white/40">Type</label>
            {selectableTypes.length === 1 ? (
              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80">
                {WORK_TYPE_LABEL[selectableTypes[0]]}
              </div>
            ) : (
              <PremiumSelect
                value={values.type}
                onValueChange={(value) =>
                  updateValue("type", value as AssignmentFormValues["type"])
                }
              >
                <PremiumSelectTrigger>
                  <PremiumSelectValue placeholder="Select type" />
                </PremiumSelectTrigger>
                <PremiumSelectContent>
                  {selectableTypes.map((type) => (
                    <PremiumSelectItem key={type} value={type}>
                      {WORK_TYPE_LABEL[type]}
                    </PremiumSelectItem>
                  ))}
                </PremiumSelectContent>
              </PremiumSelect>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs uppercase tracking-[0.2em] text-white/40">Instructions</label>
          <Textarea
            value={values.instructions}
            onChange={(event) => updateValue("instructions", event.target.value)}
            placeholder="Provide clear instructions for students"
            className="min-h-[140px] border-white/10 bg-white/5 text-white/80"
          />
        </div>
      </CardContent>
    </Card>
  );

  const audienceSection = (
    <Card className={glassPanelClass}>
      <CardHeader>
        <CardTitle className="text-lg">Audience & Schedule</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.2em] text-white/40">Subject</label>
            <PremiumSelect
              value={values.subjectId || undefined}
              onValueChange={(value) => {
                updateValue("subjectId", value);
                updateValue("classGroupIds", []);
              }}
            >
              <PremiumSelectTrigger>
                <PremiumSelectValue placeholder="Select subject" />
              </PremiumSelectTrigger>
              <PremiumSelectContent>
                {subjectOptions.length === 0 && (
                  <PremiumSelectItem value="none" disabled>
                    No subjects available
                  </PremiumSelectItem>
                )}
                {subjectOptions.map((subject) => (
                  <PremiumSelectItem key={subject.id} value={subject.id}>
                    {subject.name}
                  </PremiumSelectItem>
                ))}
              </PremiumSelectContent>
            </PremiumSelect>
          </div>

          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.2em] text-white/40">Classes</label>
            <PremiumDropdownMenu>
              <PremiumDropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full justify-between border border-white/10 bg-white/5 text-left text-white/80 hover:bg-white/10"
                >
                  {values.classGroupIds.length > 0
                    ? `${values.classGroupIds.length} classes selected`
                    : "Select classes"}
                </Button>
              </PremiumDropdownMenuTrigger>
              <PremiumDropdownMenuContent align="start" className="min-w-[220px]">
                {classOptions.length === 0 && (
                  <PremiumDropdownMenuCheckboxItem checked={false} disabled>
                    Select a subject first
                  </PremiumDropdownMenuCheckboxItem>
                )}
                {classOptions.map((option) => (
                  <PremiumDropdownMenuCheckboxItem
                    key={option.id}
                    checked={values.classGroupIds.includes(option.id)}
                    onCheckedChange={() => toggleClassGroup(option.id)}
                  >
                    {option.name}
                  </PremiumDropdownMenuCheckboxItem>
                ))}
              </PremiumDropdownMenuContent>
            </PremiumDropdownMenu>
            {values.classGroupIds.length > 0 && (
              <div className="text-xs text-white/50">
                {classOptions
                  .filter((option) => values.classGroupIds.includes(option.id))
                  .map((option) => option.name)
                  .join(", ")}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.2em] text-white/40">Due Date</label>
            <CustomDatePicker
              value={values.dueDate}
              onChange={(date) => updateValue("dueDate", date)}
              placeholder="Select date"
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.2em] text-white/40">Weight (optional)</label>
            <Input
              type="number"
              min={0}
              max={100}
              value={values.weight ?? ""}
              onChange={(event) => {
                const value = event.target.value;
                updateValue("weight", value === "" ? null : Number(value));
              }}
              className="border-white/10 bg-white/5 text-white/80"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const questionsSection = (
    <Card className={glassPanelClass}>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg">Questions (Optional)</CardTitle>
          <p className="text-sm text-white/55">
            Add multiple-choice questions with correct answers for instant scoring.
          </p>
        </div>
        <Button type="button" variant="ghost" onClick={addQuestion} className="text-white/70 hover:bg-white/10">
          <Plus className="h-4 w-4" />
          Add question
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {values.questions.length === 0 ? (
          <div className={cn(glassInsetClass, "rounded-2xl border-dashed p-6 text-center text-white/50")}>
            No questions added yet.
          </div>
        ) : (
          values.questions.map((question, questionIndex) => (
            <div
              key={question.id || questionIndex}
              className={cn(glassInsetClass, "space-y-3 rounded-2xl p-4")}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-white">Question {questionIndex + 1}</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeQuestion(questionIndex)}
                  className="text-white/60 hover:bg-white/10"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_120px]">
                <Input
                  value={question.prompt}
                  onChange={(event) =>
                    updateQuestion(questionIndex, { prompt: event.target.value })
                  }
                  placeholder="Question prompt"
                  className="border-white/10 bg-white/5 text-white/80"
                />
                <Input
                  type="number"
                  min={0}
                  value={question.points}
                  onChange={(event) =>
                    updateQuestion(questionIndex, {
                      points: Math.max(0, Number(event.target.value || 0)),
                    })
                  }
                  className="border-white/10 bg-white/5 text-white/80"
                />
              </div>

              <Input
                value={question.explanation || ""}
                onChange={(event) =>
                  updateQuestion(questionIndex, { explanation: event.target.value })
                }
                placeholder="Optional explanation (shown to teacher)"
                className="border-white/10 bg-white/5 text-white/80"
              />

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/40">Choices</p>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => addChoice(questionIndex)}
                    className="text-white/70 hover:bg-white/10"
                  >
                    <Plus className="h-4 w-4" />
                    Add choice
                  </Button>
                </div>

                {question.choices.map((choice, choiceIndex) => (
                  <div
                    key={choice.id || `${question.id}-${choiceIndex}`}
                    className="grid grid-cols-[auto_1fr_auto] items-center gap-2 rounded-xl border border-white/10 bg-black/20 p-2"
                  >
                    <button
                      type="button"
                      onClick={() => setCorrectChoice(questionIndex, choiceIndex)}
                      className={`h-6 w-6 rounded-full border transition ${
                        choice.isCorrect
                          ? "border-emerald-400 bg-emerald-400/25"
                          : "border-white/20 bg-transparent"
                      }`}
                      aria-label={`Mark choice ${choiceIndex + 1} as correct`}
                    >
                      {choice.isCorrect ? <Check className="mx-auto h-3.5 w-3.5 text-emerald-200" /> : null}
                    </button>
                    <Input
                      value={choice.text}
                      onChange={(event) =>
                        updateChoice(questionIndex, choiceIndex, {
                          text: event.target.value,
                        })
                      }
                      placeholder={`Choice ${choiceIndex + 1}`}
                      className="border-white/10 bg-white/5 text-white/80"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeChoice(questionIndex, choiceIndex)}
                      disabled={question.choices.length <= 2}
                      className="text-white/60 hover:bg-white/10"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );

  const gradingSection = (
    <Card className={glassPanelClass}>
      <CardHeader>
        <CardTitle className="text-lg">Grading Setup</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.2em] text-white/40">Max Score</label>
            <Input
              type="number"
              min={0}
              value={values.maxScore}
              onChange={(event) =>
                updateValue("maxScore", Math.max(0, Number(event.target.value || 0)))
              }
              className="border-white/10 bg-white/5 text-white/80"
            />
            <p className="text-xs text-white/45">
              Auto-graded scores from questions are scaled to this value.
            </p>
          </div>

          {values.type !== "quiz" && (
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.2em] text-white/40">Late Policy</label>
              <PremiumSelect
                value={values.latePolicy}
                onValueChange={(value) =>
                  updateValue("latePolicy", value as AssignmentFormValues["latePolicy"])
                }
              >
                <PremiumSelectTrigger>
                  <PremiumSelectValue placeholder="Select policy" />
                </PremiumSelectTrigger>
                <PremiumSelectContent>
                  <PremiumSelectItem value="accept">Accept late work</PremiumSelectItem>
                  <PremiumSelectItem value="reject">Reject late work</PremiumSelectItem>
                  <PremiumSelectItem value="penalize">Accept with penalty</PremiumSelectItem>
                </PremiumSelectContent>
              </PremiumSelect>
            </div>
          )}
        </div>

        {values.type === "quiz" && (
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.2em] text-white/40">Quiz Timer (minutes)</label>
            <Input
              type="number"
              min={1}
              max={300}
              value={values.quizTimeLimitMinutes ?? ""}
              onChange={(event) => {
                const value = event.target.value.trim();
                if (!value) {
                  updateValue("quizTimeLimitMinutes", null);
                  return;
                }
                const next = Number(value);
                if (!Number.isFinite(next)) return;
                const bounded = Math.min(300, Math.max(1, Math.floor(next)));
                updateValue("quizTimeLimitMinutes", bounded);
              }}
              placeholder="Set quiz timer"
              className="border-white/10 bg-white/5 text-white/80"
            />
            <p className="text-xs text-white/45">
              Students see this timer and submissions auto-submit when it reaches zero.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {values.type !== "quiz" && (
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.2em] text-white/40">Late Penalty %</label>
              <Input
                type="number"
                min={0}
                max={100}
                value={values.latePenaltyPercent ?? ""}
                onChange={(event) => {
                  const value = event.target.value;
                  updateValue("latePenaltyPercent", value === "" ? null : Number(value));
                }}
                disabled={values.latePolicy !== "penalize"}
                className="border-white/10 bg-white/5 text-white/80"
              />
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.2em] text-white/40">Rubric</label>
            <div className="flex gap-2">
              <div className="flex-1">
                <PremiumSelect
                  value={values.rubricId || "none"}
                  onValueChange={(value) =>
                    updateValue("rubricId", value === "none" ? null : value)
                  }
                >
                  <PremiumSelectTrigger>
                    <PremiumSelectValue placeholder="Select rubric" />
                  </PremiumSelectTrigger>
                  <PremiumSelectContent>
                    <PremiumSelectItem value="none">No rubric</PremiumSelectItem>
                    {rubricOptions.map((rubric) => (
                      <PremiumSelectItem key={rubric.id} value={rubric.id}>
                        {rubric.title}
                      </PremiumSelectItem>
                    ))}
                  </PremiumSelectContent>
                </PremiumSelect>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => setRubricModalOpen(true)}
                className="border-white/10 bg-white/5 text-white/80 hover:bg-white/10"
              >
                <Plus className="h-4 w-4" />
                New
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const attachmentsSection = (
    <Card className={glassPanelClass}>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Attachments</CardTitle>
        <Button type="button" variant="ghost" onClick={addAttachment} className="text-white/70 hover:bg-white/10">
          <Plus className="h-4 w-4" />
          Add attachment
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {values.attachments.length === 0 ? (
          <div className={cn(glassInsetClass, "rounded-2xl p-6 text-center text-white/50")}>
            No attachments added yet.
          </div>
        ) : (
          values.attachments.map((attachment, index) => (
            <div
              key={`${attachment.name}-${index}`}
              className={cn(
                glassInsetClass,
                "grid grid-cols-1 gap-3 rounded-2xl p-4 md:grid-cols-[1.2fr_1.6fr_0.8fr_auto] md:items-center"
              )}
            >
              <Input
                value={attachment.name}
                onChange={(event) => updateAttachment(index, { name: event.target.value })}
                placeholder="File name"
                className="border-white/10 bg-white/5 text-white/80"
              />
              <Input
                value={attachment.url}
                onChange={(event) => updateAttachment(index, { url: event.target.value })}
                placeholder="https://"
                className="border-white/10 bg-white/5 text-white/80"
              />
              <PremiumSelect
                value={attachment.type}
                onValueChange={(value) =>
                  updateAttachment(index, {
                    type: value as AssignmentAttachment["type"],
                  })
                }
              >
                <PremiumSelectTrigger>
                  <PremiumSelectValue placeholder="Type" />
                </PremiumSelectTrigger>
                <PremiumSelectContent>
                  <PremiumSelectItem value="pdf">PDF</PremiumSelectItem>
                  <PremiumSelectItem value="image">Image</PremiumSelectItem>
                  <PremiumSelectItem value="video">Video</PremiumSelectItem>
                  <PremiumSelectItem value="audio">Audio</PremiumSelectItem>
                  <PremiumSelectItem value="link">Link</PremiumSelectItem>
                </PremiumSelectContent>
              </PremiumSelect>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeAttachment(index)}
                className="text-white/60 hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );

  const summaryBanner = (
    <div className={cn(glassInsetClass, "rounded-2xl p-4 text-sm text-white/70")}>
      <div className="flex flex-wrap items-center gap-2">
        <Sparkles className="h-4 w-4 text-teal-300" />
        <span>
          {values.questions.length} question{values.questions.length === 1 ? "" : "s"} • {values.attachments.length} attachment
          {values.attachments.length === 1 ? "" : "s"}
        </span>
      </div>
    </div>
  );

  const wizardContent =
    wizardStep === 1
      ? basicsSection
      : wizardStep === 2
        ? audienceSection
        : wizardStep === 3
          ? questionsSection
          : wizardStep === 4
            ? gradingSection
            : (
              <div className="space-y-4">
                {summaryBanner}
                {attachmentsSection}
              </div>
            );

  const submitActions = (
    <>
      <Button
        type="button"
        onClick={() => handleSubmit(false)}
        disabled={isSubmitting}
        className={glassSecondaryButtonClass}
      >
        {mode === "create" ? "Save Draft" : "Save Changes"}
      </Button>
      {showPublish && (
        <Button
          type="button"
          onClick={() => handleSubmit(true)}
          disabled={isSubmitting}
          className={glassPrimaryButtonClass}
        >
          {mode === "create" ? "Publish Now" : "Publish"}
        </Button>
      )}
    </>
  );

  return (
    <div className="space-y-6">
      {layout === "wizard" ? (
        <Card className={glassPanelClass}>
          <CardContent className="space-y-4 p-5">
            <div className="flex items-center justify-between">
              <div className="text-sm text-white/70">
                Step <span className="font-semibold">{wizardStep}</span> of {WIZARD_STEPS.length}
              </div>
              <div className="flex gap-1">
                {WIZARD_STEPS.map((step, index) => (
                  <span
                    key={step.id}
                    className={cn(
                      "h-1.5 w-8 rounded-full transition-all",
                      index + 1 <= wizardStep
                        ? "bg-linear-to-r from-teal-400 to-cyan-400"
                        : "bg-white/20"
                    )}
                  />
                ))}
              </div>
            </div>
            <div className="text-xs uppercase tracking-[0.2em] text-white/45">{currentStepLabel}</div>
          </CardContent>
        </Card>
      ) : null}

      {layout === "wizard" ? (
        <AnimatePresence mode="wait">
          <motion.div
            key={wizardStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            {wizardContent}
          </motion.div>
        </AnimatePresence>
      ) : (
        <div className="space-y-6">
          {basicsSection}
          {audienceSection}
          {questionsSection}
          {gradingSection}
          {summaryBanner}
          {attachmentsSection}
        </div>
      )}

      {layout === "wizard" ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => setWizardStep((prev) => Math.max(prev - 1, 1))}
            disabled={wizardStep === 1}
            className={glassSecondaryButtonClass}
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </Button>

          {wizardStep < WIZARD_STEPS.length ? (
            <Button
              type="button"
              onClick={() => setWizardStep((prev) => Math.min(prev + 1, WIZARD_STEPS.length))}
              disabled={!isStepValid}
              className={glassPrimaryButtonClass}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">{submitActions}</div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">{submitActions}</div>
      )}

      <RubricWizardModal
        open={rubricModalOpen}
        onOpenChange={setRubricModalOpen}
        onCreated={handleCreatedRubric}
      />
    </div>
  );
}
