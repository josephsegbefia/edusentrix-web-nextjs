import mongoose from "mongoose";
import {
  buildLegacyReportCardViewData,
  buildStudentReportCardViewData,
} from "@/lib/academics/reporting/build-student-report-card-view";
import {
  findStudentReportCard,
  loadStudentReportCardViewContext,
} from "@/lib/academics/reporting/load-student-report-card";
import type { StudentReportCardStatus } from "@/types/academics/assessment-engine";
import type { ReportCardViewData } from "@/types/academics/report-card-view";

export async function resolveStudentReportCardViewData(input: {
  schoolId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  academicPeriodId?: mongoose.Types.ObjectId | null;
  statuses?: StudentReportCardStatus[];
  studentReportCardId?: mongoose.Types.ObjectId | null;
}): Promise<ReportCardViewData | null> {
  const card = await findStudentReportCard(input);
  if (!card) return null;

  const context = await loadStudentReportCardViewContext(card);
  return buildStudentReportCardViewData(card, context);
}

export { buildLegacyReportCardViewData, buildStudentReportCardViewData };
