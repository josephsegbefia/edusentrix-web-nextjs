"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  BadgeCheck,
  ClipboardCheck,
  Edit3,
  FileQuestion,
  Hash,
  ListPlus,
  Loader2,
  MoreHorizontal,
  Plus,
  Printer,
  Radical,
  Send,
  Sparkles,
  Trash2,
  Type,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  PremiumDropdownMenu,
  PremiumDropdownMenuContent,
  PremiumDropdownMenuItem,
  PremiumDropdownMenuTrigger,
} from "@/components/ui/premium-dropdown-menu";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import {
  CompactRichText,
  extractPlainText,
  RichTextEditor,
} from "@/components/ui/rich-text-editor";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useConfirmationDialog } from "@/hooks/useConfirmationDialog";
import { cn } from "@/lib/utils";

type Paper = {
  id: string;
  title: string;
  status: string;
  scope: "class_group" | "grade_wide";
  durationMinutes?: number | null;
  totalMarks: number;
  instructions?: string | null;
  candidateInstructions?: string | null;
  scheduledExamDate?: string | null;
  updatedAt?: string | null;
};

type Section = {
  id: string;
  title: string;
  instructions?: string | null;
  order: number;
  marks: number;
};

type Question = {
  id: string;
  sectionId: string | null;
  type: string;
  prompt: string;
  options?: QuestionOption[];
  marks: number;
  difficulty: string;
  topic?: string | null;
  expectedAnswer?: string | null;
  markingGuide?: string | null;
  order: number;
};

type QuestionOption = {
  id?: string;
  label: string;
  text: string;
  isCorrect?: boolean;
};

type Detail = {
  paper: Paper;
  sections: Section[];
  questions: Question[];
};

type Props = {
  role: "admin" | "teacher";
  examPaperId: string;
};

function statusTone(status: string) {
  if (status === "approved") return "border-emerald-400/25 bg-emerald-400/10 text-emerald-100";
  if (status === "submitted") return "border-sky-400/25 bg-sky-400/10 text-sky-100";
  if (status === "needs_revision") return "border-amber-400/25 bg-amber-400/10 text-amber-100";
  if (status === "completed") return "border-violet-400/25 bg-violet-400/10 text-violet-100";
  return "border-white/10 bg-white/8 text-white/70";
}

function stripHtml(value: string) {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function htmlFromText(value: string) {
  return `<p>${escapeHtml(value)}</p>`;
}

function appendInlineHtml(html: string, value: string) {
  const insert = escapeHtml(value);
  if (!html.trim() || html === "<p></p>") return `<p>${insert}</p>`;
  if (/<\/p>\s*$/.test(html)) return html.replace(/<\/p>\s*$/, `${insert}</p>`);
  return `${html}<p>${insert}</p>`;
}

function fieldLabel(label: string) {
  return (
    <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/38">
      {label}
    </span>
  );
}

const premiumField =
  "border-white/10 bg-white/[0.045] text-white shadow-inner shadow-black/10 placeholder:text-white/32 focus-visible:border-cyan-300/40 focus-visible:ring-cyan-300/15";

const questionTypes = [
  "short_answer",
  "essay",
  "structured",
  "multiple_choice",
  "true_false",
  "practical",
  "oral",
] as const;

const mathScienceSymbols = [
  "+",
  "-",
  "×",
  "÷",
  "=",
  "≠",
  "≤",
  "≥",
  "±",
  "√",
  "²",
  "³",
  "π",
  "θ",
  "Δ",
  "λ",
  "μ",
  "Ω",
  "°",
  "°C",
  "½",
  "→",
  "←",
  "↑",
  "↓",
  "H₂O",
  "CO₂",
  "O₂",
  "Na⁺",
  "e⁻",
  "x/y",
];

function defaultMcqOptions(): QuestionOption[] {
  return ["A", "B", "C", "D"].map((label) => ({
    label,
    text: "",
    isCorrect: label === "A",
  }));
}

function readableType(type: string) {
  return type.replaceAll("_", " ");
}

const spellingVocabulary = [
  "answer",
  "calculate",
  "change",
  "choose",
  "circle",
  "correct",
  "describe",
  "difference",
  "divide",
  "explain",
  "find",
  "grammar",
  "identify",
  "length",
  "mass",
  "misspelled",
  "multiply",
  "number",
  "place",
  "please",
  "question",
  "receive",
  "science",
  "sentence",
  "subtract",
  "temperature",
  "there",
  "these",
  "value",
  "voltage",
  "weight",
  "which",
  "words",
];

function editDistance(a: string, b: string) {
  const dp = Array.from({ length: a.length + 1 }, () =>
    Array.from({ length: b.length + 1 }, () => 0)
  );
  for (let i = 0; i <= a.length; i += 1) dp[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) dp[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[a.length][b.length];
}

function preserveCase(source: string, replacement: string) {
  if (source.toUpperCase() === source) return replacement.toUpperCase();
  if (/^[A-Z]/.test(source)) {
    return replacement.replace(/^./, (char) => char.toUpperCase());
  }
  return replacement;
}

function closeSpellingSuggestions(value: string) {
  const seen = new Set<string>();
  const words = value.match(/\b[a-zA-Z]{3,}\b/g) ?? [];
  const suggestions: Array<{ word: string; replacement: string; distance: number }> = [];

  for (const word of words) {
    const lower = word.toLowerCase();
    if (seen.has(lower) || spellingVocabulary.includes(lower)) continue;
    seen.add(lower);
    const best = spellingVocabulary
      .map((candidate) => ({ candidate, distance: editDistance(lower, candidate) }))
      .filter(({ candidate, distance }) => {
        const threshold = lower.length <= 5 ? 2 : 3;
        return distance > 0 && distance <= threshold && candidate[0] === lower[0];
      })
      .sort((a, b) => a.distance - b.distance || a.candidate.length - b.candidate.length)[0];

    if (best) {
      suggestions.push({
        word,
        replacement: preserveCase(word, best.candidate),
        distance: best.distance,
      });
    }
  }

  return suggestions.slice(0, 3);
}

function writingSuggestions(value: string) {
  const suggestions: Array<{ id: string; label: string; apply: (text: string) => string }> = [];
  const replacements: Array<[RegExp, string, string]> = [
    [/\bpelase\b/gi, "please", "Correct spelling: “pelase” → “please”"],
    [/\bmisspeled\b/gi, "misspelled", "Correct spelling: “misspeled” → “misspelled”"],
    [/\bia\b/gi, "is", "Correct spelling: “ia” → “is”"],
    [/\bworks\b/gi, "words", "Use “words”"],
    [/\bpalce\b/gi, "place", "Correct spelling: “palce” → “place”"],
    [/\bteh\b/gi, "the", "Replace “teh” with “the”"],
    [/\brecieve\b/gi, "receive", "Replace “recieve” with “receive”"],
    [/\bsubstract\b/gi, "subtract", "Replace “substract” with “subtract”"],
    [/\banswe\b/gi, "answer", "Replace “answe” with “answer”"],
    [/\bwich\b/gi, "which", "Correct spelling: “wich” → “which”"],
    [/\bnumbr\b/gi, "number", "Correct spelling: “numbr” → “number”"],
    [/\bqustion\b/gi, "question", "Correct spelling: “qustion” → “question”"],
    [/\bcalcualte\b/gi, "calculate", "Correct spelling: “calcualte” → “calculate”"],
    [/\bgrammer\b/gi, "grammar", "Correct spelling: “grammer” → “grammar”"],
    [/\bsentance\b/gi, "sentence", "Correct spelling: “sentance” → “sentence”"],
    [/\bvolatge\b/gi, "voltage", "Correct spelling: “volatge” → “voltage”"],
    [/\btemperatue\b/gi, "temperature", "Correct spelling: “temperatue” → “temperature”"],
    [/\bweigth\b/gi, "weight", "Correct spelling: “weigth” → “weight”"],
  ];
  for (const [pattern, replacement, label] of replacements) {
    if (pattern.test(value)) {
      suggestions.push({
        id: label,
        label,
        apply: (text) => text.replace(pattern, replacement),
      });
    }
  }
  for (const suggestion of closeSpellingSuggestions(value)) {
    suggestions.push({
      id: `spell-${suggestion.word}-${suggestion.replacement}`,
      label: `Did you mean “${suggestion.replacement}”?`,
      apply: (text) =>
        text.replace(
          new RegExp(`\\b${suggestion.word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g"),
          suggestion.replacement
        ),
    });
  }
  const trimmed = value.trim();
  if (/\s{2,}/.test(value)) {
    suggestions.push({
      id: "spaces",
      label: "Remove double spaces",
      apply: (text) => text.replace(/\s{2,}/g, " "),
    });
  }
  if (/^(what|why|how|when|where|which|who)\b/i.test(value.trim()) && !/[?]$/.test(value.trim())) {
    suggestions.push({
      id: "question-mark",
      label: "Add question mark",
      apply: (text) => `${text.trim()}?`,
    });
  }
  if (
    trimmed.length > 12 &&
    !/[?.!]$/.test(trimmed) &&
    !/^(what|why|how|when|where|which|who)\b/i.test(trimmed)
  ) {
    suggestions.push({
      id: "ending-punctuation",
      label: "Add ending punctuation",
      apply: (text) => `${text.trim()}.`,
    });
  }
  if (/\ba\s+[aeiou]\w*/i.test(value)) {
    suggestions.push({
      id: "a-an",
      label: "Use “an” before vowel sounds",
      apply: (text) => text.replace(/\ba\s+([aeiou]\w*)/gi, "an $1"),
    });
  }
  if (/\ban\s+[bcdfghjklmnpqrstvwxyz]\w*/i.test(value)) {
    suggestions.push({
      id: "an-a",
      label: "Use “a” before consonant sounds",
      apply: (text) => text.replace(/\ban\s+([bcdfghjklmnpqrstvwxyz]\w*)/gi, "a $1"),
    });
  }
  if (/\bhow much\s+(pupils|students|learners|objects|items|books|apples|oranges|questions)\b/i.test(value)) {
    suggestions.push({
      id: "how-many",
      label: "Use “how many” for countable nouns",
      apply: (text) =>
        text.replace(
          /\bhow much\s+(pupils|students|learners|objects|items|books|apples|oranges|questions)\b/gi,
          "how many $1"
        ),
    });
  }
  if (/\bthere is\s+(two|three|four|five|six|seven|eight|nine|ten|many|several)\b/i.test(value)) {
    suggestions.push({
      id: "there-are",
      label: "Use “there are” for plurals",
      apply: (text) =>
        text.replace(
          /\bthere is\s+(two|three|four|five|six|seven|eight|nine|ten|many|several)\b/gi,
          "there are $1"
        ),
    });
  }
  if (/\bthese\s+is\b/i.test(value)) {
    suggestions.push({
      id: "these-are",
      label: "Use “these are”",
      apply: (text) => text.replace(/\bthese\s+is\b/gi, "these are"),
    });
  }
  if (/^[a-z]/.test(trimmed)) {
    suggestions.push({
      id: "capitalise",
      label: "Start with capital letter",
      apply: (text) => text.trim().replace(/^./, (char) => char.toUpperCase()),
    });
  }
  return suggestions.slice(0, 4);
}

function WritingSuggestionPanel({
  suggestions,
  onApply,
}: {
  suggestions: ReturnType<typeof writingSuggestions>;
  onApply: (suggestion: ReturnType<typeof writingSuggestions>[number]) => void;
}) {
  if (suggestions.length === 0) return null;
  return (
    <div className="mt-2 rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.06] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-100/75">
          <Sparkles className="h-3.5 w-3.5" />
          Writing suggestions
        </div>
        <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2 py-0.5 text-[11px] font-medium text-emerald-50/80">
          {suggestions.length}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion.id}
            type="button"
            onClick={() => onApply(suggestion)}
            className="rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1.5 text-xs font-medium text-emerald-50 transition hover:border-emerald-200/40 hover:bg-emerald-300/18"
          >
            {suggestion.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ExamPaperDetailPage({ role, examPaperId }: Props) {
  const queryClient = useQueryClient();
  const { confirm, confirmationDialog } = useConfirmationDialog();
  const basePath = role === "admin" ? "/admin" : "/teacher";
  const endpoint = `${role === "admin" ? "/api/admin" : "/api/teacher"}/examinations/${examPaperId}`;
  const [sectionTitle, setSectionTitle] = React.useState("");
  const [sectionInstructions, setSectionInstructions] = React.useState("");
  const [questionSectionId, setQuestionSectionId] = React.useState("");
  const [questionType, setQuestionType] = React.useState("short_answer");
  const [questionPrompt, setQuestionPrompt] = React.useState("");
  const [questionMarks, setQuestionMarks] = React.useState("1");
  const [questionDifficulty, setQuestionDifficulty] = React.useState("medium");
  const [questionOptions, setQuestionOptions] = React.useState<QuestionOption[]>(() =>
    defaultMcqOptions()
  );
  const [expectedAnswer, setExpectedAnswer] = React.useState("");
  const [markingGuide, setMarkingGuide] = React.useState("");
  const [builderError, setBuilderError] = React.useState<string | null>(null);
  const [builderMode, setBuilderMode] = React.useState<"section" | "question">("question");
  const [editingSectionId, setEditingSectionId] = React.useState<string | null>(null);
  const [editingQuestionId, setEditingQuestionId] = React.useState<string | null>(null);

  const detailQuery = useQuery({
    queryKey: ["exam-paper-detail", role, examPaperId],
    queryFn: async () => {
      const res = await fetch(endpoint, { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as { success?: boolean; data?: Detail; error?: string } | null;
      if (!res.ok || !json?.success || !json.data) throw new Error(json?.error ?? "Failed to fetch exam paper");
      return json.data;
    },
    staleTime: 15_000,
  });

  const lifecycleMutation = useMutation({
    mutationFn: async (action: "submit" | "approve" | "complete") => {
      const res = await fetch(`${endpoint}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: action === "approve" ? JSON.stringify({ comment: "Approved from examination desk." }) : undefined,
      });
      const json = (await res.json().catch(() => null)) as { success?: boolean; error?: string } | null;
      if (!res.ok || !json?.success) throw new Error(json?.error ?? `Failed to ${action} paper`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["exam-paper-detail", role, examPaperId] });
      void queryClient.invalidateQueries({ queryKey: ["examination-papers", role] });
    },
  });

  const createSectionMutation = useMutation({
    mutationFn: async () => {
      setBuilderError(null);
      const title = sectionTitle.trim();
      if (!title) throw new Error("Enter a section title.");
      const res = await fetch(`${endpoint}/sections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          instructions: sectionInstructions.trim() || null,
          marks: 0,
        }),
      });
      const json = (await res.json().catch(() => null)) as { success?: boolean; error?: string } | null;
      if (!res.ok || !json?.success) throw new Error(json?.error ?? "Failed to create section");
    },
    onSuccess: () => {
      setSectionTitle("");
      setSectionInstructions("");
      void queryClient.invalidateQueries({ queryKey: ["exam-paper-detail", role, examPaperId] });
    },
    onError: (err) => setBuilderError(err instanceof Error ? err.message : "Failed to create section"),
  });

  const updateSectionMutation = useMutation({
    mutationFn: async () => {
      setBuilderError(null);
      if (!editingSectionId) throw new Error("Choose a section to update.");
      const title = sectionTitle.trim();
      if (!title) throw new Error("Enter a section title.");
      const res = await fetch(
        `${role === "admin" ? "/api/admin" : "/api/teacher"}/examination-sections/${editingSectionId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            instructions: sectionInstructions.trim() || null,
          }),
        }
      );
      const json = (await res.json().catch(() => null)) as { success?: boolean; error?: string } | null;
      if (!res.ok || !json?.success) throw new Error(json?.error ?? "Failed to update section");
    },
    onSuccess: () => {
      clearSectionEditor();
      void queryClient.invalidateQueries({ queryKey: ["exam-paper-detail", role, examPaperId] });
    },
    onError: (err) => setBuilderError(err instanceof Error ? err.message : "Failed to update section"),
  });

  const createQuestionMutation = useMutation({
    mutationFn: async () => {
      setBuilderError(null);
      const prompt = questionPrompt.trim();
      const plainPrompt = extractPlainText(prompt).trim();
      if (!plainPrompt) throw new Error("Enter the question.");
      const options =
        questionType === "multiple_choice"
          ? questionOptions
              .filter((option) => option.text.trim())
              .map((option) => ({
                label: option.label.trim(),
                text: option.text.trim(),
                isCorrect: Boolean(option.isCorrect),
              }))
          : [];
      if (questionType === "multiple_choice" && options.length < 2) {
        throw new Error("Add at least two answer choices.");
      }
      if (questionType === "multiple_choice" && !options.some((option) => option.isCorrect)) {
        throw new Error("Select the correct answer choice.");
      }
      const res = await fetch(`${endpoint}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sectionId: questionSectionId || null,
          type: questionType,
          prompt,
          plainTextPrompt: plainPrompt,
          marks: Number(questionMarks) || 1,
          difficulty: questionDifficulty,
          options,
          subQuestions: [],
          curriculumNodeIds: [],
          schemeItemIds: [],
          lessonIds: [],
          lessonNoteIds: [],
          attachments: [],
          expectedAnswer:
            questionType === "multiple_choice"
              ? options.find((option) => option.isCorrect)?.text ?? null
              : expectedAnswer.trim() || null,
          markingGuide: markingGuide.trim() || null,
          source: "manual",
        }),
      });
      const json = (await res.json().catch(() => null)) as { success?: boolean; error?: string } | null;
      if (!res.ok || !json?.success) throw new Error(json?.error ?? "Failed to create question");
    },
    onSuccess: () => {
      clearQuestionEditor();
      void queryClient.invalidateQueries({ queryKey: ["exam-paper-detail", role, examPaperId] });
      void queryClient.invalidateQueries({ queryKey: ["examination-papers", role] });
    },
    onError: (err) => setBuilderError(err instanceof Error ? err.message : "Failed to create question"),
  });

  const updateQuestionMutation = useMutation({
    mutationFn: async () => {
      setBuilderError(null);
      if (!editingQuestionId) throw new Error("Choose a question to update.");
      const prompt = questionPrompt.trim();
      const plainPrompt = extractPlainText(prompt).trim();
      if (!plainPrompt) throw new Error("Enter the question.");
      const options =
        questionType === "multiple_choice"
          ? questionOptions
              .filter((option) => option.text.trim())
              .map((option) => ({
                id: option.id,
                label: option.label.trim(),
                text: option.text.trim(),
                isCorrect: Boolean(option.isCorrect),
              }))
          : [];
      if (questionType === "multiple_choice" && options.length < 2) {
        throw new Error("Add at least two answer choices.");
      }
      if (questionType === "multiple_choice" && !options.some((option) => option.isCorrect)) {
        throw new Error("Select the correct answer choice.");
      }
      const res = await fetch(
        `${role === "admin" ? "/api/admin" : "/api/teacher"}/examination-questions/${editingQuestionId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sectionId: questionSectionId || null,
            type: questionType,
            prompt,
            plainTextPrompt: plainPrompt,
            marks: Number(questionMarks) || 1,
            difficulty: questionDifficulty,
            options,
            expectedAnswer:
              questionType === "multiple_choice"
                ? options.find((option) => option.isCorrect)?.text ?? null
                : expectedAnswer.trim() || null,
            markingGuide: markingGuide.trim() || null,
          }),
        }
      );
      const json = (await res.json().catch(() => null)) as { success?: boolean; error?: string } | null;
      if (!res.ok || !json?.success) throw new Error(json?.error ?? "Failed to update question");
    },
    onSuccess: () => {
      clearQuestionEditor();
      void queryClient.invalidateQueries({ queryKey: ["exam-paper-detail", role, examPaperId] });
      void queryClient.invalidateQueries({ queryKey: ["examination-papers", role] });
    },
    onError: (err) => setBuilderError(err instanceof Error ? err.message : "Failed to update question"),
  });

  const deleteSectionMutation = useMutation({
    mutationFn: async (sectionId: string) => {
      const res = await fetch(
        `${role === "admin" ? "/api/admin" : "/api/teacher"}/examination-sections/${sectionId}`,
        { method: "DELETE" }
      );
      const json = (await res.json().catch(() => null)) as { success?: boolean; error?: string } | null;
      if (!res.ok || !json?.success) throw new Error(json?.error ?? "Failed to delete section");
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["exam-paper-detail", role, examPaperId] });
    },
    onError: (err) => setBuilderError(err instanceof Error ? err.message : "Failed to delete section"),
  });

  const deleteQuestionMutation = useMutation({
    mutationFn: async (questionId: string) => {
      const res = await fetch(
        `${role === "admin" ? "/api/admin" : "/api/teacher"}/examination-questions/${questionId}`,
        { method: "DELETE" }
      );
      const json = (await res.json().catch(() => null)) as { success?: boolean; error?: string } | null;
      if (!res.ok || !json?.success) throw new Error(json?.error ?? "Failed to delete question");
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["exam-paper-detail", role, examPaperId] });
      void queryClient.invalidateQueries({ queryKey: ["examination-papers", role] });
    },
    onError: (err) => setBuilderError(err instanceof Error ? err.message : "Failed to delete question"),
  });

  const detail = detailQuery.data;
  const questionsBySection = React.useMemo(() => {
    const map = new Map<string, Question[]>();
    for (const question of detail?.questions ?? []) {
      const key = question.sectionId ?? "unsectioned";
      map.set(key, [...(map.get(key) ?? []), question]);
    }
    return map;
  }, [detail?.questions]);

  React.useEffect(() => {
    if (!detail?.sections.length) return;
    if (!questionSectionId || !detail.sections.some((section) => section.id === questionSectionId)) {
      setQuestionSectionId(detail.sections[0].id);
    }
  }, [detail?.sections, questionSectionId]);

  const exportPdf = () => {
    window.open(`${endpoint}/export/pdf`, "_blank", "noopener,noreferrer");
  };

  function clearSectionEditor() {
    setEditingSectionId(null);
    setSectionTitle("");
    setSectionInstructions("");
  }

  function clearQuestionEditor() {
    setEditingQuestionId(null);
    setQuestionPrompt("");
    setQuestionMarks("1");
    setQuestionDifficulty("medium");
    setQuestionType("short_answer");
    setQuestionOptions(defaultMcqOptions());
    setExpectedAnswer("");
    setMarkingGuide("");
  }

  function startEditSection(section: Section) {
    setBuilderMode("section");
    setEditingSectionId(section.id);
    setSectionTitle(section.title);
    setSectionInstructions(section.instructions ?? "");
    setBuilderError(null);
  }

  function startEditQuestion(question: Question) {
    setBuilderMode("question");
    setEditingQuestionId(question.id);
    setQuestionSectionId(question.sectionId ?? detail?.sections[0]?.id ?? "");
    setQuestionType(question.type);
    setQuestionPrompt(question.prompt);
    setQuestionMarks(String(question.marks || 1));
    setQuestionDifficulty(question.difficulty || "medium");
    setQuestionOptions(question.options?.length ? question.options : defaultMcqOptions());
    setExpectedAnswer(question.expectedAnswer ?? "");
    setMarkingGuide(question.markingGuide ?? "");
    setBuilderError(null);
  }

  function insertMathSymbol(symbol: string) {
    const insert = symbol === "x/y" ? "( )/( )" : symbol;
    setQuestionPrompt((prev) => appendInlineHtml(prev, insert));
  }

  async function requestDeleteSection(section: Section) {
    const decision = await confirm({
      title: "Delete section?",
      description:
        "Questions in this section will be moved out of the section. The questions will not be deleted.",
      confirmLabel: "Delete section",
      cancelLabel: "Keep section",
      intent: "destructive",
    });
    if (decision === "confirm") {
      deleteSectionMutation.mutate(section.id);
    }
  }

  async function requestDeleteQuestion(question: Question) {
    const decision = await confirm({
      title: "Delete question?",
      description:
        "This removes the question from the paper and recalculates the total marks.",
      confirmLabel: "Delete question",
      cancelLabel: "Keep question",
      intent: "destructive",
    });
    if (decision === "confirm") {
      deleteQuestionMutation.mutate(question.id);
    }
  }

  if (detailQuery.isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-white/60">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading exam paper
      </div>
    );
  }

  if (detailQuery.isError || !detail) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <Card className="border-white/10 bg-white/[0.03] text-white">
          <CardContent className="p-6">
            <p className="font-medium">Exam paper could not be opened.</p>
            <p className="mt-2 text-sm text-white/55">
              {detailQuery.error instanceof Error ? detailQuery.error.message : "Try again later."}
            </p>
            <Link href={`${basePath}/examinations`}>
              <Button className="mt-4">Back to examinations</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const canSubmit = ["draft", "needs_revision"].includes(detail.paper.status);
  const canApprove = role === "admin" && detail.paper.status === "submitted";
  const canComplete = role === "admin" && detail.paper.status === "approved";
  const canEditBuilder = ["draft", "needs_revision"].includes(detail.paper.status);
  const promptSuggestions = writingSuggestions(extractPlainText(questionPrompt));
  const expectedAnswerSuggestions = writingSuggestions(extractPlainText(expectedAnswer));
  const markingGuideSuggestions = writingSuggestions(extractPlainText(markingGuide));

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-5 p-4 md:p-6">
      <Link
        href={`${basePath}/examinations`}
        className="inline-flex w-fit items-center gap-2 text-sm font-medium text-white/55 hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Examinations
      </Link>

      <section className="rounded-3xl border border-white/10 bg-linear-to-br from-slate-950 via-slate-900 to-black p-5 shadow-2xl shadow-black/35 sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge className={cn("border", statusTone(detail.paper.status))}>
                {detail.paper.status.replace("_", " ")}
              </Badge>
              <Badge variant="outline" className="border-white/10 text-white/58">
                {detail.paper.scope === "grade_wide" ? "Grade-wide paper" : "Class paper"}
              </Badge>
            </div>
            <h1 className="max-w-4xl text-3xl font-semibold tracking-tight text-white md:text-4xl">
              {detail.paper.title}
            </h1>
            <p className="mt-3 text-sm text-white/55">
              {detail.paper.totalMarks} marks
              {detail.paper.durationMinutes ? ` · ${detail.paper.durationMinutes} minutes` : ""} · Question-only student PDF
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={exportPdf} variant="outline" className="gap-2 border-white/12 bg-white/5 text-white hover:bg-white/10">
              <Printer className="h-4 w-4" />
              Print PDF
            </Button>
            {canSubmit ? (
              <Button
                onClick={() => lifecycleMutation.mutate("submit")}
                disabled={lifecycleMutation.isPending}
                className="gap-2 bg-cyan-400 text-slate-950 hover:bg-cyan-300"
              >
                <Send className="h-4 w-4" />
                Submit
              </Button>
            ) : null}
            {canApprove ? (
              <Button
                onClick={() => lifecycleMutation.mutate("approve")}
                disabled={lifecycleMutation.isPending}
                className="gap-2 bg-emerald-400 text-slate-950 hover:bg-emerald-300"
              >
                <BadgeCheck className="h-4 w-4" />
                Approve
              </Button>
            ) : null}
            {canComplete ? (
              <Button
                onClick={() => lifecycleMutation.mutate("complete")}
                disabled={lifecycleMutation.isPending}
                className="gap-2 bg-violet-400 text-slate-950 hover:bg-violet-300"
              >
                <ClipboardCheck className="h-4 w-4" />
                Complete
              </Button>
            ) : null}
          </div>
        </div>
        {lifecycleMutation.isError ? (
          <p className="mt-4 rounded-2xl border border-red-300/20 bg-red-400/10 px-4 py-3 text-sm text-red-100">
            {lifecycleMutation.error instanceof Error ? lifecycleMutation.error.message : "Action failed."}
          </p>
        ) : null}
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-white/10 bg-white/[0.03] text-white md:col-span-2">
          <CardHeader>
            <CardTitle>Paper Structure</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {detail.sections.map((section) => {
              const sectionQuestions = questionsBySection.get(section.id) ?? [];
              return (
                <div key={section.id} className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h2 className="font-semibold text-white">{section.title}</h2>
                      {section.instructions ? (
                        <p className="mt-1 text-sm text-white/48">{section.instructions}</p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="border-white/10 text-white/55">
                        {section.marks} marks
                      </Badge>
                      {canEditBuilder ? (
                        <PremiumDropdownMenu>
                          <PremiumDropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/55 transition hover:bg-white/10 hover:text-white"
                              aria-label={`Actions for ${section.title}`}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                          </PremiumDropdownMenuTrigger>
                          <PremiumDropdownMenuContent align="end">
                            <PremiumDropdownMenuItem
                              icon={<Edit3 className="h-4 w-4" />}
                              onClick={() => startEditSection(section)}
                            >
                              Edit section
                            </PremiumDropdownMenuItem>
                            <PremiumDropdownMenuItem
                              variant="destructive"
                              icon={<Trash2 className="h-4 w-4" />}
                              onClick={() => void requestDeleteSection(section)}
                            >
                              Delete section
                            </PremiumDropdownMenuItem>
                          </PremiumDropdownMenuContent>
                        </PremiumDropdownMenu>
                      ) : null}
                    </div>
                  </div>
                  <Separator className="my-4 bg-white/10" />
                  <div className="space-y-3">
                    {sectionQuestions.map((question, index) => (
                      <div key={question.id} className="flex gap-3 rounded-xl border border-white/8 bg-black/10 p-3">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/8 text-xs font-semibold text-white/70">
                          {index + 1}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className="border-white/10 text-white/50">{readableType(question.type)}</Badge>
                            <span className="text-xs text-white/40">{question.marks} marks · {question.difficulty}</span>
                            </div>
                            {canEditBuilder ? (
                              <PremiumDropdownMenu>
                                <PremiumDropdownMenuTrigger asChild>
                                  <button
                                    type="button"
                                    className="flex h-8 w-8 items-center justify-center rounded-lg text-white/45 transition hover:bg-white/10 hover:text-white"
                                    aria-label="Question actions"
                                  >
                                    <MoreHorizontal className="h-4 w-4" />
                                  </button>
                                </PremiumDropdownMenuTrigger>
                                <PremiumDropdownMenuContent align="end">
                                  <PremiumDropdownMenuItem
                                    icon={<Edit3 className="h-4 w-4" />}
                                    onClick={() => startEditQuestion(question)}
                                  >
                                    Edit question
                                  </PremiumDropdownMenuItem>
                                  <PremiumDropdownMenuItem
                                    variant="destructive"
                                    icon={<Trash2 className="h-4 w-4" />}
                                    onClick={() => void requestDeleteQuestion(question)}
                                  >
                                    Delete question
                                  </PremiumDropdownMenuItem>
                                </PremiumDropdownMenuContent>
                              </PremiumDropdownMenu>
                            ) : null}
                          </div>
                          <p className="text-sm leading-6 text-white/72">{stripHtml(question.prompt)}</p>
                          {question.options?.length ? (
                            <div className="mt-3 grid gap-2 sm:grid-cols-2">
                              {question.options.map((option) => (
                                <div
                                  key={option.id ?? option.label}
                                  className={cn(
                                    "rounded-lg border px-3 py-2 text-xs",
                                    option.isCorrect
                                      ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-100"
                                      : "border-white/10 bg-white/[0.03] text-white/55"
                                  )}
                                >
                                  <span className="font-semibold">{option.label}.</span> {option.text}
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ))}
                    {sectionQuestions.length === 0 ? (
                      <p className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-white/45">
                        No questions have been added to this section yet.
                      </p>
                    ) : null}
                  </div>
                </div>
              );
            })}
            {detail.sections.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-white/10 p-6 text-sm text-white/50">
                No sections yet. The API builder is ready; the visual question builder will be added in the next slice.
              </p>
            ) : null}
          </CardContent>
        </Card>

        {canEditBuilder ? (
          <Card className="overflow-hidden border-white/10 bg-linear-to-br from-white/[0.07] via-white/[0.035] to-cyan-300/[0.035] text-white shadow-xl shadow-black/20 backdrop-blur">
            <CardHeader className="border-b border-white/10 pb-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ListPlus className="h-5 w-5 text-cyan-200" />
                    Paper Builder
                  </CardTitle>
                  <p className="mt-1 text-sm text-white/48">
                    Compose the paper in sections, then add questions to each section.
                  </p>
                </div>
                <Badge className="border border-cyan-300/20 bg-cyan-300/10 text-cyan-100">
                  Draft
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 p-4">
              <div className="grid grid-cols-2 rounded-2xl border border-white/10 bg-black/20 p-1">
                {[
                  { id: "section" as const, label: "Section", icon: Type },
                  { id: "question" as const, label: "Question", icon: FileQuestion },
                ].map((item) => {
                  const Icon = item.icon;
                  const active = builderMode === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setBuilderMode(item.id)}
                      className={cn(
                        "flex h-10 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition",
                        active
                          ? "bg-white/12 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
                          : "text-white/45 hover:bg-white/7 hover:text-white"
                      )}
                    >
                      <Icon className={cn("h-4 w-4", active && "text-cyan-200")} />
                      {item.label}
                    </button>
                  );
                })}
              </div>

              {builderMode === "section" ? (
                <form
                  className="space-y-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (editingSectionId) updateSectionMutation.mutate();
                    else createSectionMutation.mutate();
                  }}
                >
                  {editingSectionId ? (
                    <div className="flex items-center justify-between rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-3 py-2">
                      <span className="text-sm font-medium text-cyan-100">Editing section</span>
                      <button
                        type="button"
                        onClick={clearSectionEditor}
                        className="rounded-lg p-1 text-cyan-100/70 hover:bg-white/10 hover:text-white"
                        aria-label="Cancel section edit"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : null}
                  <label className="space-y-2">
                    {fieldLabel("Section title")}
                    <Input
                      value={sectionTitle}
                      onChange={(event) => setSectionTitle(event.target.value)}
                      placeholder="Section A"
                      className={premiumField}
                    />
                  </label>
                  <label className="space-y-2">
                    {fieldLabel("Instructions")}
                    <Textarea
                      value={sectionInstructions}
                      onChange={(event) => setSectionInstructions(event.target.value)}
                      placeholder="Optional section instructions"
                      className={cn("min-h-24 resize-none", premiumField)}
                    />
                  </label>
                  <Button
                    type="submit"
                    disabled={createSectionMutation.isPending || updateSectionMutation.isPending}
                    className="h-11 w-full gap-2 bg-white text-slate-950 hover:bg-cyan-100"
                  >
                    <Plus className="h-4 w-4" />
                    {editingSectionId
                      ? updateSectionMutation.isPending
                        ? "Saving section..."
                        : "Save section"
                      : createSectionMutation.isPending
                        ? "Adding section..."
                        : "Add section"}
                  </Button>
                </form>
              ) : (
                <form
                  className="space-y-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (editingQuestionId) updateQuestionMutation.mutate();
                    else createQuestionMutation.mutate();
                  }}
                >
                  {editingQuestionId ? (
                    <div className="flex items-center justify-between rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-3 py-2">
                      <span className="text-sm font-medium text-cyan-100">Editing question</span>
                      <button
                        type="button"
                        onClick={clearQuestionEditor}
                        className="rounded-lg p-1 text-cyan-100/70 hover:bg-white/10 hover:text-white"
                        aria-label="Cancel question edit"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : null}
                  <label className="space-y-2">
                    {fieldLabel("Target section")}
                    <PremiumSelect value={questionSectionId || undefined} onValueChange={setQuestionSectionId}>
                      <PremiumSelectTrigger className="w-full">
                        <PremiumSelectValue placeholder="Choose section" />
                      </PremiumSelectTrigger>
                      <PremiumSelectContent>
                        {detail.sections.map((section) => (
                          <PremiumSelectItem key={section.id} value={section.id}>{section.title}</PremiumSelectItem>
                        ))}
                      </PremiumSelectContent>
                    </PremiumSelect>
                  </label>

                  <div className="grid gap-3 sm:grid-cols-[1fr_1fr_84px]">
                    <label className="space-y-2">
                      {fieldLabel("Type")}
                      <PremiumSelect value={questionType} onValueChange={setQuestionType}>
                        <PremiumSelectTrigger className="w-full">
                          <PremiumSelectValue />
                        </PremiumSelectTrigger>
                        <PremiumSelectContent>
                          {questionTypes.map((type) => (
                            <PremiumSelectItem key={type} value={type}>{readableType(type)}</PremiumSelectItem>
                          ))}
                        </PremiumSelectContent>
                      </PremiumSelect>
                    </label>
                    <label className="space-y-2">
                      {fieldLabel("Level")}
                      <PremiumSelect value={questionDifficulty} onValueChange={setQuestionDifficulty}>
                        <PremiumSelectTrigger className="w-full">
                          <PremiumSelectValue />
                        </PremiumSelectTrigger>
                        <PremiumSelectContent>
                          {["easy", "medium", "hard", "mixed"].map((difficulty) => (
                            <PremiumSelectItem key={difficulty} value={difficulty}>{difficulty}</PremiumSelectItem>
                          ))}
                        </PremiumSelectContent>
                      </PremiumSelect>
                    </label>
                    <label className="space-y-2">
                      {fieldLabel("Marks")}
                      <div className="relative">
                        <Hash className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/28" />
                        <Input
                          value={questionMarks}
                          onChange={(event) => setQuestionMarks(event.target.value)}
                          inputMode="numeric"
                          className={cn("pl-8", premiumField)}
                        />
                      </div>
                    </label>
                  </div>

                  <div className="space-y-3">
                    {fieldLabel("Question")}
                    <div className="flex flex-wrap gap-1.5 rounded-xl border border-white/10 bg-black/15 p-2">
                      <span className="mr-1 inline-flex items-center gap-1 px-1 text-xs font-semibold text-white/35">
                        <Radical className="h-3.5 w-3.5" />
                        Math & science
                      </span>
                      {mathScienceSymbols.map((symbol) => (
                        <button
                          key={symbol}
                          type="button"
                          onClick={() => insertMathSymbol(symbol)}
                          className="min-w-8 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-xs font-semibold text-white/65 transition hover:border-cyan-300/30 hover:bg-cyan-300/10 hover:text-white"
                        >
                          {symbol}
                        </button>
                      ))}
                    </div>
                    <RichTextEditor
                      value={questionPrompt}
                      onChange={setQuestionPrompt}
                      placeholder="Write the question exactly as it should appear on the paper"
                      minHeight="150px"
                      maxHeight="340px"
                      toolbarVariant="minimal"
                      className="border-white/10 bg-white/[0.045] shadow-inner shadow-black/10 focus-within:border-cyan-300/40 focus-within:ring-cyan-300/15"
                      editorClassName="prose-p:text-white/85"
                    />
                  </div>

                  <WritingSuggestionPanel
                    suggestions={promptSuggestions}
                    onApply={(suggestion) =>
                      setQuestionPrompt((prev) =>
                        htmlFromText(suggestion.apply(extractPlainText(prev)))
                      )
                    }
                  />

                  {questionType === "multiple_choice" ? (
                    <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.025] p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-white">Answer choices</p>
                          <p className="text-xs text-white/42">Select the correct option for marking.</p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="border-white/10 bg-white/5 text-white hover:bg-white/10"
                          onClick={() =>
                            setQuestionOptions((prev) => [
                              ...prev,
                              {
                                label: String.fromCharCode(65 + prev.length),
                                text: "",
                                isCorrect: false,
                              },
                            ])
                          }
                        >
                          <Plus className="mr-1 h-3.5 w-3.5" />
                          Choice
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {questionOptions.map((option, index) => (
                          <div key={`${option.label}-${index}`} className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                setQuestionOptions((prev) =>
                                  prev.map((item, itemIndex) => ({
                                    ...item,
                                    isCorrect: itemIndex === index,
                                  }))
                                )
                              }
                              className={cn(
                                "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-sm font-bold transition",
                                option.isCorrect
                                  ? "border-emerald-300/35 bg-emerald-300/15 text-emerald-50"
                                  : "border-white/10 bg-white/[0.04] text-white/50 hover:bg-white/10"
                              )}
                              aria-label={`Mark option ${option.label} as correct`}
                            >
                              {option.label}
                            </button>
                            <Input
                              value={option.text}
                              onChange={(event) =>
                                setQuestionOptions((prev) =>
                                  prev.map((item, itemIndex) =>
                                    itemIndex === index ? { ...item, text: event.target.value } : item
                                  )
                                )
                              }
                              placeholder={`Choice ${option.label}`}
                              className={premiumField}
                            />
                            {questionOptions.length > 2 ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setQuestionOptions((prev) => {
                                    const next = prev.filter((_, itemIndex) => itemIndex !== index);
                                    if (!next.some((item) => item.isCorrect) && next[0]) {
                                      next[0] = { ...next[0], isCorrect: true };
                                    }
                                    return next.map((item, itemIndex) => ({
                                      ...item,
                                      label: String.fromCharCode(65 + itemIndex),
                                    }));
                                  })
                                }
                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white/35 transition hover:bg-red-400/10 hover:text-red-200"
                                aria-label={`Remove option ${option.label}`}
                              >
                                <X className="h-4 w-4" />
                              </button>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {fieldLabel("Expected answer")}
                      <CompactRichText
                        value={expectedAnswer}
                        onChange={setExpectedAnswer}
                        placeholder="Answer or key points used for marking"
                        className="border-white/10 bg-white/[0.045] shadow-inner shadow-black/10 focus-within:border-cyan-300/40 focus-within:ring-cyan-300/15"
                      />
                      <WritingSuggestionPanel
                        suggestions={expectedAnswerSuggestions}
                        onApply={(suggestion) =>
                          setExpectedAnswer((prev) =>
                            htmlFromText(suggestion.apply(extractPlainText(prev)))
                          )
                        }
                      />
                    </div>
                  )}

                  <div className="space-y-3">
                    {fieldLabel("Marking guide")}
                    <CompactRichText
                      value={markingGuide}
                      onChange={setMarkingGuide}
                      placeholder="Optional marking notes, point allocation, or rubric guidance"
                      className="border-white/10 bg-white/[0.045] shadow-inner shadow-black/10 focus-within:border-cyan-300/40 focus-within:ring-cyan-300/15"
                    />
                    <WritingSuggestionPanel
                      suggestions={markingGuideSuggestions}
                      onApply={(suggestion) =>
                        setMarkingGuide((prev) =>
                          htmlFromText(suggestion.apply(extractPlainText(prev)))
                        )
                      }
                    />
                  </div>

                  <div className="pt-2">
                    <Button
                      type="submit"
                      disabled={
                        createQuestionMutation.isPending ||
                        updateQuestionMutation.isPending ||
                        detail.sections.length === 0
                      }
                      className="h-11 w-full gap-2 bg-cyan-400 text-slate-950 hover:bg-cyan-300"
                    >
                      <Plus className="h-4 w-4" />
                      {editingQuestionId
                        ? updateQuestionMutation.isPending
                          ? "Saving question..."
                          : "Save question"
                        : createQuestionMutation.isPending
                          ? "Adding question..."
                          : "Add question"}
                    </Button>
                  </div>
                  {detail.sections.length === 0 ? (
                    <p className="rounded-xl border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-xs text-amber-100">
                      Add a section before adding questions.
                    </p>
                  ) : null}
                </form>
              )}

              {builderError ? (
                <p className="rounded-2xl border border-red-300/20 bg-red-400/10 px-4 py-3 text-sm text-red-100">
                  {builderError}
                </p>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        <Card className="border-cyan-300/15 bg-cyan-300/[0.04] text-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileQuestion className="h-5 w-5 text-cyan-200" />
              Paper Rules
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-white/62">
            <p>Student printouts include questions only. Answer spaces, answer keys, expected answers, and marking guides stay out of the PDF.</p>
            <p>Grade-wide papers can be led by one setter with contributors from the same grade and subject.</p>
            {detail.paper.candidateInstructions ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/35">Candidate instructions</p>
                <p className="mt-2">{detail.paper.candidateInstructions}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
      {confirmationDialog}
    </div>
  );
}
