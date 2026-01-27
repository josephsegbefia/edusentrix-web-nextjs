// src/components/polls/PollTemplateSelector.tsx
"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BookOpen,
  Check,
  FileText,
  Heart,
  Loader2,
  MessageCircle,
  Plus,
  Settings,
  Sparkles,
  Users,
  Vote,
  X,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  usePollTemplates,
  usePollTemplate,
  useSeedTemplates,
  TemplateListItemDTO,
  TemplateCategory,
  TEMPLATE_CATEGORIES,
} from "@/hooks/admin/usePollTemplates";
import { cn } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

interface PollTemplateSelectorProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onSelectTemplate: (template: TemplateListItemDTO | null) => void;
}

// ============================================================================
// Icon Mapping
// ============================================================================

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  wellbeing: <Heart className="h-5 w-5" />,
  academic: <BookOpen className="h-5 w-5" />,
  decision: <Vote className="h-5 w-5" />,
  parent: <Users className="h-5 w-5" />,
  quick: <Zap className="h-5 w-5" />,
  election: <Award className="h-5 w-5" />,
  feedback: <MessageCircle className="h-5 w-5" />,
  administrative: <Settings className="h-5 w-5" />,
};

const COLOR_CLASSES: Record<string, { bg: string; text: string; border: string; accent: string }> = {
  rose: { bg: "bg-rose-500/10", text: "text-rose-400", border: "border-rose-500/30", accent: "from-rose-500/20" },
  blue: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/30", accent: "from-blue-500/20" },
  indigo: { bg: "bg-indigo-500/10", text: "text-indigo-400", border: "border-indigo-500/30", accent: "from-indigo-500/20" },
  cyan: { bg: "bg-cyan-500/10", text: "text-cyan-400", border: "border-cyan-500/30", accent: "from-cyan-500/20" },
  yellow: { bg: "bg-yellow-500/10", text: "text-yellow-400", border: "border-yellow-500/30", accent: "from-yellow-500/20" },
  purple: { bg: "bg-purple-500/10", text: "text-purple-400", border: "border-purple-500/30", accent: "from-purple-500/20" },
  sky: { bg: "bg-sky-500/10", text: "text-sky-400", border: "border-sky-500/30", accent: "from-sky-500/20" },
  slate: { bg: "bg-slate-500/10", text: "text-slate-400", border: "border-slate-500/30", accent: "from-slate-500/20" },
  emerald: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/30", accent: "from-emerald-500/20" },
  violet: { bg: "bg-violet-500/10", text: "text-violet-400", border: "border-violet-500/30", accent: "from-violet-500/20" },
  amber: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/30", accent: "from-amber-500/20" },
  orange: { bg: "bg-orange-500/10", text: "text-orange-400", border: "border-orange-500/30", accent: "from-orange-500/20" },
  green: { bg: "bg-green-500/10", text: "text-green-400", border: "border-green-500/30", accent: "from-green-500/20" },
  teal: { bg: "bg-teal-500/10", text: "text-teal-400", border: "border-teal-500/30", accent: "from-teal-500/20" },
  pink: { bg: "bg-pink-500/10", text: "text-pink-400", border: "border-pink-500/30", accent: "from-pink-500/20" },
  gold: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/30", accent: "from-amber-500/20" },
};

// ============================================================================
// Template Card Component
// ============================================================================

interface TemplateCardProps {
  template: TemplateListItemDTO;
  isSelected: boolean;
  onClick: () => void;
}

function TemplateCard({ template, isSelected, onClick }: TemplateCardProps) {
  const colorClass = COLOR_CLASSES[template.color] || COLOR_CLASSES.violet;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative w-full overflow-hidden rounded-xl border p-4 text-left transition-all",
        "hover:scale-[1.02] hover:shadow-lg",
        isSelected
          ? `${colorClass.border} ${colorClass.bg} ring-2 ring-${template.color}-500/50`
          : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/[0.07]"
      )}
    >
      {/* Selection indicator */}
      {isSelected && (
        <div className={cn(
          "absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full",
          colorClass.bg, colorClass.text
        )}>
          <Check className="h-4 w-4" />
        </div>
      )}

      {/* Content */}
      <div className="flex items-start gap-3">
        <div className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
          colorClass.bg, colorClass.text
        )}>
          {CATEGORY_ICONS[template.category] || <FileText className="h-5 w-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="truncate font-medium text-white">{template.name}</h4>
          <p className="mt-0.5 line-clamp-2 text-sm text-white/50">{template.description}</p>
          <div className="mt-2 flex items-center gap-2">
            <Badge className={cn("text-[10px]", colorClass.border, colorClass.bg, colorClass.text)}>
              {template.questionCount} question{template.questionCount !== 1 ? "s" : ""}
            </Badge>
            {template.isPlatformDefault && (
              <Badge className="border-emerald-500/30 bg-emerald-500/10 text-[10px] text-emerald-300">
                Default
              </Badge>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function PollTemplateSelector({
  open,
  onOpenChange,
  onSelectTemplate,
}: PollTemplateSelectorProps) {
  const { data: templatesData, isLoading, isError } = usePollTemplates();
  const seedMutation = useSeedTemplates();

  const [selectedCategory, setSelectedCategory] = React.useState<TemplateCategory | "all">("all");
  const [selectedTemplate, setSelectedTemplate] = React.useState<TemplateListItemDTO | null>(null);

  // Filter templates by category
  const filteredTemplates = React.useMemo(() => {
    if (!templatesData?.data) return [];
    if (selectedCategory === "all") return templatesData.data;
    return templatesData.data.filter((t) => t.category === selectedCategory);
  }, [templatesData?.data, selectedCategory]);

  // Handle seed templates
  const handleSeedTemplates = async () => {
    try {
      await seedMutation.mutateAsync();
    } catch (e) {
      console.error("Failed to seed templates:", e);
    }
  };

  const handleContinue = () => {
    onSelectTemplate(selectedTemplate);
    onOpenChange(false);
  };

  const handleStartFromScratch = () => {
    onSelectTemplate(null);
    onOpenChange(false);
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 pt-12"
        onClick={() => onOpenChange(false)}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="relative w-full max-w-4xl rounded-2xl border border-white/10 bg-[#0f0f14] shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 p-6">
            <div>
              <h2 className="text-xl font-bold text-white">Create a Poll</h2>
              <p className="mt-1 text-sm text-white/60">
                Choose a template to get started quickly, or create from scratch
              </p>
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

          {/* Content */}
          <div className="flex min-h-[400px]">
            {/* Category Sidebar */}
            <div className="w-56 shrink-0 border-r border-white/10 p-4">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/40">
                Categories
              </h3>
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => setSelectedCategory("all")}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                    selectedCategory === "all"
                      ? "bg-white/10 text-white"
                      : "text-white/60 hover:bg-white/5 hover:text-white"
                  )}
                >
                  <Sparkles className="h-4 w-4" />
                  All Templates
                </button>
                {TEMPLATE_CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(cat.id)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                      selectedCategory === cat.id
                        ? "bg-white/10 text-white"
                        : "text-white/60 hover:bg-white/5 hover:text-white"
                    )}
                  >
                    {CATEGORY_ICONS[cat.id]}
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Templates Grid */}
            <div className="flex-1 p-6">
              {isLoading ? (
                <div className="flex h-full items-center justify-center">
                  <div className="text-center">
                    <Loader2 className="mx-auto h-8 w-8 animate-spin text-violet-400" />
                    <p className="mt-2 text-sm text-white/60">Loading templates...</p>
                  </div>
                </div>
              ) : isError || !templatesData?.data?.length ? (
                <div className="flex h-full flex-col items-center justify-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/5">
                    <FileText className="h-8 w-8 text-white/30" />
                  </div>
                  <p className="mt-4 font-medium text-white/80">No templates available</p>
                  <p className="mt-1 text-sm text-white/50">
                    Seed the default templates to get started
                  </p>
                  <Button
                    onClick={handleSeedTemplates}
                    disabled={seedMutation.isPending}
                    className="mt-4 gap-2 bg-violet-600 text-white hover:bg-violet-700"
                  >
                    {seedMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                    Load Default Templates
                  </Button>
                </div>
              ) : (
                <div className="h-[400px] overflow-y-auto pr-4 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {filteredTemplates.map((template) => (
                      <TemplateCard
                        key={template.id}
                        template={template}
                        isSelected={selectedTemplate?.id === template.id}
                        onClick={() => setSelectedTemplate(
                          selectedTemplate?.id === template.id ? null : template
                        )}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-white/10 p-6">
            <Button
              variant="outline"
              onClick={handleStartFromScratch}
              className="gap-2 border-white/10 text-white/60 hover:bg-white/5 hover:text-white"
            >
              <Plus className="h-4 w-4" />
              Start from Scratch
            </Button>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="border-white/10 text-white/60"
              >
                Cancel
              </Button>
              <Button
                onClick={handleContinue}
                disabled={!selectedTemplate}
                className="gap-2 bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50"
              >
                Continue with Template
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
