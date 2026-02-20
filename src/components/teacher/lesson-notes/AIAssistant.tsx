"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  BookOpen,
  ClipboardList,
  Target,
  Maximize2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
  useGenerateFullLesson,
  type AIGenerateRequest,
  type NaCCA3PhaseGenerated,
  type ClassicJHSGenerated,
  type SimpleGenerated,
} from "@/hooks/teacher/useTeacherAIGenerate";
import type { LessonNoteFormData, LessonNoteTemplateType } from "@/types/lesson-notes";

// ============================================================================
// Types
// ============================================================================

type AIContext = {
  templateType: LessonNoteTemplateType;
  topic: string;
  subject?: string;
  gradeLevel?: string;
  duration?: number;
  strand?: string;
  subStrand?: string;
  contentStandard?: string;
  indicators?: string[];
};

// ============================================================================
// AIGenerateButton - Main button to trigger AI generation
// ============================================================================

type AIGenerateButtonProps = {
  context: AIContext;
  onGenerated: (data: NaCCA3PhaseGenerated | ClassicJHSGenerated | SimpleGenerated) => void;
  disabled?: boolean;
  className?: string;
  variant?: "default" | "compact";
};

export function AIGenerateButton({
  context,
  onGenerated,
  disabled,
  className,
  variant = "default",
}: AIGenerateButtonProps) {
  const toast = useToast();
  const [showConfirm, setShowConfirm] = React.useState(false);
  const generateMutation = useGenerateFullLesson();

  const handleGenerate = async () => {
    if (!context.topic) {
      toast.warning("Topic Required", {
        description: "Please enter a topic before generating content.",
      });
      return;
    }

    setShowConfirm(false);

    try {
      const result = await generateMutation.generate({
        templateType: context.templateType,
        topic: context.topic,
        subject: context.subject,
        gradeLevel: context.gradeLevel,
        duration: context.duration,
        strand: context.strand,
        subStrand: context.subStrand,
        contentStandard: context.contentStandard,
        indicators: context.indicators,
      });

      if (result.data) {
        onGenerated(result.data as NaCCA3PhaseGenerated | ClassicJHSGenerated | SimpleGenerated);
        toast.success("Content Generated", {
          description: "AI has generated lesson content. Review and adjust as needed.",
        });
      }
    } catch (error) {
      toast.error("Generation Failed", {
        description: error instanceof Error ? error.message : "Failed to generate content",
      });
    }
  };

  return (
    <>
      <Button
        type="button"
        onClick={() => setShowConfirm(true)}
        disabled={disabled || generateMutation.isPending || !context.topic}
        className={cn(
          "bg-gradient-to-r from-violet-500/30 to-fuchsia-500/30",
          "text-violet-100 hover:from-violet-500/40 hover:to-fuchsia-500/40",
          "border border-violet-400/30",
          className
        )}
      >
        {generateMutation.isPending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="mr-2 h-4 w-4" />
        )}
        {variant === "compact" ? "AI" : "Generate with AI"}
      </Button>

      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="sm:max-w-md bg-[#1a1d24] border-white/10">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <Sparkles className="h-5 w-5 text-violet-400" />
              Generate Lesson Content
            </DialogTitle>
            <DialogDescription className="text-white/60">
              AI will generate a complete lesson note based on your topic and template.
              You can review and edit the content afterwards.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 rounded-lg bg-white/5 p-4">
            <div className="flex justify-between text-sm">
              <span className="text-white/60">Topic</span>
              <span className="text-white font-medium">{context.topic || "Not set"}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-white/60">Template</span>
              <span className="text-white font-medium">
                {context.templateType === "NACCA_3_PHASE"
                  ? "NaCCA 3-Phase"
                  : context.templateType === "CLASSIC_JHS"
                  ? "Classic JHS"
                  : "Simple"}
              </span>
            </div>
            {context.subject && (
              <div className="flex justify-between text-sm">
                <span className="text-white/60">Subject</span>
                <span className="text-white">{context.subject}</span>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowConfirm(false)}
              className="border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
            >
              Cancel
            </Button>
            <Button
              onClick={handleGenerate}
              disabled={generateMutation.isPending}
              className="bg-gradient-to-r from-violet-500/30 to-fuchsia-500/30 text-violet-100"
            >
              {generateMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Wand2 className="mr-2 h-4 w-4" />
                  Generate
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ============================================================================
// AIQuickActions - Dropdown menu with AI quick actions
// ============================================================================

type AIQuickActionsProps = {
  context: AIContext;
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

// ============================================================================
// AIExpandButton - Inline button to expand content
// ============================================================================

type AIExpandButtonProps = {
  context: AIContext;
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

// ============================================================================
// AIGeneratedPreview - Preview of AI generated content with copy/apply
// ============================================================================

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
      // Strip HTML tags for plain text copy
      const plainText = content.replace(/<[^>]*>/g, "");
      await navigator.clipboard.writeText(plainText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const preview = expanded
    ? content
    : content.length > 200
    ? content.slice(0, 200) + "..."
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

// ============================================================================
// AISuggestedActivities - Display suggested activities
// ============================================================================

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
