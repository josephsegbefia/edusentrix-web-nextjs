"use client";

import * as React from "react";
import type {
  ReportCardViewData,
  ReportCardViewScoreComponent,
  ReportCardViewSubjectRow,
} from "@/types/academics/report-card-view";

function formatScore(value: number) {
  return Number.isFinite(value) ? value.toFixed(1) : "—";
}

function SubjectGradesTable({
  scoreComponents,
  subjects,
}: {
  scoreComponents: ReportCardViewScoreComponent[];
  subjects: ReportCardViewSubjectRow[];
}) {
  return (
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr className="bg-gray-50 border-b border-gray-200">
          <th className="text-left p-2 font-semibold">Subject</th>
          {scoreComponents.map((component) => (
            <th key={component.key} className="text-center p-2 font-semibold">
              {component.label}
            </th>
          ))}
          <th className="text-center p-2 font-semibold">Total</th>
          <th className="text-center p-2 font-semibold">Grade</th>
          <th className="text-left p-2 font-semibold">Remark</th>
        </tr>
      </thead>
      <tbody>
        {subjects.map((subject) => (
          <tr
            key={`${subject.subjectId ?? subject.subjectName}`}
            className={`border-b border-gray-100 ${!subject.isPassed ? "text-red-600" : ""}`}
          >
            <td className="p-2">{subject.subjectName}</td>
            {scoreComponents.map((component) => {
              const score = subject.componentScores.find(
                (entry) => entry.componentKey === component.key
              );
              return (
                <td key={component.key} className="text-center p-2">
                  {score ? formatScore(score.weightedScore) : "—"}
                </td>
              );
            })}
            <td className="text-center p-2 font-semibold">
              {formatScore(subject.roundedFinalScore)}
            </td>
            <td className="text-center p-2 font-bold">{subject.gradeLabel}</td>
            <td className="p-2 text-gray-600">{subject.subjectRemark ?? "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function AttendanceSection({ data }: { data: NonNullable<ReportCardViewData["attendance"]> }) {
  if (!data.ready) {
    return (
      <p className="text-sm text-gray-500">
        {data.message ?? "Attendance snapshot is not available for this report."}
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
      <div className="rounded-lg bg-gray-50 p-3">
        <p className="text-xs uppercase tracking-wide text-gray-500">School days</p>
        <p className="mt-1 text-lg font-semibold">{data.totalSchoolDays ?? 0}</p>
      </div>
      <div className="rounded-lg bg-gray-50 p-3">
        <p className="text-xs uppercase tracking-wide text-gray-500">Present</p>
        <p className="mt-1 text-lg font-semibold">{data.daysPresent ?? 0}</p>
      </div>
      <div className="rounded-lg bg-gray-50 p-3">
        <p className="text-xs uppercase tracking-wide text-gray-500">Absent</p>
        <p className="mt-1 text-lg font-semibold">{data.daysAbsent ?? 0}</p>
      </div>
      <div className="rounded-lg bg-gray-50 p-3">
        <p className="text-xs uppercase tracking-wide text-gray-500">Late</p>
        <p className="mt-1 text-lg font-semibold">{data.daysLate ?? 0}</p>
      </div>
      <div className="rounded-lg bg-gray-50 p-3">
        <p className="text-xs uppercase tracking-wide text-gray-500">Excused</p>
        <p className="mt-1 text-lg font-semibold">{data.daysExcused ?? 0}</p>
      </div>
      <div className="rounded-lg bg-gray-50 p-3">
        <p className="text-xs uppercase tracking-wide text-gray-500">Attendance rate</p>
        <p className="mt-1 text-lg font-semibold">
          {formatScore(data.attendancePercentage ?? 0)}%
        </p>
      </div>
    </div>
  );
}

export function ReportCardView({ data }: { data: ReportCardViewData }) {
  const enabledSections = data.template.sections
    .filter((section) => section.enabled)
    .sort((a, b) => a.order - b.order);

  return (
    <div className="mx-auto max-w-[210mm] bg-white text-black print:shadow-none shadow-xl print:border-0 border border-gray-200">
      {data.source === "snapshot" ? (
        <div className="border-b border-emerald-100 bg-emerald-50 px-6 py-2 text-center text-xs font-medium uppercase tracking-wide text-emerald-700 print:hidden">
          Official released snapshot
        </div>
      ) : null}

      {enabledSections.map((section) => {
        switch (section.type) {
          case "header":
            return (
              <div key={`${section.type}-${section.order}`} className="bg-slate-800 text-white p-8 text-center">
                {data.school.logo ? (
                  <img
                    src={data.school.logo}
                    alt=""
                    className="mx-auto h-16 w-16 rounded-full object-cover mb-3"
                  />
                ) : null}
                <h1 className="text-2xl font-bold tracking-wide">{data.school.name}</h1>
                {data.school.motto ? (
                  <p className="mt-1 text-sm text-white/70 italic">{data.school.motto}</p>
                ) : null}
                {data.school.address ? (
                  <p className="text-sm text-white/70 mt-1">
                    {data.school.address}
                    {data.school.city ? `, ${data.school.city}` : ""}
                    {data.school.region ? ` - ${data.school.region}` : ""}
                  </p>
                ) : null}
                <div className="mt-3 inline-block rounded-full bg-white/10 px-4 py-1 text-sm">
                  {data.template.name}
                </div>
              </div>
            );

          case "student_info":
            return (
              <div
                key={`${section.type}-${section.order}`}
                className="p-6 border-b border-gray-200 grid grid-cols-2 gap-4 text-sm"
              >
                <div>
                  <span className="text-gray-500 text-xs uppercase tracking-wide">Student Name</span>
                  <p className="font-semibold">{data.student.name}</p>
                </div>
                {data.grade ? (
                  <div>
                    <span className="text-gray-500 text-xs uppercase tracking-wide">Grade / Year</span>
                    <p className="font-semibold">{data.grade.name}</p>
                  </div>
                ) : null}
                {data.classGroup ? (
                  <div>
                    <span className="text-gray-500 text-xs uppercase tracking-wide">Class</span>
                    <p className="font-semibold">
                      {data.classGroup.label ?? data.classGroup.name}
                    </p>
                  </div>
                ) : null}
                <div>
                  <span className="text-gray-500 text-xs uppercase tracking-wide">
                    Academic Period
                  </span>
                  <p className="font-semibold">
                    {data.period.yearLabel} — {data.period.term}
                  </p>
                </div>
                {data.student.admissionNo ? (
                  <div>
                    <span className="text-gray-500 text-xs uppercase tracking-wide">
                      Admission No.
                    </span>
                    <p className="font-semibold">{data.student.admissionNo}</p>
                  </div>
                ) : null}
                {data.verificationId ? (
                  <div>
                    <span className="text-gray-500 text-xs uppercase tracking-wide">
                      Verification ID
                    </span>
                    <p className="font-semibold">{data.verificationId}</p>
                  </div>
                ) : null}
              </div>
            );

          case "subject_grades":
            return (
              <div key={`${section.type}-${section.order}`} className="p-6">
                <h3 className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-3">
                  {section.label}
                </h3>
                {data.subjects.length === 0 ? (
                  <p className="text-sm text-gray-500">No subject results on this report.</p>
                ) : (
                  <SubjectGradesTable
                    scoreComponents={data.scoreComponents}
                    subjects={data.subjects}
                  />
                )}
              </div>
            );

          case "criteria_detail":
            return data.subjects.some((subject) => subject.componentScores.length > 0) ? (
              <div key={`${section.type}-${section.order}`} className="p-6 border-t border-gray-200">
                <h3 className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-3">
                  {section.label}
                </h3>
                {data.subjects.map((subject) => (
                  <div key={`detail-${subject.subjectName}`} className="mb-4">
                    <h4 className="text-sm font-semibold mb-1">{subject.subjectName}</h4>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {subject.componentScores.map((component) => (
                        <div
                          key={`${subject.subjectName}-${component.componentKey}`}
                          className="flex justify-between bg-gray-50 rounded p-2"
                        >
                          <span>{component.label}</span>
                          <span className="font-semibold">
                            {formatScore(component.rawScore)}/{formatScore(component.rawMaxScore)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : null;

          case "descriptor_levels":
            return (
              <div key={`${section.type}-${section.order}`} className="p-6 border-t border-gray-200">
                <h3 className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-3">
                  {section.label}
                </h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {data.subjects.map((subject) => (
                    <div
                      key={`descriptor-${subject.subjectName}`}
                      className="flex justify-between bg-gray-50 rounded-lg p-3"
                    >
                      <span>{subject.subjectName}</span>
                      <span className="font-bold">
                        {subject.descriptor ?? subject.gradeLabel}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );

          case "term_summary":
            if (!data.summary) return null;
            return (
              <div key={`${section.type}-${section.order}`} className="p-6 border-t border-gray-200">
                <h3 className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-3">
                  {section.label}
                </h3>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="text-2xl font-bold">
                      {formatScore(data.summary.averageFinalScore)}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">Average Score</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="text-2xl font-bold">{data.summary.subjectCount}</div>
                    <div className="text-xs text-gray-500 mt-1">Subjects</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="text-2xl font-bold">{data.summary.passedSubjectCount}</div>
                    <div className="text-xs text-gray-500 mt-1">Passed</div>
                  </div>
                </div>
              </div>
            );

          case "class_position":
            if (
              !data.template.showClassPosition ||
              data.summary?.classPosition == null ||
              data.summary.totalStudents == null
            ) {
              return null;
            }
            return (
              <div
                key={`${section.type}-${section.order}`}
                className="p-6 border-t border-gray-200 text-center"
              >
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
            return (
              <div key={`${section.type}-${section.order}`} className="p-6 border-t border-gray-200">
                <h3 className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-2">
                  {section.label}
                </h3>
                <div className="min-h-16 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
                  {data.comments?.homeroomComment ??
                    (data.comments?.ready
                      ? "No class teacher comment recorded."
                      : "Class teacher comment pending.")}
                </div>
              </div>
            );

          case "head_teacher_comments":
            return (
              <div key={`${section.type}-${section.order}`} className="p-6 border-t border-gray-200">
                <h3 className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-2">
                  {section.label}
                </h3>
                <div className="min-h-16 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
                  {data.comments?.headteacherComment ??
                    (data.comments?.ready
                      ? "No headteacher comment recorded."
                      : "Headteacher comment pending.")}
                </div>
              </div>
            );

          case "parent_signature":
            return (
              <div
                key={`${section.type}-${section.order}`}
                className="p-6 border-t border-gray-200 grid grid-cols-2 gap-6"
              >
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
            if (!data.template.showGradingKey || !data.gradingPolicy?.gradeBoundaries.length) {
              return null;
            }
            return (
              <div key={`${section.type}-${section.order}`} className="p-6 border-t border-gray-200">
                <h3 className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-3">
                  {section.label}
                </h3>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  {data.gradingPolicy.gradeBoundaries.map((boundary) => (
                    <div
                      key={`${boundary.gradeLabel}-${boundary.minPercentage}`}
                      className="flex items-center justify-between bg-gray-50 rounded p-2"
                    >
                      <span className="font-bold">{boundary.gradeLabel}</span>
                      <span className="text-gray-500">
                        {boundary.minPercentage}–{boundary.maxPercentage}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );

          case "conduct":
            if (!data.template.showConduct) return null;
            return (
              <div key={`${section.type}-${section.order}`} className="p-6 border-t border-gray-200">
                <h3 className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-2">
                  {section.label}
                </h3>
                <div className="h-12 border border-dashed border-gray-300 rounded-lg" />
              </div>
            );

          case "attendance":
            if (!data.template.showAttendance) return null;
            return (
              <div key={`${section.type}-${section.order}`} className="p-6 border-t border-gray-200">
                <h3 className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-3">
                  {section.label}
                </h3>
                {data.attendance ? (
                  <AttendanceSection data={data.attendance} />
                ) : (
                  <p className="text-sm text-gray-500">Attendance summary not included.</p>
                )}
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

export type { ReportCardViewData };
