"use client";

import * as React from "react";
import {
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  Clock,
  MessageSquare,
  Package,
  Target,
  UserSquare2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HtmlContent } from "@/components/ui/html-content";
import { cn } from "@/lib/utils";
import { getTemplateDefinition } from "@/constants/curriculum-lesson-templates";
import {
  getLessonNoteReviewSections,
  getReviewCommentStatusMeta,
  getReviewCommentTypeMeta,
  groupReviewCommentsBySection,
  type LessonNoteReviewSection,
} from "@/lib/lesson-notes/review";
import type { LessonNoteDetail, LessonNoteReviewComment } from "@/types/lesson-notes";
import {
  TEMPLATE_LABELS,
  isClassicJHSBody,
  isNaCCA3PhaseBody,
  isSimpleBody,
} from "@/types/lesson-notes";

const GLASS_PANEL =
  "relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/80 via-slate-950/90 to-black shadow-2xl shadow-black/35 backdrop-blur-xl";

type LessonNoteReadonlyViewProps = {
  note: LessonNoteDetail;
  /** Frosted slate panels for school-admin review surfaces. */
  surfaceVariant?: "default" | "glass";
  headerActions?: React.ReactNode;
  renderSectionActions?: (
    section: LessonNoteReviewSection,
    comments: LessonNoteReviewComment[]
  ) => React.ReactNode;
  renderCommentActions?: (
    section: LessonNoteReviewSection,
    comment: LessonNoteReviewComment
  ) => React.ReactNode;
  renderSectionFooter?: (
    section: LessonNoteReviewSection,
    comments: LessonNoteReviewComment[]
  ) => React.ReactNode;
};

function formatDateLabel(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function EmptySection({ children = "Nothing has been added to this section yet." }: { children?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-4 text-sm text-white/45">
      {children}
    </div>
  );
}

function SectionCard({
  title,
  icon,
  commentCount,
  actions,
  glass,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  commentCount: number;
  actions?: React.ReactNode;
  glass: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card
      className={cn(
        glass
          ? GLASS_PANEL
          : "border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur"
      )}
    >
      <CardHeader className={cn("pb-3", glass && "border-b border-white/10")}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 text-white/70",
                glass ? "bg-white/6 backdrop-blur-sm" : "bg-white/5"
              )}
            >
              {icon}
            </div>
            <div className="space-y-1">
              <CardTitle className="text-lg text-white">{title}</CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  className={cn(
                    "text-white/60",
                    glass ? "border border-white/10 bg-white/8" : "bg-white/10"
                  )}
                >
                  {commentCount} comment{commentCount === 1 ? "" : "s"}
                </Badge>
              </div>
            </div>
          </div>
          {actions}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

function CommentRail({
  section,
  comments,
  glass,
  renderCommentActions,
}: {
  section: LessonNoteReviewSection;
  comments: LessonNoteReviewComment[];
  glass: boolean;
  renderCommentActions?: (
    section: LessonNoteReviewSection,
    comment: LessonNoteReviewComment
  ) => React.ReactNode;
}) {
  if (!comments.length) {
    return null;
  }

  return (
    <div
      className={cn(
        "space-y-3 rounded-2xl border border-white/10 p-4",
        glass ? "bg-white/4 backdrop-blur-md" : "bg-black/20"
      )}
    >
      <div className="flex items-center gap-2 text-sm font-medium text-white">
        <MessageSquare className="h-4 w-4 text-sky-300" />
        Review Comments
      </div>
      <div className="space-y-3">
        {comments.map((comment) => {
          const typeMeta = getReviewCommentTypeMeta(comment.commentType);
          const statusMeta = getReviewCommentStatusMeta(comment.status);
          return (
            <div
              key={comment.id}
              className={cn(
                "rounded-2xl border p-4",
                comment.status === "resolved"
                  ? glass
                    ? "border-emerald-400/25 bg-emerald-500/10 backdrop-blur-sm"
                    : "border-emerald-500/20 bg-emerald-500/5"
                  : glass
                    ? "border-white/10 bg-white/6 backdrop-blur-sm"
                    : "border-white/10 bg-white/5"
              )}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={typeMeta.toneClassName}>{typeMeta.label}</Badge>
                    <Badge className={statusMeta.toneClassName}>{statusMeta.label}</Badge>
                  </div>
                  <div className="text-xs text-white/45">
                    {comment.authorName || "Reviewer"} • {formatDateLabel(comment.createdAt)}
                  </div>
                </div>
                {renderCommentActions?.(section, comment)}
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm text-white/80">{comment.comment}</p>
              {comment.status === "resolved" && comment.resolvedByName && (
                <div className="mt-3 text-xs text-emerald-200/80">
                  Resolved by {comment.resolvedByName} on {formatDateLabel(comment.resolvedAt)}
                </div>
              )}
              {comment.status === "addressed" && comment.addressedByName && (
                <div className="mt-3 text-xs text-amber-200/80">
                  Addressed by {comment.addressedByName} on {formatDateLabel(comment.addressedAt)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ContextSection({ note }: { note: LessonNoteDetail }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-white/40">Class</div>
          <div className="mt-1 text-sm text-white">{note.className || "—"}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-white/40">Subject</div>
          <div className="mt-1 text-sm text-white">{note.subjectName || "—"}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-white/40">Week Of</div>
          <div className="mt-1 text-sm text-white">{formatDateLabel(note.weekOf)}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-white/40">Duration</div>
          <div className="mt-1 text-sm text-white">
            {note.durationMinutes ? `${note.durationMinutes} mins` : "—"}
          </div>
        </div>
      </div>

      <div>
        <div className="text-xs uppercase tracking-[0.18em] text-white/40">Topic</div>
        <div className="mt-2 text-lg font-semibold text-white">{note.topic || "—"}</div>
      </div>

      {note.schemeId ? (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-100/90">
          Linked to a scheme of work.
          {(note.schemeItemIds?.length ?? 0) > 0 ? (
            <span className="mt-1 block text-xs text-white/55">
              {note.schemeItemIds!.length} scheme item(s) tagged
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Badge className="bg-indigo-500/20 text-indigo-200">
          {TEMPLATE_LABELS[note.templateType]}
        </Badge>
        {note.references.map((reference, index) => (
          <Badge key={`${reference}-${index}`} className="bg-white/10 text-white/70">
            {reference}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function CurriculumSection({ note }: { note: LessonNoteDetail }) {
  const isNaCCAStyle =
    note.templateType === "NACCA_3_PHASE" || note.templateType === "CLASSIC_JHS";
  const templateDefinition = getTemplateDefinition(note.templateType);

  if (isNaCCAStyle) {
    if (
      !note.curriculum?.strand &&
      !note.curriculum?.subStrand &&
      !note.curriculum?.contentStandard &&
      !(note.curriculum?.indicators || []).length &&
      !(note.curriculum?.learningOutcomes || []).length
    ) {
      return <EmptySection>No curriculum alignment has been added yet.</EmptySection>;
    }

    return (
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-white/40">Strand</div>
            <div className="mt-1 text-sm text-white">{note.curriculum?.strand || "—"}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-white/40">Sub-strand</div>
            <div className="mt-1 text-sm text-white">{note.curriculum?.subStrand || "—"}</div>
          </div>
        </div>

        {note.curriculum?.contentStandard && (
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-white/40">
              Content Standard
            </div>
            <div className="mt-2 rounded-2xl border border-white/10 bg-white/5 p-4">
              <HtmlContent html={note.curriculum.contentStandard} />
            </div>
          </div>
        )}

        {(note.curriculum?.indicators || []).length > 0 && (
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-[0.18em] text-white/40">
              Indicators
            </div>
            <div className="flex flex-wrap gap-2">
              {note.curriculum?.indicators.map((indicator, index) => (
                <Badge key={`${indicator.refNo}-${index}`} className="bg-emerald-500/20 text-emerald-200">
                  {indicator.refNo || indicator.text}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {(note.curriculum?.learningOutcomes || []).length > 0 && (
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-[0.18em] text-white/40">
              Learning Outcomes
            </div>
            <div className="space-y-2">
              {note.curriculum?.learningOutcomes.map((outcome, index) => (
                <div
                  key={`${outcome}-${index}`}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80"
                >
                  {outcome}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  const fields = templateDefinition?.curriculumFields || [];
  const hasMetadata = fields.some((field) => {
    const value = note.curriculumMetadata?.[field.key];
    return typeof value === "string"
      ? value.trim().length > 0
      : Array.isArray(value)
      ? value.length > 0
      : Boolean(value);
  });

  if (!hasMetadata) {
    return <EmptySection>No curriculum alignment has been added yet.</EmptySection>;
  }

  return (
    <div className="space-y-4">
      {fields.map((field) => {
        const value = note.curriculumMetadata?.[field.key];
        if (!value) return null;

        if (Array.isArray(value) && value.length) {
          return (
            <div key={field.key} className="space-y-2">
              <div className="text-xs uppercase tracking-[0.18em] text-white/40">
                {field.label}
              </div>
              <div className="flex flex-wrap gap-2">
                {value.map((entry, index) => (
                  <Badge
                    key={`${field.key}-${index}`}
                    className="bg-emerald-500/20 text-emerald-200"
                  >
                    {typeof entry === "object" && entry !== null && "refNo" in entry
                      ? `${(entry as { refNo?: string }).refNo || ""}`.trim() ||
                        String((entry as { text?: string }).text || "")
                      : String(entry)}
                  </Badge>
                ))}
              </div>
            </div>
          );
        }

        return (
          <div key={field.key} className="space-y-2">
            <div className="text-xs uppercase tracking-[0.18em] text-white/40">
              {field.label}
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              {field.type === "richtext" ? (
                <HtmlContent html={String(value)} />
              ) : (
                <div className="text-sm text-white/80">{String(value)}</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ResourcesSection({ note }: { note: LessonNoteDetail }) {
  if (!(note.tlms || []).length && !(note.resources || []).length) {
    return <EmptySection>No materials or external resources have been added yet.</EmptySection>;
  }

  return (
    <div className="space-y-4">
      {(note.tlms || []).length > 0 && (
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-[0.18em] text-white/40">TLMs</div>
          <div className="flex flex-wrap gap-2">
            {note.tlms.map((tlm, index) => (
              <Badge key={`${tlm}-${index}`} className="bg-amber-500/20 text-amber-200">
                {tlm}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {(note.resources || []).length > 0 && (
        <div className="space-y-3">
          <div className="text-xs uppercase tracking-[0.18em] text-white/40">
            External Resources
          </div>
          <div className="space-y-2">
            {note.resources.map((resource, index) => (
              <div
                key={`${resource.title}-${index}`}
                className="rounded-2xl border border-white/10 bg-white/5 p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-sm font-medium text-white">{resource.title}</div>
                  {resource.type && (
                    <Badge className="bg-white/10 text-white/60">{resource.type}</Badge>
                  )}
                </div>
                {resource.url ? (
                  <div className="mt-2 break-all text-sm text-sky-200">{resource.url}</div>
                ) : (
                  <div className="mt-2 text-sm text-white/40">No link attached</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function BodySection({ note }: { note: LessonNoteDetail }) {
  const body = note.body;
  if (!body) {
    return <EmptySection>No lesson body has been added yet.</EmptySection>;
  }

  if (isNaCCA3PhaseBody(body)) {
    return (
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="font-medium text-amber-100">Starter</div>
            <Badge className="bg-amber-500/20 text-amber-100">
              {body.starter?.timeMins || 10} mins
            </Badge>
          </div>
          <HtmlContent html={body.starter?.activities} fallback="No starter activity added." />
          {body.starter?.rpkPrompt && (
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-amber-100/70">RPK</div>
              <HtmlContent html={body.starter.rpkPrompt} />
            </div>
          )}
        </div>
        <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/10 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="font-medium text-indigo-100">Main Activity</div>
            <Badge className="bg-indigo-500/20 text-indigo-100">
              {body.main?.timeMins || 25} mins
            </Badge>
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-indigo-100/70">
              Teacher Activities
            </div>
            <HtmlContent
              html={body.main?.teacherActivities}
              fallback="No teacher activities added."
            />
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-indigo-100/70">
              Learner Activities
            </div>
            <HtmlContent
              html={body.main?.learnerActivities}
              fallback="No learner activities added."
            />
          </div>
        </div>
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="font-medium text-emerald-100">Plenary</div>
            <Badge className="bg-emerald-500/20 text-emerald-100">
              {body.plenary?.timeMins || 5} mins
            </Badge>
          </div>
          <HtmlContent
            html={body.plenary?.summaryPoints}
            fallback="No plenary summary added."
          />
          {body.plenary?.exitTicket && (
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-emerald-100/70">
                Exit Ticket
              </div>
              <HtmlContent html={body.plenary.exitTicket} />
            </div>
          )}
        </div>
      </div>
    );
  }

  if (isClassicJHSBody(body)) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-white/40">
              General Objective
            </div>
            <HtmlContent
              html={body.objectives?.general}
              fallback="No general objective added."
            />
          </div>
          {(body.objectives?.specific || []).length > 0 && (
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-[0.18em] text-white/40">
                Specific Objectives
              </div>
              <div className="space-y-2">
                {body.objectives?.specific.map((objective, index) => (
                  <div
                    key={`${objective}-${index}`}
                    className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/80"
                  >
                    {objective}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {body.presentationSteps?.map((step, index) => (
          <div
            key={`${step.stepTitle}-${index}`}
            className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="font-medium text-white">
                {step.stepTitle || `Step ${index + 1}`}
              </div>
              <Badge className="bg-white/10 text-white/60">{step.timeMins || 0} mins</Badge>
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-white/40">
                Teacher Activity
              </div>
              <HtmlContent html={step.teacherActivity} fallback="No teacher activity added." />
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-white/40">
                Learner Activity
              </div>
              <HtmlContent html={step.learnerActivity} fallback="No learner activity added." />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (isSimpleBody(body)) {
    return (
      <div className="space-y-4">
        {body.objectives && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-white/40">Objectives</div>
            <div className="mt-2">
              <HtmlContent html={body.objectives} />
            </div>
          </div>
        )}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-white/40">Content</div>
          <div className="mt-2">
            <HtmlContent html={body.content} fallback="No lesson content added." />
          </div>
        </div>
      </div>
    );
  }

  return <EmptySection>No lesson body has been added yet.</EmptySection>;
}

function AssessmentSection({ note }: { note: LessonNoteDetail }) {
  if (
    !(note.assessment?.inClassChecks || []).length &&
    !note.assessment?.exitTicket &&
    !note.assessment?.homework
  ) {
    return <EmptySection>No assessment details have been added yet.</EmptySection>;
  }

  return (
    <div className="space-y-4">
      {(note.assessment?.inClassChecks || []).length > 0 && (
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-[0.18em] text-white/40">
            In-class Checks
          </div>
          <div className="space-y-2">
            {note.assessment?.inClassChecks.map((check, index) => (
              <div
                key={`${check}-${index}`}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80"
              >
                {check}
              </div>
            ))}
          </div>
        </div>
      )}

      {note.assessment?.exitTicket && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-white/40">Exit Ticket</div>
          <div className="mt-2">
            <HtmlContent html={note.assessment.exitTicket} />
          </div>
        </div>
      )}

      {note.assessment?.homework && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-white/40">Homework</div>
          <div className="mt-2">
            <HtmlContent html={note.assessment.homework} />
          </div>
        </div>
      )}
    </div>
  );
}

function ReflectionsSection({ note }: { note: LessonNoteDetail }) {
  if (!note.reflections?.learner && !note.reflections?.teacher && !note.reflections?.nextLessonLink) {
    return <EmptySection>No reflections have been added yet.</EmptySection>;
  }

  return (
    <div className="space-y-4">
      {note.reflections?.learner && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-white/40">
            Learner Reflection
          </div>
          <div className="mt-2">
            <HtmlContent html={note.reflections.learner} />
          </div>
        </div>
      )}
      {note.reflections?.teacher && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-white/40">
            Teacher Reflection
          </div>
          <div className="mt-2">
            <HtmlContent html={note.reflections.teacher} />
          </div>
        </div>
      )}
      {note.reflections?.nextLessonLink && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-white/40">
            Link To Next Lesson
          </div>
          <div className="mt-2 text-sm text-white/80">{note.reflections.nextLessonLink}</div>
        </div>
      )}
    </div>
  );
}

function UnitPlannerSection({
  note,
  sectionKey,
}: {
  note: LessonNoteDetail;
  sectionKey: string;
}) {
  const templateDefinition = getTemplateDefinition(note.templateType);
  const section = templateDefinition?.unitSections?.find((item) => item.key === sectionKey);
  if (!section) {
    return <EmptySection>This section is not available for this lesson template.</EmptySection>;
  }

  const data = note.unitPlannerData || {};
  const hasValues = section.fields.some((field) => {
    const value = data[field.key];
    return typeof value === "string"
      ? value.trim().length > 0
      : Array.isArray(value)
      ? value.length > 0
      : Boolean(value);
  });

  if (!hasValues) {
    return <EmptySection>No content has been added to this section yet.</EmptySection>;
  }

  return (
    <div className="space-y-4">
      {section.fields.map((field) => {
        const value = data[field.key];
        if (!value) return null;

        if (Array.isArray(value) && value.length) {
          return (
            <div key={field.key} className="space-y-2">
              <div className="text-xs uppercase tracking-[0.18em] text-white/40">
                {field.label}
              </div>
              <div className="space-y-2">
                {value.map((entry, index) => (
                  <div
                    key={`${field.key}-${index}`}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80"
                  >
                    {typeof entry === "string"
                      ? entry
                      : typeof entry === "object" && entry !== null && "text" in entry
                      ? String((entry as { text?: string }).text || "")
                      : String(entry)}
                  </div>
                ))}
              </div>
            </div>
          );
        }

        return (
          <div key={field.key} className="space-y-2">
            <div className="text-xs uppercase tracking-[0.18em] text-white/40">
              {field.label}
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              {field.type === "richtext" ? (
                <HtmlContent html={String(value)} />
              ) : (
                <div className="text-sm text-white/80">{String(value)}</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function renderSectionBody(note: LessonNoteDetail, sectionKey: string) {
  switch (sectionKey) {
    case "context":
      return <ContextSection note={note} />;
    case "curriculum":
      return <CurriculumSection note={note} />;
    case "resources":
      return <ResourcesSection note={note} />;
    case "body":
      return <BodySection note={note} />;
    case "assessment":
      return <AssessmentSection note={note} />;
    case "reflections":
      return <ReflectionsSection note={note} />;
    default:
      return <UnitPlannerSection note={note} sectionKey={sectionKey} />;
  }
}

function getSectionIcon(sectionKey: string) {
  switch (sectionKey) {
    case "context":
      return <CalendarDays className="h-4 w-4" />;
    case "curriculum":
      return <Target className="h-4 w-4" />;
    case "resources":
      return <Package className="h-4 w-4" />;
    case "body":
      return <BookOpen className="h-4 w-4" />;
    case "assessment":
      return <ClipboardCheck className="h-4 w-4" />;
    case "reflections":
      return <UserSquare2 className="h-4 w-4" />;
    default:
      return <BookOpen className="h-4 w-4" />;
  }
}

export function LessonNoteReadonlyView({
  note,
  surfaceVariant = "default",
  headerActions,
  renderSectionActions,
  renderCommentActions,
  renderSectionFooter,
}: LessonNoteReadonlyViewProps) {
  const glass = surfaceVariant === "glass";
  const sections = getLessonNoteReviewSections(note);
  const commentsBySection = groupReviewCommentsBySection(note.reviewComments || []);

  return (
    <div className="space-y-6">
      <Card
        className={cn(
          glass
            ? GLASS_PANEL
            : "border border-white/10 bg-linear-to-br from-white/5 to-transparent shadow-lg shadow-black/20 backdrop-blur"
        )}
      >
        {glass ? (
          <>
            <div className="pointer-events-none absolute -right-16 top-0 h-48 w-48 rounded-full bg-sky-500/12 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-8 -left-10 h-40 w-40 rounded-full bg-blue-600/10 blur-3xl" />
          </>
        ) : null}
        <CardContent className={cn("p-6", glass && "relative z-1")}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-4">
              {glass ? (
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/70 backdrop-blur-sm">
                  <ClipboardCheck className="h-3.5 w-3.5 text-sky-200" />
                  Lesson note review
                </div>
              ) : null}
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="border border-indigo-400/20 bg-indigo-500/20 text-indigo-200">
                  {TEMPLATE_LABELS[note.templateType]}
                </Badge>
                <Badge
                  className={cn(
                    "text-white/70",
                    glass ? "border border-white/10 bg-white/8" : "bg-white/10"
                  )}
                >
                  {note.status}
                </Badge>
                <Badge className="border border-sky-400/20 bg-sky-500/15 text-sky-100">
                  {note.openCommentCount} open comment{note.openCommentCount === 1 ? "" : "s"}
                </Badge>
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-white">{note.topic}</h1>
                <p className="mt-2 text-sm text-white/60">
                  {note.className}
                  {note.subjectName ? ` • ${note.subjectName}` : ""}
                  {note.teacherName ? ` • ${note.teacherName}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-4 text-sm text-white/55">
                <span className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4" />
                  Week of {formatDateLabel(note.weekOf)}
                </span>
                <span className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  {note.durationMinutes ? `${note.durationMinutes} mins` : "No duration"}
                </span>
              </div>
              {glass ? (
                <p className="max-w-2xl text-sm leading-6 text-white/55">
                  Review sections, add comments, and track teacher responses. Use approval actions
                  for the whole note when it is ready to move forward.
                </p>
              ) : null}
            </div>
            {headerActions}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-5">
        {sections.map((section) => {
          const sectionComments = commentsBySection[section.key] || [];
          return (
            <SectionCard
              key={section.key}
              title={section.label}
              icon={getSectionIcon(section.key)}
              commentCount={sectionComments.length}
              actions={renderSectionActions?.(section, sectionComments)}
              glass={glass}
            >
              {renderSectionBody(note, section.key)}
              <CommentRail
                section={section}
                comments={sectionComments}
                glass={glass}
                renderCommentActions={renderCommentActions}
              />
              {renderSectionFooter?.(section, sectionComments)}
            </SectionCard>
          );
        })}
      </div>
    </div>
  );
}
