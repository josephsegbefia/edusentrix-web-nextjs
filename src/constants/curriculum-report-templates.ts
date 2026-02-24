import type { IReportSection } from "@/models/ReportTemplate";
import type { CurriculumCode } from "./curriculum-profiles";

export interface ReportTemplatePreset {
  name: string;
  orientation: "portrait" | "landscape";
  showClassPosition: boolean;
  showAttendance: boolean;
  showConduct: boolean;
  showGradingKey: boolean;
  sections: IReportSection[];
}

const GHANA_SECTIONS: IReportSection[] = [
  { type: "header", label: "School Header", enabled: true, order: 1 },
  { type: "student_info", label: "Student Information", enabled: true, order: 2 },
  { type: "attendance", label: "Attendance Record", enabled: true, order: 3 },
  { type: "subject_grades", label: "Subject Grades", enabled: true, order: 4 },
  { type: "assessment_breakdown", label: "CA / Exam Breakdown", enabled: true, order: 5 },
  { type: "term_summary", label: "Term Summary", enabled: true, order: 6 },
  { type: "class_position", label: "Class Position", enabled: true, order: 7 },
  { type: "conduct", label: "Conduct & Attitude", enabled: true, order: 8 },
  { type: "teacher_comments", label: "Class Teacher Remarks", enabled: true, order: 9 },
  { type: "head_teacher_comments", label: "Head Teacher Remarks", enabled: true, order: 10 },
  { type: "parent_signature", label: "Parent Signature", enabled: true, order: 11 },
  { type: "grading_key", label: "Grading Key", enabled: true, order: 12 },
];

const CAMBRIDGE_SECTIONS: IReportSection[] = [
  { type: "header", label: "School Header", enabled: true, order: 1 },
  { type: "student_info", label: "Student Information", enabled: true, order: 2 },
  { type: "attendance", label: "Attendance", enabled: true, order: 3 },
  { type: "subject_grades", label: "Subject Grades", enabled: true, order: 4 },
  { type: "teacher_comments", label: "Subject Teacher Comments", enabled: true, order: 5 },
  { type: "term_summary", label: "Overall Performance", enabled: true, order: 6 },
  { type: "head_teacher_comments", label: "Head of School Remarks", enabled: true, order: 7 },
  { type: "grading_key", label: "Grade Descriptors", enabled: true, order: 8 },
  { type: "parent_signature", label: "Parent Acknowledgement", enabled: true, order: 9 },
];

const IB_PYP_SECTIONS: IReportSection[] = [
  { type: "header", label: "School Header", enabled: true, order: 1 },
  { type: "student_info", label: "Student Profile", enabled: true, order: 2 },
  { type: "descriptor_levels", label: "Learner Profile Development", enabled: true, order: 3 },
  { type: "subject_grades", label: "Subject Areas", enabled: true, order: 4 },
  { type: "teacher_comments", label: "Homeroom Teacher Narrative", enabled: true, order: 5 },
  { type: "custom", label: "Approaches to Learning", enabled: true, order: 6, config: { type: "atl_ratings" } },
  { type: "head_teacher_comments", label: "Principal Comments", enabled: true, order: 7 },
  { type: "parent_signature", label: "Parent Response", enabled: true, order: 8 },
];

const IB_MYP_SECTIONS: IReportSection[] = [
  { type: "header", label: "School Header", enabled: true, order: 1 },
  { type: "student_info", label: "Student Information", enabled: true, order: 2 },
  { type: "subject_grades", label: "Subject Achievement Levels", enabled: true, order: 3 },
  { type: "criteria_detail", label: "Criteria Breakdown", enabled: true, order: 4 },
  { type: "teacher_comments", label: "Subject Teacher Comments", enabled: true, order: 5 },
  { type: "term_summary", label: "Overall Summary", enabled: true, order: 6 },
  { type: "custom", label: "Approaches to Learning", enabled: true, order: 7, config: { type: "atl_ratings" } },
  { type: "head_teacher_comments", label: "Coordinator Comments", enabled: true, order: 8 },
  { type: "grading_key", label: "MYP Grade Boundaries", enabled: true, order: 9 },
  { type: "parent_signature", label: "Parent Acknowledgement", enabled: true, order: 10 },
];

const BRITISH_NC_SECTIONS: IReportSection[] = [
  { type: "header", label: "School Header", enabled: true, order: 1 },
  { type: "student_info", label: "Pupil Information", enabled: true, order: 2 },
  { type: "attendance", label: "Attendance Record", enabled: true, order: 3 },
  { type: "descriptor_levels", label: "Attainment Levels", enabled: true, order: 4 },
  { type: "subject_grades", label: "Subject Reports", enabled: true, order: 5 },
  { type: "teacher_comments", label: "Class Teacher Comments", enabled: true, order: 6 },
  { type: "head_teacher_comments", label: "Headteacher Comments", enabled: true, order: 7 },
  { type: "grading_key", label: "Assessment Key", enabled: true, order: 8 },
  { type: "parent_signature", label: "Parent Comment", enabled: true, order: 9 },
];

const AMERICAN_SECTIONS: IReportSection[] = [
  { type: "header", label: "School Header", enabled: true, order: 1 },
  { type: "student_info", label: "Student Information", enabled: true, order: 2 },
  { type: "attendance", label: "Attendance Summary", enabled: true, order: 3 },
  { type: "subject_grades", label: "Academic Grades", enabled: true, order: 4 },
  { type: "term_summary", label: "GPA Summary", enabled: true, order: 5, config: { showGpa: true, showHonorRoll: true } },
  { type: "teacher_comments", label: "Teacher Comments", enabled: true, order: 6 },
  { type: "conduct", label: "Behavior & Citizenship", enabled: true, order: 7 },
  { type: "head_teacher_comments", label: "Principal Remarks", enabled: true, order: 8 },
  { type: "grading_key", label: "Grading Scale", enabled: true, order: 9 },
  { type: "parent_signature", label: "Parent Signature", enabled: true, order: 10 },
];

export const REPORT_TEMPLATE_PRESETS: Record<CurriculumCode, ReportTemplatePreset> = {
  ghana_nacca: {
    name: "Ghana NaCCA Report Card",
    orientation: "portrait",
    showClassPosition: true,
    showAttendance: true,
    showConduct: true,
    showGradingKey: true,
    sections: GHANA_SECTIONS,
  },
  cambridge: {
    name: "Cambridge School Report",
    orientation: "portrait",
    showClassPosition: false,
    showAttendance: true,
    showConduct: false,
    showGradingKey: true,
    sections: CAMBRIDGE_SECTIONS,
  },
  ib_pyp: {
    name: "IB PYP Progress Report",
    orientation: "portrait",
    showClassPosition: false,
    showAttendance: false,
    showConduct: false,
    showGradingKey: false,
    sections: IB_PYP_SECTIONS,
  },
  ib_myp: {
    name: "IB MYP Report Card",
    orientation: "portrait",
    showClassPosition: false,
    showAttendance: true,
    showConduct: false,
    showGradingKey: true,
    sections: IB_MYP_SECTIONS,
  },
  british_nc: {
    name: "End of Term Report",
    orientation: "portrait",
    showClassPosition: false,
    showAttendance: true,
    showConduct: false,
    showGradingKey: true,
    sections: BRITISH_NC_SECTIONS,
  },
  american: {
    name: "Report Card",
    orientation: "portrait",
    showClassPosition: false,
    showAttendance: true,
    showConduct: true,
    showGradingKey: true,
    sections: AMERICAN_SECTIONS,
  },
  hybrid: {
    name: "Custom Report Card",
    orientation: "portrait",
    showClassPosition: true,
    showAttendance: true,
    showConduct: true,
    showGradingKey: true,
    sections: GHANA_SECTIONS,
  },
};

export function getReportTemplatePreset(code: CurriculumCode): ReportTemplatePreset {
  return REPORT_TEMPLATE_PRESETS[code] ?? REPORT_TEMPLATE_PRESETS.ghana_nacca;
}
