import "server-only";

import mongoose, { type Types } from "mongoose";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { ClassGroup } from "@/models/ClassGroup";
import { FeeStructure } from "@/models/FeeStructure";
import { Grade } from "@/models/Grade";
import { Guardian } from "@/models/Guardian";
import { School } from "@/models/School";
import { Student } from "@/models/Student";
import { SubjectOffering } from "@/models/SubjectOffering";
import { Teacher } from "@/models/Teacher";
import { UserMembership } from "@/models/UserMembership";
import { isSchoolPaymentReady } from "@/lib/school-payments/payment-setup";

export type SchoolSetupProgressItem = {
  key: string;
  label: string;
  complete: boolean;
  detail: string;
};

export type SchoolSetupProgress = {
  percent: number;
  completed: number;
  total: number;
  items: SchoolSetupProgressItem[];
};

export async function getSchoolSetupProgress(
  schoolId: string | Types.ObjectId
): Promise<SchoolSetupProgress> {
  const schoolObjectId =
    typeof schoolId === "string" ? new mongoose.Types.ObjectId(schoolId) : schoolId;

  const [
    school,
    academicPeriodCount,
    gradeCount,
    classGroupCount,
    subjectOfferingCount,
    schoolAdminCount,
    teacherCount,
    studentCount,
    studentIds,
    feeStructureCount,
  ] = await Promise.all([
    School.findById(schoolObjectId)
      .select("name email city region bank billing")
      .lean(),
    AcademicPeriod.countDocuments({ schoolId: schoolObjectId }),
    Grade.countDocuments({ schoolId: schoolObjectId }),
    ClassGroup.countDocuments({ schoolId: schoolObjectId }),
    SubjectOffering.countDocuments({ schoolId: schoolObjectId, isActive: true }),
    UserMembership.countDocuments({
      schoolId: schoolObjectId,
      roles: "school_admin",
      status: { $in: ["active", "invited"] },
    }),
    Teacher.countDocuments({ schoolId: schoolObjectId }),
    Student.countDocuments({ schoolId: schoolObjectId }),
    Student.find({ schoolId: schoolObjectId }).select("_id").lean<Array<{ _id: Types.ObjectId }>>(),
    FeeStructure.countDocuments({ schoolId: schoolObjectId }),
  ]);

  const guardianCount = studentIds.length
    ? await Guardian.countDocuments({ studentId: { $in: studentIds.map((student) => student._id) } })
    : 0;

  const profileComplete = Boolean(
    school?.name?.trim() &&
      school?.email?.trim() &&
      school?.city?.trim() &&
      school?.region?.trim()
  );
  const paymentReady = school ? isSchoolPaymentReady(school) : false;

  const items: SchoolSetupProgressItem[] = [
    {
      key: "profile",
      label: "School profile",
      complete: profileComplete,
      detail: profileComplete ? "Profile has core contact details" : "Add email, city, and region",
    },
    {
      key: "academic_calendar",
      label: "Academic calendar",
      complete: academicPeriodCount > 0,
      detail: academicPeriodCount > 0 ? `${academicPeriodCount} academic period(s)` : "Create terms or periods",
    },
    {
      key: "grades",
      label: "Grades",
      complete: gradeCount > 0,
      detail: gradeCount > 0 ? `${gradeCount} grade(s)` : "Create grade levels",
    },
    {
      key: "class_groups",
      label: "Class groups",
      complete: classGroupCount > 0,
      detail: classGroupCount > 0 ? `${classGroupCount} class group(s)` : "Create class groups",
    },
    {
      key: "subject_offerings",
      label: "Subject offerings",
      complete: subjectOfferingCount > 0,
      detail: subjectOfferingCount > 0 ? `${subjectOfferingCount} offering(s)` : "Set up subject offerings",
    },
    {
      key: "admins",
      label: "School admins",
      complete: schoolAdminCount > 0,
      detail: schoolAdminCount > 0 ? `${schoolAdminCount} admin account(s)` : "Create at least one school admin",
    },
    {
      key: "teachers",
      label: "Teachers",
      complete: teacherCount > 0,
      detail: teacherCount > 0 ? `${teacherCount} teacher profile(s)` : "Add teachers",
    },
    {
      key: "students",
      label: "Students",
      complete: studentCount > 0,
      detail: studentCount > 0 ? `${studentCount} student record(s)` : "Add or import students",
    },
    {
      key: "guardians",
      label: "Parent links",
      complete: guardianCount > 0,
      detail: guardianCount > 0 ? `${guardianCount} guardian link(s)` : "Link parents or guardians",
    },
    {
      key: "fees",
      label: "Fees",
      complete: feeStructureCount > 0,
      detail: feeStructureCount > 0 ? `${feeStructureCount} fee structure(s)` : "Create fee structures",
    },
    {
      key: "payments",
      label: "Payment setup",
      complete: paymentReady,
      detail: paymentReady ? "School settlement is ready" : "Complete payout setup",
    },
  ];

  const completed = items.filter((item) => item.complete).length;
  return {
    percent: Math.round((completed / items.length) * 100),
    completed,
    total: items.length,
    items,
  };
}
