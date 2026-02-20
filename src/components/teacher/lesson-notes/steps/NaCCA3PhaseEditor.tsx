"use client";

import * as React from "react";
import { Play, BookOpen, MessageSquare, Clock, Package, Plus, X } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CompactRichText } from "@/components/ui/rich-text-editor";
import { cn } from "@/lib/utils";
import type {
  LessonNoteFormData,
  NaCCA3PhaseBody,
  NaCCAStarter,
  NaCCAMain,
  NaCCAPlenary,
} from "@/types/lesson-notes";
import { isNaCCA3PhaseBody, DEFAULT_NACCA_BODY, COMMON_TLMS } from "@/types/lesson-notes";

type NaCCA3PhaseEditorProps = {
  formData: LessonNoteFormData;
  onUpdate: (updates: Partial<LessonNoteFormData>) => void;
};

type Phase = "starter" | "main" | "plenary";

const PHASES: {
  id: Phase;
  label: string;
  icon: React.ReactNode;
  color: string;
  description: string;
}[] = [
  {
    id: "starter",
    label: "Starter",
    icon: <Play className="h-4 w-4" />,
    color: "amber",
    description: "Engage learners and review previous knowledge",
  },
  {
    id: "main",
    label: "Main Activity",
    icon: <BookOpen className="h-4 w-4" />,
    color: "indigo",
    description: "Core teaching and learning activities",
  },
  {
    id: "plenary",
    label: "Plenary",
    icon: <MessageSquare className="h-4 w-4" />,
    color: "emerald",
    description: "Summarize, reflect, and consolidate learning",
  },
];

export function NaCCA3PhaseEditor({ formData, onUpdate }: NaCCA3PhaseEditorProps) {
  const [activePhase, setActivePhase] = React.useState<Phase>("starter");

  // Get body with proper type
  const body: NaCCA3PhaseBody = isNaCCA3PhaseBody(formData.body)
    ? formData.body
    : DEFAULT_NACCA_BODY;

  // Update body
  const updateBody = (updates: Partial<NaCCA3PhaseBody>) => {
    onUpdate({
      body: {
        ...body,
        ...updates,
      },
    });
  };

  // Update starter
  const updateStarter = (updates: Partial<NaCCAStarter>) => {
    updateBody({
      starter: {
        ...body.starter,
        ...updates,
      },
    });
  };

  // Update main
  const updateMain = (updates: Partial<NaCCAMain>) => {
    updateBody({
      main: {
        ...body.main,
        ...updates,
      },
    });
  };

  // Update plenary
  const updatePlenary = (updates: Partial<NaCCAPlenary>) => {
    updateBody({
      plenary: {
        ...body.plenary,
        ...updates,
      },
    });
  };

  // Calculate total time
  const totalTime =
    (body.starter?.timeMins || 0) +
    (body.main?.timeMins || 0) +
    (body.plenary?.timeMins || 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">NaCCA 3-Phase Lesson</h2>
          <p className="text-sm text-white/60">
            Structure your lesson using the Starter → Main → Plenary format
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-white/5 px-3 py-1.5 text-sm">
          <Clock className="h-4 w-4 text-white/50" />
          <span className="text-white/70">{totalTime} min</span>
          {formData.durationMinutes && totalTime !== formData.durationMinutes && (
            <span className="text-amber-400/80">
              ({formData.durationMinutes} planned)
            </span>
          )}
        </div>
      </div>

      {/* Phase tabs */}
      <div className="flex gap-2">
        {PHASES.map((phase) => {
          const isActive = activePhase === phase.id;
          const colorClasses = {
            amber: isActive
              ? "bg-amber-500/20 text-amber-200 border-amber-400/50"
              : "bg-white/5 text-white/60 border-white/10",
            indigo: isActive
              ? "bg-indigo-500/20 text-indigo-200 border-indigo-400/50"
              : "bg-white/5 text-white/60 border-white/10",
            emerald: isActive
              ? "bg-emerald-500/20 text-emerald-200 border-emerald-400/50"
              : "bg-white/5 text-white/60 border-white/10",
          }[phase.color];

          const phaseTime =
            phase.id === "starter"
              ? body.starter?.timeMins
              : phase.id === "main"
              ? body.main?.timeMins
              : body.plenary?.timeMins;

          return (
            <button
              key={phase.id}
              type="button"
              onClick={() => setActivePhase(phase.id)}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-3 transition-all",
                colorClasses,
                isActive && "ring-1 ring-white/20"
              )}
            >
              {phase.icon}
              <span className="font-medium">{phase.label}</span>
              {phaseTime && (
                <span className="text-xs opacity-70">({phaseTime}m)</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Phase content */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-4">
        {activePhase === "starter" && (
          <>
            <div className="mb-4 rounded-xl bg-amber-500/10 p-3 text-sm text-amber-200/80">
              <strong>Starter Phase:</strong> Engage learners, review previous knowledge (RPK), and introduce the lesson topic.
            </div>

            <div className="grid gap-4 sm:grid-cols-4">
              <div className="sm:col-span-3 space-y-2">
                <Label className="text-white/70">Starter Activities</Label>
                <CompactRichText
                  value={body.starter?.activities || ""}
                  onChange={(value) => updateStarter({ activities: value })}
                  placeholder="Describe the starter activity..."
                />
              </div>
              <div className="space-y-2">
                <Label className="text-white/70">Time (min)</Label>
                <Input
                  type="number"
                  value={body.starter?.timeMins || 10}
                  onChange={(e) => updateStarter({ timeMins: parseInt(e.target.value, 10) || 0 })}
                  min={1}
                  max={30}
                  className="border-white/10 bg-white/5 text-white"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-white/70">Review of Previous Knowledge (RPK)</Label>
              <CompactRichText
                value={body.starter?.rpkPrompt || ""}
                onChange={(value) => updateStarter({ rpkPrompt: value })}
                placeholder="What do learners already know? How will you connect to previous learning?"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-white/70">Engagement Hook</Label>
              <CompactRichText
                value={body.starter?.engagementHook || ""}
                onChange={(value) => updateStarter({ engagementHook: value })}
                placeholder="Question, story, or quick game to capture attention..."
              />
            </div>
          </>
        )}

        {activePhase === "main" && (
          <>
            <div className="mb-4 rounded-xl bg-indigo-500/10 p-3 text-sm text-indigo-200/80">
              <strong>Main Activity:</strong> The core teaching and learning activities. Include teacher and learner actions.
            </div>

            <div className="grid gap-4 sm:grid-cols-4">
              <div className="sm:col-span-3 space-y-2">
                <Label className="text-white/70">Teacher Activities</Label>
                <CompactRichText
                  value={body.main?.teacherActivities || ""}
                  onChange={(value) => updateMain({ teacherActivities: value })}
                  placeholder="What will the teacher do? (explain, demonstrate, guide...)"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-white/70">Time (min)</Label>
                <Input
                  type="number"
                  value={body.main?.timeMins || 25}
                  onChange={(e) => updateMain({ timeMins: parseInt(e.target.value, 10) || 0 })}
                  min={5}
                  max={90}
                  className="border-white/10 bg-white/5 text-white"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-white/70">Learner Activities</Label>
              <CompactRichText
                value={body.main?.learnerActivities || ""}
                onChange={(value) => updateMain({ learnerActivities: value })}
                placeholder="What will learners do? (practice, discuss, collaborate...)"
              />
            </div>

            <ResourcesUsedSection
              formData={formData}
              currentResources={body.main?.resourcesUsed || ""}
              onUpdate={(value) => updateMain({ resourcesUsed: value })}
            />

            <div className="space-y-2">
              <Label className="text-white/70">Embedded Assessment</Label>
              <CompactRichText
                value={body.main?.embeddedAssessment || ""}
                onChange={(value) => updateMain({ embeddedAssessment: value })}
                placeholder="Questions or tasks to check understanding during the activity"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-white/70">Differentiation (optional)</Label>
              <CompactRichText
                value={body.main?.differentiation || ""}
                onChange={(value) => updateMain({ differentiation: value })}
                placeholder="How will you support struggling learners? Challenge advanced learners?"
              />
            </div>
          </>
        )}

        {activePhase === "plenary" && (
          <>
            <div className="mb-4 rounded-xl bg-emerald-500/10 p-3 text-sm text-emerald-200/80">
              <strong>Plenary Phase:</strong> Consolidate learning, reflect, and connect to future lessons.
            </div>

            <div className="grid gap-4 sm:grid-cols-4">
              <div className="sm:col-span-3 space-y-2">
                <Label className="text-white/70">Summary Points</Label>
                <CompactRichText
                  value={body.plenary?.summaryPoints || ""}
                  onChange={(value) => updatePlenary({ summaryPoints: value })}
                  placeholder="Key points to consolidate at the end of the lesson..."
                />
              </div>
              <div className="space-y-2">
                <Label className="text-white/70">Time (min)</Label>
                <Input
                  type="number"
                  value={body.plenary?.timeMins || 5}
                  onChange={(e) => updatePlenary({ timeMins: parseInt(e.target.value, 10) || 0 })}
                  min={1}
                  max={20}
                  className="border-white/10 bg-white/5 text-white"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-white/70">Learner Reflection</Label>
              <CompactRichText
                value={body.plenary?.learnerReflection || ""}
                onChange={(value) => updatePlenary({ learnerReflection: value })}
                placeholder="Prompt for learners to reflect on what they learned..."
              />
            </div>

            <div className="space-y-2">
              <Label className="text-white/70">Teacher Reflection</Label>
              <CompactRichText
                value={body.plenary?.teacherReflection || ""}
                onChange={(value) => updatePlenary({ teacherReflection: value })}
                placeholder="Your notes: What worked? What to improve?"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-white/70">Exit Ticket (optional)</Label>
                <Input
                  value={body.plenary?.exitTicket || ""}
                  onChange={(e) => updatePlenary({ exitTicket: e.target.value })}
                  placeholder="Quick question to check understanding"
                  className="border-white/10 bg-white/5 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-white/70">Homework (optional)</Label>
                <Input
                  value={body.plenary?.homework || ""}
                  onChange={(e) => updatePlenary({ homework: e.target.value })}
                  placeholder="Assignment for home"
                  className="border-white/10 bg-white/5 text-white"
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Resources Used Section Component
// ============================================================================

function ResourcesUsedSection({
  formData,
  currentResources,
  onUpdate,
}: {
  formData: LessonNoteFormData;
  currentResources: string;
  onUpdate: (value: string) => void;
}) {
  const [customResource, setCustomResource] = React.useState("");

  // Parse current resources (stored as comma-separated string)
  const selectedResources = React.useMemo(() => {
    if (!currentResources) return [];
    return currentResources.split(",").map((r) => r.trim()).filter(Boolean);
  }, [currentResources]);

  // Combine TLMs from form data with common TLMs for quick selection
  const availableTlms = React.useMemo(() => {
    const fromForm = formData.tlms || [];
    const combined = new Set([...fromForm, ...COMMON_TLMS]);
    return Array.from(combined);
  }, [formData.tlms]);

  const toggleResource = (resource: string) => {
    if (selectedResources.includes(resource)) {
      onUpdate(selectedResources.filter((r) => r !== resource).join(", "));
    } else {
      onUpdate([...selectedResources, resource].join(", "));
    }
  };

  const addCustomResource = () => {
    if (!customResource.trim()) return;
    if (!selectedResources.includes(customResource.trim())) {
      onUpdate([...selectedResources, customResource.trim()].join(", "));
    }
    setCustomResource("");
  };

  return (
    <div className="space-y-3">
      <Label className="flex items-center gap-2 text-white/70">
        <Package className="h-4 w-4" />
        Resources Used in Main Activity
      </Label>

      {/* TLMs already selected in Resources step */}
      {(formData.tlms?.length ?? 0) > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-white/40">From your selected TLMs:</p>
          <div className="flex flex-wrap gap-1.5">
            {formData.tlms?.map((tlm) => {
              const isSelected = selectedResources.includes(tlm);
              return (
                <button
                  key={tlm}
                  type="button"
                  onClick={() => toggleResource(tlm)}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-xs font-medium transition-all",
                    isSelected
                      ? "bg-indigo-500/30 text-indigo-200 ring-1 ring-indigo-400/50"
                      : "bg-white/5 text-white/60 hover:bg-white/10"
                  )}
                >
                  {tlm}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick add common resources */}
      <div className="space-y-1">
        <p className="text-xs text-white/40">Quick add:</p>
        <div className="flex flex-wrap gap-1.5">
          {COMMON_TLMS.slice(0, 10).map((tlm) => {
            const isSelected = selectedResources.includes(tlm);
            const alreadyInTlms = formData.tlms?.includes(tlm);
            if (alreadyInTlms) return null;
            return (
              <button
                key={tlm}
                type="button"
                onClick={() => toggleResource(tlm)}
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs font-medium transition-all",
                  isSelected
                    ? "bg-emerald-500/30 text-emerald-200 ring-1 ring-emerald-400/50"
                    : "bg-white/5 text-white/50 hover:bg-white/10"
                )}
              >
                {tlm}
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom resource input */}
      <div className="flex gap-2">
        <Input
          value={customResource}
          onChange={(e) => setCustomResource(e.target.value)}
          placeholder="Add other resource"
          className="flex-1 border-white/10 bg-white/5 text-white text-sm"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addCustomResource();
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addCustomResource}
          className="border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>

      {/* Selected resources preview */}
      {selectedResources.length > 0 && (
        <div className="rounded-lg border border-white/10 bg-white/5 p-2">
          <p className="mb-1.5 text-xs text-white/50">Selected for this activity:</p>
          <div className="flex flex-wrap gap-1.5">
            {selectedResources.map((resource, index) => (
              <Badge
                key={index}
                className="flex items-center gap-1 bg-indigo-500/20 text-indigo-200 text-xs"
              >
                {resource}
                <button
                  type="button"
                  onClick={() => toggleResource(resource)}
                  className="ml-0.5 hover:text-white"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
