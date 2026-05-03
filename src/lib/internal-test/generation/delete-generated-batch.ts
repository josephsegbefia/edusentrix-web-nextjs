import "server-only";

import mongoose from "mongoose";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { ClassGroup } from "@/models/ClassGroup";
import { FeeStructure } from "@/models/FeeStructure";
import { Grade } from "@/models/Grade";
import { Guardian } from "@/models/Guardian";
import { InternalTestGeneratedRecord } from "@/models/InternalTestGeneratedRecord";
import { Invoice } from "@/models/Invoice";
import { InvoiceLineItem } from "@/models/InvoiceLineItem";
import { Notice } from "@/models/Notice";
import { AIFeatureUsageEvent } from "@/models/AIFeatureUsageEvent";
import { AcademicCalendar } from "@/models/AcademicCalendar";
import { CommunityPoll } from "@/models/CommunityPoll";
import { Curriculum } from "@/models/Curriculum";
import { CurriculumSubject } from "@/models/CurriculumSubject";
import { FundraisingCampaign } from "@/models/FundraisingCampaign";
import { Meeting } from "@/models/Meeting";
import { SchemeItem } from "@/models/SchemeItem";
import { SchemeOfWork } from "@/models/SchemeOfWork";
import { StoreProduct } from "@/models/StoreProduct";
import { UsageMetric } from "@/models/UsageMetric";
import { Vendor } from "@/models/Vendor";
import { Payment } from "@/models/Payment";
import { PaymentAllocation } from "@/models/PaymentAllocation";
import { Student } from "@/models/Student";
import { Subject } from "@/models/Subject";
import { Teacher } from "@/models/Teacher";
import { TeacherAssignment } from "@/models/TeacherAssignment";
import { User } from "@/models/User";
import { UserMembership } from "@/models/UserMembership";

/** Reverse dependency order (spec §19.3, adapted to registry). */
const DELETE_ORDER: string[] = [
  "PaymentAllocation",
  "Payment",
  "InvoiceLineItem",
  "Invoice",
  "FeeStructure",
  "Notice",
  "SchemeItem",
  "SchemeOfWork",
  "CommunityPoll",
  "FundraisingCampaign",
  "Meeting",
  "AcademicCalendar",
  "Vendor",
  "StoreProduct",
  "AIFeatureUsageEvent",
  "UsageMetric",
  "CurriculumSubject",
  "Curriculum",
  "TeacherAssignment",
  "Guardian",
  "Student",
  "Teacher",
  "UserMembership",
  "User",
  "Subject",
  "ClassGroup",
  "Grade",
  "AcademicPeriod",
];

const COLLECTION_TO_MODEL = {
  PaymentAllocation,
  Payment,
  InvoiceLineItem,
  Invoice,
  FeeStructure,
  Notice,
  SchemeItem,
  SchemeOfWork,
  CommunityPoll,
  FundraisingCampaign,
  Meeting,
  AcademicCalendar,
  Vendor,
  StoreProduct,
  AIFeatureUsageEvent,
  UsageMetric,
  CurriculumSubject,
  Curriculum,
  TeacherAssignment,
  Guardian,
  Student,
  Teacher,
  UserMembership,
  User,
  Subject,
  ClassGroup,
  Grade,
  AcademicPeriod,
} as Record<string, mongoose.Model<unknown>>;

export async function deleteGeneratedBatch(params: {
  schoolId: mongoose.Types.ObjectId;
  testDataBatchId: string;
}): Promise<{ deletedByCollection: Record<string, number> }> {
  const rows = await InternalTestGeneratedRecord.find({
    schoolId: params.schoolId,
    testDataBatchId: params.testDataBatchId,
  }).lean();

  const byCollection = new Map<string, mongoose.Types.ObjectId[]>();
  for (const r of rows) {
    const id = r.documentId as mongoose.Types.ObjectId;
    const list = byCollection.get(r.collectionName) ?? [];
    list.push(id);
    byCollection.set(r.collectionName, list);
  }

  const deletedByCollection: Record<string, number> = {};

  for (const col of DELETE_ORDER) {
    const ids = byCollection.get(col);
    if (!ids?.length) continue;
    const Model = COLLECTION_TO_MODEL[col];
    if (!Model) continue;
    const res = await Model.deleteMany({ _id: { $in: ids } });
    deletedByCollection[col] = res.deletedCount ?? 0;
  }

  await InternalTestGeneratedRecord.deleteMany({
    schoolId: params.schoolId,
    testDataBatchId: params.testDataBatchId,
  });

  return { deletedByCollection };
}
