"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  Sparkles,
  Wand2,
  Loader2,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  RefreshCw,
  Lightbulb,
  ClipboardList,
  Target,
  Maximize2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/useToast";
import {
  useAIGenerate,
  type AIGenerateRequest,
  type AIGenerateResponse,
  type NaCCA3PhaseGenerated,
  type ClassicJHSGenerated,
  type SimpleGenerated,
  type AIFieldBlueprint,
} from "@/hooks/teacher/useTeacherAIGenerate";
import type { LessonNoteTemplateType } from "@/types/lesson-notes";

export type LessonNoteAIContext = {
  templateType: LessonNoteTemplateType;
  topic: string;
  subject?: string;
  gradeLevel?: string;
  duration?: number;
  strand?: string;
  subStrand?: string;
  contentStandard?: string;
  indicators?: string[];
  contextSummary?: string;
};

type ScopedSectionAction =
  | "refine_context"
  | "suggest_field_values"
  | "suggest_resources"
  | "generate_body"
  | "generate_assessment_section";

type AISectionAssistantProps = {
  context: LessonNoteAIContext;
  action: ScopedSectionAction;
  section: string;
  title?: string;
  description?: string;
  buttonLabel?: string;
  existingContent?: string;
  fieldBlueprint?: AIFieldBlueprint[];
  promptPlaceholder?: string;
  disabled?: boolean;
  className?: string;
  onGenerated: (data: AIGenerateResponse) => void;
};

export function AISectionAssistant({
  context,
  action,
  section,
  title = "AI Support",
  description = "Ask for focused help on this section only.",
  buttonLabel = "Generate Suggestions",
  existingContent,
  fieldBlueprint,
  promptPlaceholder = "What do you want help with on this section?",
  disabled,
  className,
  onGenerated,
}: AISectionAssistantProps) {
  const toast = useToast();
  const aiMutation = useAIGenerate();
  const [teacherIntent, setTeacherIntent] = React.useState("");

  const handleGenerate = async () => {
    if (!context.topic.trim()) {
      toast.warning("Topic Required", {
        description: "Add at least a rough topic before asking AI for help.",
      });
      return;
    }

    try {
      const result = await aiMutation.mutateAsync({
        action,
        templateType: context.templateType,
        topic: context.topic,
        subject: context.subject,
        gradeLevel: context.gradeLevel,
        duration: context.duration,
        strand: context.strand,
        subStrand: context.subStrand,
        contentStandard: context.contentStandard,
        indicators: context.indicators,
        section,
        existingContent,
        teacherIntent: teacherIntent.trim() || undefined,
        contextSummary: context.contextSummary,
        fieldBlueprint,
      });

      if (!result.data) {
        return;
      }

      onGenerated(result.data);
      setTeacherIntent("");
      toast.success("AI Suggestions Applied", {
        description: `Updated ${section.toLowerCase()} only. Review and adjust as needed.`,
      });
    } catch (error) {
      toast.error("Generation Failed", {
        description: error instanceof Error ? error.message : "Failed to generate suggestions",
      });
    }
  };

  return (
    <div
      className={cn(
        "rounded-2xl border border-violet-500/20 bg-violet-500/5 p-4 space-y-3",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-violet-100">
            <Sparkles className="h-4 w-4 text-violet-300" />
            <h3 className="text-sm font-semibold">{title}</h3>
          </div>
          <p className="text-xs text-white/60">{description}</p>
        </div>
        <div className="rounded-full border border-violet-400/20 bg-violet-500/10 px-2.5 py-1 text-[11px] font-medium text-violet-200">
          {section}
        </div>
      </div>

      <Textarea
        value={teacherIntent}
        onChange={(event) => setTeacherIntent(event.target.value)}
        placeholder={promptPlaceholder}
        className="min-h-24 border-violet-400/20 bg-black/20 text-white placeholder:text-white/35 focus-visible:border-violet-400/40 focus-visible:ring-violet-400/20"
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1 text-xs text-white/45">
          <p>AI reads earlier completed tabs for context and only writes to this section.</p>
          {!context.topic.trim() && <p>Add a topic first so the suggestions stay on target.</p>}
        </div>
        <Button
          type="button"
          onClick={handleGenerate}
          disabled={disabled || aiMutation.isPending}
          className="bg-violet-500/20 text-violet-100 hover:bg-violet-500/30"
        >
          {aiMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="mr-2 h-4 w-4" />
          )}
          {buttonLabel}
        </Button>
      </div>
    </div>
  );
}

type AIQuickActionsProps = {
  context: LessonNoteAIContext;
  section?: string;
  existingContent?: string;
  onContentGenerated?: (content: string) => void;
  onActivitiesSuggested?: (activities: unknown[]) => void;
  onAssessmentGenerated?: (assessment: unknown) => void;
  onObjectivesGenerated?: (objectives: { general: string; specific: string[] }) => void;
  disabled?: boolean;
  className?: string;
};

export function AIQuickActions({
  context,
  section,
  existingContent,
  onContentGenerated,
  onActivitiesSuggested,
  onAssessmentGenerated,
  onObjectivesGenerated,
  disabled,
  className,
}: AIQuickActionsProps) {
  const toast = useToast();
  const aiMutation = useAIGenerate();

  const handleAction = async (action: AIGenerateRequest["action"]) => {
    if (!context.topic) {
      toast.warning("Topic Required");
      return;
    }

    try {
      const result = await aiMutation.mutateAsync({
        action,
        templateType: context.templateType,
        topic: context.topic,
        subject: context.subject,
        gradeLevel: context.gradeLevel,
        section,
        existingContent,
        strand: context.strand,
        subStrand: context.subStrand,
        contentStandard: context.contentStandard,
        indicators: context.indicators,
        contextSummary: context.contextSummary,
      });

      if (!result.data) return;

      switch (action) {
        case "expand_section":
          if ("expandedContent" in result.data) {
            onContentGenerated?.(result.data.expandedContent);
          }
          break;
        case "suggest_activities":
          if ("activities" in result.data) {
            onActivitiesSuggested?.(result.data.activities);
          }
          break;
        case "generate_assessment":
          onAssessmentGenerated?.(result.data);
          break;
        case "generate_objectives":
          if ("generalObjective" in result.data && "specificObjectives" in result.data) {
            onObjectivesGenerated?.({
              general: result.data.generalObjective,
              specific: result.data.specificObjectives,
            });
          }
          break;
        case "improve_content":
          if ("improvedContent" in result.data) {
            onContentGenerated?.(result.data.improvedContent);
          }
          break;
      }

      toast.success("AI Generated", {
        description: "Content generated successfully.",
      });
    } catch (error) {
      toast.error("Generation Failed", {
        description: error instanceof Error ? error.message : "Failed",
      });
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled || aiMutation.isPending || !context.topic}
          className={cn(
            "h-7 px-2 text-xs text-violet-300/80 hover:text-violet-200 hover:bg-violet-500/10",
            className
          )}
        >
          {aiMutation.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <>
              <Sparkles className="mr-1 h-3.5 w-3.5" />
              AI Assist
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-48 bg-[#1a1d24] border-white/10"
      >
        {existingContent && (
          <>
            <DropdownMenuItem
              onClick={() => handleAction("expand_section")}
              className="text-white/80 focus:bg-white/10 focus:text-white"
            >
              <Maximize2 className="mr-2 h-4 w-4 text-violet-400" />
              Expand Content
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleAction("improve_content")}
              className="text-white/80 focus:bg-white/10 focus:text-white"
            >
              <RefreshCw className="mr-2 h-4 w-4 text-violet-400" />
              Improve Content
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-white/10" />
          </>
        )}
        <DropdownMenuItem
          onClick={() => handleAction("suggest_activities")}
          className="text-white/80 focus:bg-white/10 focus:text-white"
        >
          <Lightbulb className="mr-2 h-4 w-4 text-amber-400" />
          Suggest Activities
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleAction("generate_assessment")}
          className="text-white/80 focus:bg-white/10 focus:text-white"
        >
          <ClipboardList className="mr-2 h-4 w-4 text-emerald-400" />
          Generate Assessment
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleAction("generate_objectives")}
          className="text-white/80 focus:bg-white/10 focus:text-white"
        >
          <Target className="mr-2 h-4 w-4 text-blue-400" />
          Generate Objectives
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

type AIExpandButtonProps = {
  context: LessonNoteAIContext;
  section: string;
  existingContent: string;
  onExpanded: (content: string) => void;
  disabled?: boolean;
  className?: string;
};

export function AIExpandButton({
  context,
  section,
  existingContent,
  onExpanded,
  disabled,
  className,
}: AIExpandButtonProps) {
  const toast = useToast();
  const aiMutation = useAIGenerate();

  const handleExpand = async () => {
    try {
      const result = await aiMutation.mutateAsync({
        action: "expand_section",
        templateType: context.templateType,
        topic: context.topic,
        section,
        existingContent,
        subject: context.subject,
        gradeLevel: context.gradeLevel,
        contextSummary: context.contextSummary,
      });

      if (result.data && "expandedContent" in result.data) {
        onExpanded(result.data.expandedContent);
        toast.success("Content Expanded");
      }
    } catch (error) {
      toast.error("Expansion Failed", {
        description: error instanceof Error ? error.message : "Failed",
      });
    }
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={handleExpand}
      disabled={disabled || aiMutation.isPending || !existingContent}
      className={cn(
        "h-6 px-2 text-xs text-violet-300/60 hover:text-violet-200 hover:bg-violet-500/10",
        className
      )}
    >
      {aiMutation.isPending ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <>
          <Wand2 className="mr-1 h-3 w-3" />
          Expand
        </>
      )}
    </Button>
  );
}

type AIGeneratedPreviewProps = {
  content: string;
  onApply: () => void;
  onRegenerate?: () => void;
  isRegenerating?: boolean;
  className?: string;
};

export function AIGeneratedPreview({
  content,
  onApply,
  onRegenerate,
  isRegenerating,
  className,
}: AIGeneratedPreviewProps) {
  const [copied, setCopied] = React.useState(false);
  const [expanded, setExpanded] = React.useState(false);

  const handleCopy = async () => {
    try {
      const plainText = content.replace(/<[^>]*>/g, "");
      await navigator.clipboard.writeText(plainText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard failures.
    }
  };

  const preview = expanded
    ? content
    : content.length > 200
      ? `${content.slice(0, 200)}...`
      : content;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "rounded-lg border border-violet-500/30 bg-violet-500/5 p-4 space-y-3",
        className
      )}
    >
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-violet-400" />
        <span className="text-sm font-medium text-violet-200">AI Generated</span>
      </div>

      <div
        className="text-sm text-white/80 prose prose-sm dark:prose-invert max-w-none"
        dangerouslySetInnerHTML={{ __html: preview }}
      />

      {content.length > 200 && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-violet-300/80 hover:text-violet-200 flex items-center gap-1"
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3 w-3" />
              Show less
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3" />
              Show more
            </>
          )}
        </button>
      )}

      <div className="flex gap-2 pt-2 border-t border-white/10">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={handleCopy}
          className="h-7 text-xs text-white/60 hover:text-white hover:bg-white/10"
        >
          {copied ? (
            <>
              <Check className="mr-1 h-3 w-3 text-emerald-400" />
              Copied
            </>
          ) : (
            <>
              <Copy className="mr-1 h-3 w-3" />
              Copy
            </>
          )}
        </Button>

        {onRegenerate && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onRegenerate}
            disabled={isRegenerating}
            className="h-7 text-xs text-white/60 hover:text-white hover:bg-white/10"
          >
            {isRegenerating ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="mr-1 h-3 w-3" />
            )}
            Regenerate
          </Button>
        )}

        <Button
          type="button"
          size="sm"
          onClick={onApply}
          className="ml-auto h-7 text-xs bg-violet-500/20 text-violet-200 hover:bg-violet-500/30"
        >
          <Check className="mr-1 h-3 w-3" />
          Apply
        </Button>
      </div>
    </motion.div>
  );
}

type Activity = {
  name: string;
  description: string;
  duration: string;
  materials: string[];
  groupSize: string;
  objectives: string;
};

type AISuggestedActivitiesProps = {
  activities: Activity[];
  onSelect: (activity: Activity) => void;
  onClose: () => void;
  className?: string;
};

export function AISuggestedActivities({
  activities,
  onSelect,
  onClose,
  className,
}: AISuggestedActivitiesProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 space-y-3",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-amber-400" />
          <span className="text-sm font-medium text-amber-200">
            Suggested Activities
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-white/40 hover:text-white"
        >
          ×
        </button>
      </div>

      <div className="space-y-2 max-h-64 overflow-y-auto">
        {activities.map((activity, index) => (
          <button
            key={index}
            type="button"
            onClick={() => onSelect(activity)}
            className="w-full text-left rounded-md bg-white/5 p-3 hover:bg-white/10 transition-colors"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-grow">
                <p className="text-sm font-medium text-white">{activity.name}</p>
                <p className="text-xs text-white/60 mt-1 line-clamp-2">
                  {activity.description}
                </p>
              </div>
              <div className="flex-shrink-0 text-xs text-white/40">
                {activity.duration}
              </div>
            </div>
            <div className="flex gap-2 mt-2 text-xs text-white/50">
              <span>{activity.groupSize}</span>
              {activity.materials.length > 0 && (
                <>
                  <span>•</span>
                  <span>{activity.materials.length} material(s)</span>
                </>
              )}
            </div>
          </button>
        ))}
      </div>
    </motion.div>
  );
}

export type GeneratedLessonBody =
  | NaCCA3PhaseGenerated
  | ClassicJHSGenerated
  | SimpleGenerated;
