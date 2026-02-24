"use client";

import * as React from "react";

interface SubjectRow {
  subjectName: string;
  subjectCode: string;
  category: string | null;
  caTotal: number;
  caMaxTotal: number;
  caPercentage: number;
  examScore: number;
  examMaxScore: number;
  examPercentage: number;
  totalScore: number;
  gradeLetter: string;
  gradePoint: number;
  isPassed: boolean;
  components: Array<{
    label: string;
    score: number;
    maxScore: number;
    percentage: number;
    weight: number;
  }>;
  descriptorLevel: string | null;
}

interface GradeMapping {
  letter: string;
  minPercentage: number;
  maxPercentage: number;
  point: number;
  description?: string | null;
}

interface ReportSection {
  type: string;
  label: string;
  enabled: boolean;
  order: number;
}

interface ReportData {
  school: {
    name: string;
    logo?: string;
    address?: string;
    city?: string;
    region?: string;
  };
  student: {
    firstName: string;
    lastName: string;
    admissionNumber?: string;
    gesIndexNumber?: string;
  };
  grade: { name: string; stage: string } | null;
  classGroup: { name: string } | null;
  period: { yearLabel: string; term: string };
  curriculum: {
    code: string;
    label: string;
    assessmentModel: string;
    gradingSystem: string;
  };
  subjects: SubjectRow[];
  summary: {
    totalSubjects: number;
    totalScore: number;
    averageScore: number;
    classPosition: number | null;
    totalStudents: number | null;
    performanceTier: string | null;
    gpa: number | null;
    isPromoted: boolean | null;
  } | null;
  gradingScale: {
    name: string;
    mappings: GradeMapping[];
    caWeight: number;
    examWeight: number;
  } | null;
  template: {
    name: string;
    sections: ReportSection[];
    showClassPosition: boolean;
    showAttendance: boolean;
    showConduct: boolean;
    showGradingKey: boolean;
    orientation: string;
    paperSize: string;
  };
}

export function ReportCardView({ data }: { data: ReportData }) {
  const enabledSections = data.template.sections
    .filter((s) => s.enabled)
    .sort((a, b) => a.order - b.order);

  const isCaExam = data.curriculum.assessmentModel === "ca_exam";
  const isCriteria = data.curriculum.assessmentModel === "criteria_rubric";
  const isDescriptive =
    data.curriculum.assessmentModel === "standards_based" ||
    data.curriculum.assessmentModel === "portfolio";

  return (
    <div className="mx-auto max-w-[210mm] bg-white text-black print:shadow-none shadow-xl print:border-0 border border-gray-200">
      {enabledSections.map((section) => {
        switch (section.type) {
          case "header":
            return (
              <div key={section.type} className="bg-slate-800 text-white p-8 text-center">
                {data.school.logo && (
                  <img
                    src={data.school.logo}
                    alt=""
                    className="mx-auto h-16 w-16 rounded-full object-cover mb-3"
                  />
                )}
                <h1 className="text-2xl font-bold tracking-wide">
                  {data.school.name}
                </h1>
                {data.school.address && (
                  <p className="text-sm text-white/70 mt-1">
                    {data.school.address}
                    {data.school.city && `, ${data.school.city}`}
                    {data.school.region && ` - ${data.school.region}`}
                  </p>
                )}
                <div className="mt-3 inline-block rounded-full bg-white/10 px-4 py-1 text-sm">
                  {data.template.name}
                </div>
              </div>
            );

          case "student_info":
            return (
              <div key={section.type} className="p-6 border-b border-gray-200 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500 text-xs uppercase tracking-wide">
                    Student Name
                  </span>
                  <p className="font-semibold">
                    {data.student.firstName} {data.student.lastName}
                  </p>
                </div>
                {data.grade && (
                  <div>
                    <span className="text-gray-500 text-xs uppercase tracking-wide">
                      Grade / Year
                    </span>
                    <p className="font-semibold">{data.grade.name}</p>
                  </div>
                )}
                {data.classGroup && (
                  <div>
                    <span className="text-gray-500 text-xs uppercase tracking-wide">
                      Class
                    </span>
                    <p className="font-semibold">{data.classGroup.name}</p>
                  </div>
                )}
                <div>
                  <span className="text-gray-500 text-xs uppercase tracking-wide">
                    Academic Period
                  </span>
                  <p className="font-semibold">
                    {data.period.yearLabel} — {data.period.term}
                  </p>
                </div>
                {data.student.admissionNumber && (
                  <div>
                    <span className="text-gray-500 text-xs uppercase tracking-wide">
                      Admission No.
                    </span>
                    <p className="font-semibold">
                      {data.student.admissionNumber}
                    </p>
                  </div>
                )}
              </div>
            );

          case "subject_grades":
            return (
              <div key={section.type} className="p-6">
                <h3 className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-3">
                  {section.label}
                </h3>
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left p-2 font-semibold">Subject</th>
                      {isCaExam && (
                        <>
                          <th className="text-center p-2 font-semibold">CA</th>
                          <th className="text-center p-2 font-semibold">Exam</th>
                        </>
                      )}
                      <th className="text-center p-2 font-semibold">
                        {isDescriptive ? "Level" : "Total"}
                      </th>
                      <th className="text-center p-2 font-semibold">Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.subjects.map((sub, i) => (
                      <tr
                        key={i}
                        className={`border-b border-gray-100 ${!sub.isPassed ? "text-red-600" : ""}`}
                      >
                        <td className="p-2">
                          {sub.subjectName}
                          {sub.category && (
                            <span className="ml-1 text-[10px] text-gray-400 uppercase">
                              ({sub.category})
                            </span>
                          )}
                        </td>
                        {isCaExam && (
                          <>
                            <td className="text-center p-2">
                              {sub.caTotal}/{sub.caMaxTotal}
                            </td>
                            <td className="text-center p-2">
                              {sub.examScore}/{sub.examMaxScore}
                            </td>
                          </>
                        )}
                        <td className="text-center p-2 font-semibold">
                          {isDescriptive
                            ? sub.descriptorLevel || sub.gradeLetter
                            : sub.totalScore.toFixed(1)}
                        </td>
                        <td className="text-center p-2 font-bold">
                          {sub.gradeLetter}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );

          case "criteria_detail":
            if (!isCriteria) return null;
            return (
              <div key={section.type} className="p-6 border-t border-gray-200">
                <h3 className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-3">
                  {section.label}
                </h3>
                {data.subjects
                  .filter((s) => s.components && s.components.length > 0)
                  .map((sub, i) => (
                    <div key={i} className="mb-4">
                      <h4 className="text-sm font-semibold mb-1">
                        {sub.subjectName}
                      </h4>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {sub.components.map((c, j) => (
                          <div
                            key={j}
                            className="flex justify-between bg-gray-50 rounded p-2"
                          >
                            <span>{c.label}</span>
                            <span className="font-semibold">
                              {c.score}/{c.maxScore}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            );

          case "descriptor_levels":
            if (!isDescriptive) return null;
            return (
              <div key={section.type} className="p-6 border-t border-gray-200">
                <h3 className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-3">
                  {section.label}
                </h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {data.subjects.map((sub, i) => (
                    <div
                      key={i}
                      className="flex justify-between bg-gray-50 rounded-lg p-3"
                    >
                      <span>{sub.subjectName}</span>
                      <span className="font-bold">
                        {sub.descriptorLevel || sub.gradeLetter}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );

          case "term_summary":
            if (!data.summary) return null;
            return (
              <div key={section.type} className="p-6 border-t border-gray-200">
                <h3 className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-3">
                  {section.label}
                </h3>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="text-2xl font-bold">
                      {data.summary.averageScore.toFixed(1)}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Average Score
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="text-2xl font-bold">
                      {data.summary.totalSubjects}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">Subjects</div>
                  </div>
                  {data.summary.gpa != null && (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="text-2xl font-bold">
                        {data.summary.gpa.toFixed(2)}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">GPA</div>
                    </div>
                  )}
                </div>
              </div>
            );

          case "class_position":
            if (!data.template.showClassPosition || !data.summary?.classPosition)
              return null;
            return (
              <div key={section.type} className="p-6 border-t border-gray-200 text-center">
                <h3 className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-2">
                  {section.label}
                </h3>
                <p className="text-3xl font-bold">
                  {data.summary.classPosition}
                  <span className="text-base text-gray-400 font-normal">
                    {" "}
                    / {data.summary.totalStudents}
                  </span>
                </p>
              </div>
            );

          case "teacher_comments":
          case "head_teacher_comments":
            return (
              <div key={section.type} className="p-6 border-t border-gray-200">
                <h3 className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-2">
                  {section.label}
                </h3>
                <div className="h-16 border border-dashed border-gray-300 rounded-lg" />
              </div>
            );

          case "parent_signature":
            return (
              <div key={section.type} className="p-6 border-t border-gray-200 grid grid-cols-2 gap-6">
                <div>
                  <div className="h-12 border-b border-gray-300 mb-1" />
                  <p className="text-xs text-gray-400">Parent/Guardian Signature</p>
                </div>
                <div>
                  <div className="h-12 border-b border-gray-300 mb-1" />
                  <p className="text-xs text-gray-400">Date</p>
                </div>
              </div>
            );

          case "grading_key":
            if (!data.template.showGradingKey || !data.gradingScale) return null;
            return (
              <div key={section.type} className="p-6 border-t border-gray-200">
                <h3 className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-3">
                  {section.label}
                </h3>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  {data.gradingScale.mappings.map((m, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between bg-gray-50 rounded p-2"
                    >
                      <span className="font-bold">{m.letter}</span>
                      <span className="text-gray-500">
                        {m.minPercentage}–{m.maxPercentage}%
                      </span>
                      {m.description && (
                        <span className="text-gray-400">{m.description}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );

          case "conduct":
          case "attendance":
            if (
              (section.type === "conduct" && !data.template.showConduct) ||
              (section.type === "attendance" && !data.template.showAttendance)
            )
              return null;
            return (
              <div key={section.type} className="p-6 border-t border-gray-200">
                <h3 className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-2">
                  {section.label}
                </h3>
                <div className="h-12 border border-dashed border-gray-300 rounded-lg" />
              </div>
            );

          case "custom":
            return (
              <div key={`${section.type}-${section.order}`} className="p-6 border-t border-gray-200">
                <h3 className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-2">
                  {section.label}
                </h3>
                <div className="h-16 border border-dashed border-gray-300 rounded-lg flex items-center justify-center text-xs text-gray-400">
                  Custom section
                </div>
              </div>
            );

          default:
            return null;
        }
      })}
    </div>
  );
}
