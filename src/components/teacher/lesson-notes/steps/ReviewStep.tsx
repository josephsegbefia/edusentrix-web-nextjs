"use client";

import * as React from "react";
import { Edit2, Calendar, Clock, BookOpen, Target, Package, CheckCircle, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { calculateQualityScore } from "@/lib/lesson-notes/quality-score";
import { QualitySummary, QualityChecklist } from "../QualityIndicator";
import type {
  LessonNoteFormData,
  WizardStep,
  NaCCA3PhaseBody,
  ClassicJHSBody,
  SimpleBody,
} from "@/types/lesson-notes";
import {
  TEMPLATE_LABELS,
  isNaCCA3PhaseBody,
  isClassicJHSBody,
  isSimpleBody,
  calculateTotalTime,
} from "@/types/lesson-notes";
import type { ClassOption } from "../LessonNoteWizard";
import { HtmlContent } from "@/components/ui/html-content";

type ReviewStepProps = {
  formData: LessonNoteFormData;
  classOptions: ClassOption[];
  onEdit: (step: WizardStep) => void;
};

export function ReviewStep({ formData, classOptions, onEdit }: ReviewStepProps) {
  const [showAllChecks, setShowAllChecks] = React.useState(false);

  // Get class and subject names
  const selectedClass = classOptions.find((c) => c.id === formData.classGroupId);
  const className = selectedClass?.label || "Unknown class";
  const subjectName =
    selectedClass?.subjects.find((s) => s.id === formData.subjectId)?.name || "—";

  // Format date
  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  // Calculate total time
  const totalTime = calculateTotalTime(formData.body, formData.templateType);

  // Calculate quality score
  const qualityScore = React.useMemo(
    () => calculateQualityScore(formData),
    [formData]
  );

  const SectionHeader = ({
    title,
    step,
    icon,
  }: {
    title: string;
    step: WizardStep;
    icon: React.ReactNode;
  }) => (
    <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-3">
      <div className="flex items-center gap-2 text-white/80">
        {icon}
        <span className="font-medium">{title}</span>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => onEdit(step)}
        className="h-7 px-2 text-indigo-300 hover:bg-indigo-500/20 hover:text-indigo-200"
      >
        <Edit2 className="mr-1 h-3 w-3" />
        Edit
      </Button>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-white">Review Your Lesson Note</h2>
        <p className="text-sm text-white/60">
          Check all details before saving. Click "Edit" to make changes.
        </p>
      </div>

      {/* Quality Summary */}
      <QualitySummary
        score={qualityScore}
        onViewDetails={() => setShowAllChecks(!showAllChecks)}
        onNavigate={(step) => onEdit(step)}
      />

      {/* Detailed Quality Checks (collapsible) */}
      {showAllChecks && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center gap-2 mb-4">
            <ClipboardCheck className="h-4 w-4 text-white/70" />
            <h3 className="font-medium text-white">Quality Checklist</h3>
          </div>
          <QualityChecklist
            checks={qualityScore.checks}
            showAll
            groupByCategory
            onNavigate={(step) => onEdit(step)}
          />
        </div>
      )}

      {/* Context Section */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <SectionHeader title="Context" step="context" icon={<Calendar className="h-4 w-4" />} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs text-white/50">Class</p>
            <p className="font-medium text-white">{className}</p>
          </div>
          <div>
            <p className="text-xs text-white/50">Subject</p>
            <p className="font-medium text-white">{subjectName}</p>
          </div>
          <div>
            <p className="text-xs text-white/50">Week of</p>
            <p className="font-medium text-white">{formatDate(formData.weekOf)}</p>
          </div>
          <div>
            <p className="text-xs text-white/50">Duration</p>
            <p className="font-medium text-white">
              {formData.durationMinutes || totalTime || "—"} min
            </p>
          </div>
        </div>
        <div className="mt-4">
          <p className="text-xs text-white/50">Topic</p>
          <p className="text-lg font-semibold text-white">{formData.topic || "—"}</p>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Badge className="bg-indigo-500/20 text-indigo-200">
            {TEMPLATE_LABELS[formData.templateType]}
          </Badge>
          {formData.references[0] && (
            <Badge className="bg-white/10 text-white/70">{formData.references[0]}</Badge>
          )}
        </div>
      </div>

      {/* Curriculum Section */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <SectionHeader title="Curriculum" step="curriculum" icon={<Target className="h-4 w-4" />} />
        {formData.curriculum?.strand || formData.curriculum?.indicators?.length ? (
          <div className="space-y-3">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs text-white/50">Strand</p>
                <p className="text-white">{formData.curriculum?.strand || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-white/50">Sub-strand</p>
                <p className="text-white">{formData.curriculum?.subStrand || "—"}</p>
              </div>
            </div>
            {formData.curriculum?.contentStandard && (
              <div>
                <p className="text-xs text-white/50">Content Standard</p>
                <HtmlContent html={formData.curriculum.contentStandard} className="text-white" />
              </div>
            )}
            {(formData.curriculum?.indicators || []).length > 0 && (
              <div>
                <p className="text-xs text-white/50 mb-1">Indicators</p>
                <div className="flex flex-wrap gap-2">
                  {formData.curriculum.indicators.map((ind, i) => (
                    <Badge key={i} className="bg-emerald-500/20 text-emerald-200">
                      {ind.refNo}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {(formData.curriculum?.learningOutcomes || []).length > 0 && (
              <div>
                <p className="text-xs text-white/50 mb-1">Learning Outcomes</p>
                <ul className="space-y-1">
                  {formData.curriculum.learningOutcomes.map((outcome, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-white/80">
                      <span className="text-emerald-400">•</span>
                      {outcome}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-white/40 italic">No curriculum alignment added</p>
        )}
      </div>

      {/* Resources Section */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <SectionHeader title="Resources" step="resources" icon={<Package className="h-4 w-4" />} />
        <div className="space-y-3">
          {(formData.tlms || []).length > 0 ? (
            <div>
              <p className="text-xs text-white/50 mb-1">TLMs</p>
              <div className="flex flex-wrap gap-2">
                {formData.tlms.map((tlm, i) => (
                  <Badge key={i} className="bg-amber-500/20 text-amber-200">
                    {tlm}
                  </Badge>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-white/40 italic">No TLMs selected</p>
          )}
          {formData.resources.length > 0 && (
            <div>
              <p className="text-xs text-white/50 mb-1">External Resources</p>
              <ul className="space-y-1">
                {formData.resources.map((res, i) => (
                  <li key={i} className="text-sm text-white/80">
                    <span className="text-indigo-300">[{res.type || "link"}]</span> {res.title}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Body Section */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <SectionHeader title="Lesson Body" step="body" icon={<BookOpen className="h-4 w-4" />} />
        {formData.body ? (
          <div className="space-y-4">
            {isNaCCA3PhaseBody(formData.body) && (
              <NaCCABodyPreview body={formData.body} />
            )}
            {isClassicJHSBody(formData.body) && (
              <ClassicBodyPreview body={formData.body} />
            )}
            {isSimpleBody(formData.body) && (
              <SimpleBodyPreview body={formData.body} />
            )}
          </div>
        ) : (
          <p className="text-sm text-white/40 italic">No lesson content added</p>
        )}
      </div>

      {/* Assessment Section */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <SectionHeader title="Assessment" step="assessment" icon={<CheckCircle className="h-4 w-4" />} />
        <div className="space-y-3">
          {(formData.assessment?.inClassChecks || []).length > 0 ? (
            <div>
              <p className="text-xs text-white/50 mb-1">In-class Checks</p>
              <ul className="space-y-1">
                {formData.assessment.inClassChecks.map((check, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-white/80">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-xs text-emerald-200">
                      {i + 1}
                    </span>
                    {check}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {formData.assessment?.exitTicket && (
            <div>
              <p className="text-xs text-white/50">Exit Ticket</p>
              <div className="text-sm text-white/80">
                <HtmlContent html={formData.assessment.exitTicket} />
              </div>
            </div>
          )}
          {formData.assessment?.homework && (
            <div>
              <p className="text-xs text-white/50">Homework</p>
              <div className="text-sm text-white/80">
                <HtmlContent html={formData.assessment.homework} />
              </div>
            </div>
          )}
          {!formData.assessment?.inClassChecks?.length &&
            !formData.assessment?.exitTicket &&
            !formData.assessment?.homework && (
              <p className="text-sm text-white/40 italic">No assessment added</p>
            )}
        </div>
      </div>
    </div>
  );
}

// Preview components for different body types
function NaCCABodyPreview({ body }: { body: NaCCA3PhaseBody }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-lg bg-amber-500/10 p-3">
        <p className="text-xs font-medium text-amber-200 mb-1">
          Starter ({body.starter?.timeMins || 10}m)
        </p>
        <div className="text-xs text-white/70 line-clamp-3">
          <HtmlContent html={body.starter?.activities} fallback="—" />
        </div>
      </div>
      <div className="rounded-lg bg-indigo-500/10 p-3">
        <p className="text-xs font-medium text-indigo-200 mb-1">
          Main ({body.main?.timeMins || 25}m)
        </p>
        <div className="text-xs text-white/70 line-clamp-3">
          <HtmlContent html={body.main?.teacherActivities} fallback="—" />
        </div>
      </div>
      <div className="rounded-lg bg-emerald-500/10 p-3">
        <p className="text-xs font-medium text-emerald-200 mb-1">
          Plenary ({body.plenary?.timeMins || 5}m)
        </p>
        <div className="text-xs text-white/70 line-clamp-3">
          <HtmlContent html={body.plenary?.summaryPoints} fallback="—" />
        </div>
      </div>
    </div>
  );
}

function ClassicBodyPreview({ body }: { body: ClassicJHSBody }) {
  return (
    <div className="space-y-2">
      <div>
        <p className="text-xs text-white/50">Objectives</p>
        <div className="text-sm text-white/80">
          <HtmlContent html={body.objectives?.general} fallback="—" />
        </div>
        {(body.objectives?.specific || []).length > 0 && (
          <p className="text-xs text-white/50 mt-1">
            + {body.objectives.specific.length} specific objectives
          </p>
        )}
      </div>
      <div>
        <p className="text-xs text-white/50">Presentation Steps</p>
        <p className="text-sm text-white/80">
          {body.presentationSteps?.length || 0} steps
        </p>
      </div>
      {(body.corePoints || []).length > 0 && (
        <div>
          <p className="text-xs text-white/50">Core Points</p>
          <p className="text-sm text-white/80">{body.corePoints.length} points</p>
        </div>
      )}
    </div>
  );
}

function SimpleBodyPreview({ body }: { body: SimpleBody }) {
  return (
    <div className="space-y-2">
      {body.objectives && (
        <div>
          <p className="text-xs text-white/50">Objectives</p>
          <div className="text-sm text-white/80 line-clamp-2">
            <HtmlContent html={body.objectives} fallback="—" />
          </div>
        </div>
      )}
      {body.content && (
        <div>
          <p className="text-xs text-white/50">Content</p>
          <div className="text-sm text-white/80 line-clamp-3">
            <HtmlContent html={body.content} fallback="—" />
          </div>
        </div>
      )}
    </div>
  );
}
