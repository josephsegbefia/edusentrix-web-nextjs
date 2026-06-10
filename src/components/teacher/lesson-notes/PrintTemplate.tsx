"use client";

import * as React from "react";
import { extractPlainText } from "@/components/ui/rich-text-editor";
import type {
  LessonNoteFormData,
  NaCCA3PhaseBody,
  ClassicJHSBody,
  SimpleBody,
  LessonNoteResource,
  CurriculumIndicator,
} from "@/types/lesson-notes";
import {
  isNaCCA3PhaseBody,
  isClassicJHSBody,
  isSimpleBody,
  TEMPLATE_LABELS,
  calculateTotalTime,
} from "@/types/lesson-notes";

// ============================================================================
// Types
// ============================================================================

interface PrintTemplateProps {
  formData: LessonNoteFormData;
  className?: string;
  subjectName?: string;
  schoolName?: string;
  schoolLogo?: string;
  teacherName?: string;
}

// ============================================================================
// Shared Styles
// ============================================================================

const styles = {
  page: "bg-white text-black p-8 font-serif text-sm print:p-4",
  header: "border-b-2 border-black pb-4 mb-6",
  schoolName: "text-xl font-bold text-center uppercase tracking-wide",
  title: "text-lg font-bold text-center mt-2",
  infoGrid: "grid grid-cols-2 gap-x-8 gap-y-1 text-sm mt-4",
  infoLabel: "font-semibold",
  infoValue: "text-gray-700",
  sectionTitle: "text-base font-bold uppercase bg-gray-100 px-3 py-2 border border-gray-300 mt-6 mb-3",
  subsectionTitle: "font-bold text-sm mb-2 mt-4",
  content: "text-sm leading-relaxed whitespace-pre-wrap",
  table: "w-full border-collapse border border-gray-300 text-sm",
  th: "border border-gray-300 bg-gray-100 px-3 py-2 text-left font-semibold",
  td: "border border-gray-300 px-3 py-2 align-top",
  list: "list-disc pl-5 space-y-1",
  badge: "inline-block bg-gray-200 px-2 py-0.5 rounded text-xs mr-1 mb-1",
  footer: "mt-8 pt-4 border-t border-gray-300 text-xs text-gray-500 text-center",
};

// ============================================================================
// Helper Components
// ============================================================================

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className={styles.sectionTitle}>{title}</h2>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <>
      <span className={styles.infoLabel}>{label}:</span>
      <span className={styles.infoValue}>{value}</span>
    </>
  );
}

function RichContent({ html }: { html?: string }) {
  if (!html) return <span className="text-gray-400 italic">Not provided</span>;
  // For print, we extract plain text or render HTML safely
  return (
    <div
      className={styles.content}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

// ============================================================================
// Header Component
// ============================================================================

function PrintHeader({
  schoolName,
  schoolLogo,
  formData,
  className,
  subjectName,
  teacherName,
}: {
  schoolName?: string;
  schoolLogo?: string;
  formData: LessonNoteFormData;
  className?: string;
  subjectName?: string;
  teacherName?: string;
}) {
  const formatDate = (date: Date) =>
    date.toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });

  const totalTime = calculateTotalTime(formData.body, formData.templateType);

  return (
    <div className={styles.header}>
      {schoolLogo && (
        <div className="flex justify-center mb-2">
          <img src={schoolLogo} alt="School Logo" className="h-16 object-contain" />
        </div>
      )}
      <h1 className={styles.schoolName}>{schoolName || "School Name"}</h1>
      <h2 className={styles.title}>
        LESSON NOTE - {TEMPLATE_LABELS[formData.templateType]}
      </h2>

      <div className={styles.infoGrid}>
        <InfoRow label="Subject" value={subjectName} />
        <InfoRow label="Class" value={className} />
        <InfoRow label="Week Of" value={formatDate(formData.weekOf)} />
        <InfoRow
          label="Period length"
          value={`${formData.durationMinutes || totalTime || "—"} minutes`}
        />
        <InfoRow label="Teacher" value={teacherName} />
        <InfoRow
          label="Date"
          value={formData.date ? formatDate(formData.date) : undefined}
        />
      </div>

      <div className="mt-4">
        <span className={styles.infoLabel}>Topic: </span>
        <span className="text-base font-semibold">{formData.topic}</span>
      </div>

      {formData.references[0] && (
        <div className="mt-1">
          <span className={styles.infoLabel}>Reference: </span>
          <span className={styles.infoValue}>{formData.references[0]}</span>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Curriculum Section
// ============================================================================

function CurriculumSection({ formData }: { formData: LessonNoteFormData }) {
  const { curriculum } = formData;
  if (!curriculum?.strand && !curriculum?.indicators?.length) return null;

  return (
    <Section title="Curriculum Alignment">
      <div className={styles.infoGrid}>
        <InfoRow label="Strand" value={curriculum.strand} />
        <InfoRow label="Sub-strand" value={curriculum.subStrand} />
      </div>
      {curriculum.contentStandard && (
        <div className="mt-2">
          <span className={styles.infoLabel}>Content Standard: </span>
          <span className={styles.infoValue}>{curriculum.contentStandard}</span>
        </div>
      )}
      {curriculum.indicators && curriculum.indicators.length > 0 && (
        <div className="mt-2">
          <span className={styles.infoLabel}>Indicators:</span>
          <ul className={styles.list}>
            {curriculum.indicators.map((ind: CurriculumIndicator, i: number) => (
              <li key={i}>
                <strong>{ind.refNo}</strong>: {ind.text}
              </li>
            ))}
          </ul>
        </div>
      )}
      {curriculum.learningOutcomes && curriculum.learningOutcomes.length > 0 && (
        <div className="mt-2">
          <span className={styles.infoLabel}>Learning Outcomes:</span>
          <ul className={styles.list}>
            {curriculum.learningOutcomes.map((outcome: string, i: number) => (
              <li key={i}>{outcome}</li>
            ))}
          </ul>
        </div>
      )}
    </Section>
  );
}

// ============================================================================
// Resources Section
// ============================================================================

function ResourcesSection({ formData }: { formData: LessonNoteFormData }) {
  if (!formData.tlms?.length && !formData.resources?.length) return null;

  return (
    <Section title="Teaching & Learning Materials">
      {formData.tlms && formData.tlms.length > 0 && (
        <div className="mb-2">
          {formData.tlms.map((tlm: string, i: number) => (
            <span key={i} className={styles.badge}>
              {tlm}
            </span>
          ))}
        </div>
      )}
      {formData.resources && formData.resources.length > 0 && (
        <div className="mt-2">
          <span className={styles.infoLabel}>External Resources:</span>
          <ul className={styles.list}>
            {formData.resources.map((res: LessonNoteResource, i: number) => (
              <li key={i}>
                {res.title} - <span className="text-gray-500">{res.url}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Section>
  );
}

// ============================================================================
// NaCCA 3-Phase Template
// ============================================================================

function NaCCA3PhaseTemplate({ body }: { body: NaCCA3PhaseBody }) {
  return (
    <>
      <Section title="Starter Phase">
        <table className={styles.table}>
          <tbody>
            <tr>
              <td className={styles.td} style={{ width: "25%" }}>
                <strong>Time:</strong> {body.starter?.timeMins || 10} minutes
              </td>
              <td className={styles.td}>
                <strong>Activities:</strong>
                <RichContent html={body.starter?.activities} />
              </td>
            </tr>
            <tr>
              <td className={styles.td} colSpan={2}>
                <strong>Review of Previous Knowledge (RPK):</strong>
                <RichContent html={body.starter?.rpkPrompt} />
              </td>
            </tr>
            <tr>
              <td className={styles.td} colSpan={2}>
                <strong>Engagement Hook:</strong>
                <RichContent html={body.starter?.engagementHook} />
              </td>
            </tr>
          </tbody>
        </table>
      </Section>

      <Section title="Main Activity">
        <table className={styles.table}>
          <tbody>
            <tr>
              <td className={styles.td} style={{ width: "25%" }}>
                <strong>Time:</strong> {body.main?.timeMins || 25} minutes
              </td>
              <td className={styles.td}>
                <strong>Resources:</strong> {body.main?.resourcesUsed || "—"}
              </td>
            </tr>
          </tbody>
        </table>
        <table className={styles.table + " mt-2"}>
          <thead>
            <tr>
              <th className={styles.th} style={{ width: "50%" }}>
                Teacher Activities
              </th>
              <th className={styles.th} style={{ width: "50%" }}>
                Learner Activities
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className={styles.td}>
                <RichContent html={body.main?.teacherActivities} />
              </td>
              <td className={styles.td}>
                <RichContent html={body.main?.learnerActivities} />
              </td>
            </tr>
          </tbody>
        </table>
        {body.main?.embeddedAssessment && (
          <div className="mt-2">
            <strong>Embedded Assessment:</strong>
            <RichContent html={body.main.embeddedAssessment} />
          </div>
        )}
        {body.main?.differentiation && (
          <div className="mt-2">
            <strong>Differentiation:</strong>
            <RichContent html={body.main.differentiation} />
          </div>
        )}
      </Section>

      <Section title="Plenary / Reflection">
        <table className={styles.table}>
          <tbody>
            <tr>
              <td className={styles.td} style={{ width: "25%" }}>
                <strong>Time:</strong> {body.plenary?.timeMins || 5} minutes
              </td>
              <td className={styles.td}>
                <strong>Summary Points:</strong>
                <RichContent html={body.plenary?.summaryPoints} />
              </td>
            </tr>
            <tr>
              <td className={styles.td} colSpan={2}>
                <strong>Learner Reflection:</strong>
                <RichContent html={body.plenary?.learnerReflection} />
              </td>
            </tr>
            {body.plenary?.exitTicket && (
              <tr>
                <td className={styles.td} colSpan={2}>
                  <strong>Exit Ticket:</strong> {body.plenary.exitTicket}
                </td>
              </tr>
            )}
            {body.plenary?.homework && (
              <tr>
                <td className={styles.td} colSpan={2}>
                  <strong>Homework:</strong> {body.plenary.homework}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Section>
    </>
  );
}

// ============================================================================
// Classic JHS Template
// ============================================================================

function ClassicJHSTemplate({ body }: { body: ClassicJHSBody }) {
  return (
    <>
      <Section title="Objectives">
        <div className="mb-2">
          <strong>General Objective:</strong>
          <p className={styles.content}>{body.objectives?.general || "—"}</p>
        </div>
        {body.objectives?.specific && body.objectives.specific.length > 0 && (
          <div>
            <strong>Specific Objectives:</strong>
            <ol className="list-decimal pl-5 space-y-1">
              {body.objectives.specific.map((obj: string, i: number) => (
                <li key={i}>{obj}</li>
              ))}
            </ol>
          </div>
        )}
      </Section>

      <Section title="Relevant Previous Knowledge (RPK)">
        <RichContent html={body.rpk} />
      </Section>

      {body.introduction && (
        <Section title="Introduction">
          <RichContent html={body.introduction} />
        </Section>
      )}

      <Section title="Presentation Steps">
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.th} style={{ width: "15%" }}>
                Step
              </th>
              <th className={styles.th} style={{ width: "10%" }}>
                Time
              </th>
              <th className={styles.th} style={{ width: "37.5%" }}>
                Teacher Activity
              </th>
              <th className={styles.th} style={{ width: "37.5%" }}>
                Learner Activity
              </th>
            </tr>
          </thead>
          <tbody>
            {body.presentationSteps?.map((step, i) => (
              <tr key={i}>
                <td className={styles.td}>
                  <strong>{step.stepTitle}</strong>
                </td>
                <td className={styles.td}>{step.timeMins} min</td>
                <td className={styles.td}>
                  <RichContent html={step.teacherActivity} />
                  {step.boardWork && (
                    <div className="mt-2 text-xs">
                      <strong>Board Work:</strong> {step.boardWork}
                    </div>
                  )}
                </td>
                <td className={styles.td}>
                  <RichContent html={step.learnerActivity} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      {body.corePoints && body.corePoints.length > 0 && (
        <Section title="Core Points / Board Summary">
          <ul className={styles.list}>
            {body.corePoints.map((point: string, i: number) => (
              <li key={i}>{point}</li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Evaluation">
        {body.evaluation?.questions && body.evaluation.questions.length > 0 && (
          <ol className="list-decimal pl-5 space-y-1">
            {body.evaluation.questions.map((q: string, i: number) => (
              <li key={i}>{q}</li>
            ))}
          </ol>
        )}
        {body.evaluation?.markingNotes && (
          <div className="mt-2 text-xs text-gray-500">
            <strong>Marking Notes:</strong> {body.evaluation.markingNotes}
          </div>
        )}
      </Section>

      {body.remarks && (
        <Section title="Remarks">
          <RichContent html={body.remarks} />
        </Section>
      )}
    </>
  );
}

// ============================================================================
// Simple Template
// ============================================================================

function SimpleTemplate({ body }: { body: SimpleBody }) {
  return (
    <>
      {body.objectives && (
        <Section title="Learning Objectives">
          <RichContent html={body.objectives} />
        </Section>
      )}

      <Section title="Lesson Content">
        <RichContent html={body.content} />
      </Section>
    </>
  );
}

// ============================================================================
// Assessment Section
// ============================================================================

function AssessmentSection({ formData }: { formData: LessonNoteFormData }) {
  const { assessment } = formData;
  if (!assessment?.inClassChecks?.length && !assessment?.exitTicket && !assessment?.homework) {
    return null;
  }

  return (
    <Section title="Assessment">
      {assessment.inClassChecks && assessment.inClassChecks.length > 0 && (
        <div className="mb-2">
          <strong>In-class Checks:</strong>
          <ol className="list-decimal pl-5 space-y-1">
            {assessment.inClassChecks.map((check: string, i: number) => (
              <li key={i}>{check}</li>
            ))}
          </ol>
        </div>
      )}
      {assessment.exitTicket && (
        <div className="mb-2">
          <strong>Exit Ticket:</strong> {assessment.exitTicket}
        </div>
      )}
      {assessment.homework && (
        <div>
          <strong>Homework:</strong>
          <RichContent html={assessment.homework} />
        </div>
      )}
    </Section>
  );
}

// ============================================================================
// Reflections Section
// ============================================================================

function ReflectionsSection({ formData }: { formData: LessonNoteFormData }) {
  const { reflections } = formData;
  if (!reflections?.learner && !reflections?.teacher && !reflections?.nextLessonLink) {
    return null;
  }

  return (
    <Section title="Reflections (Post-Lesson)">
      {reflections.learner && (
        <div className="mb-2">
          <strong>Learner Reflection:</strong>
          <RichContent html={reflections.learner} />
        </div>
      )}
      {reflections.teacher && (
        <div className="mb-2">
          <strong>Teacher Reflection:</strong>
          <RichContent html={reflections.teacher} />
        </div>
      )}
      {reflections.nextLessonLink && (
        <div>
          <strong>Link to Next Lesson:</strong> {reflections.nextLessonLink}
        </div>
      )}
    </Section>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function PrintTemplate({
  formData,
  className,
  subjectName,
  schoolName,
  schoolLogo,
  teacherName,
}: PrintTemplateProps) {
  return (
    <div className={styles.page}>
      <PrintHeader
        schoolName={schoolName}
        schoolLogo={schoolLogo}
        formData={formData}
        className={className}
        subjectName={subjectName}
        teacherName={teacherName}
      />

      <CurriculumSection formData={formData} />
      <ResourcesSection formData={formData} />

      {/* Body - Template specific */}
      {isNaCCA3PhaseBody(formData.body) && (
        <NaCCA3PhaseTemplate body={formData.body} />
      )}
      {isClassicJHSBody(formData.body) && (
        <ClassicJHSTemplate body={formData.body} />
      )}
      {isSimpleBody(formData.body) && <SimpleTemplate body={formData.body} />}

      <AssessmentSection formData={formData} />
      <ReflectionsSection formData={formData} />

      <div className={styles.footer}>
        Generated by EduSentrix • {new Date().toLocaleDateString("en-GB")}
      </div>
    </div>
  );
}

export default PrintTemplate;
