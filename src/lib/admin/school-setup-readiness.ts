import "server-only";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { ClassGroup } from "@/models/ClassGroup";
import { Teacher } from "@/models/Teacher";
import { Student } from "@/models/Student";
import { Subject } from "@/models/Subject";
import { FeeStructure } from "@/models/FeeStructure";
import { SchoolSettings } from "@/models/SchoolSettings";
import { School, type ISchool } from "@/models/School";
import type {
  SchoolSetupReadinessResult,
  SetupReadinessItem,
} from "@/types/admin/setup-readiness";

export type { SchoolSetupReadinessResult, SetupReadinessItem };

function pct(done: number, total: number) {
  if (total <= 0) return 100;
  return Math.round((done / total) * 100);
}

function buildCoachMessage(incomplete: SetupReadinessItem[]): string {
  if (incomplete.length === 0) {
    return "Great work — your core setup checklist looks complete. Revisit any section anytime if your policies change.";
  }
  const blocking = incomplete.filter((i) => i.priority === "blocking");
  const first = blocking[0] || incomplete[0];
  const also = incomplete
    .filter((i) => i.id !== first.id)
    .slice(0, 2)
    .map((i) => i.title.toLowerCase());
  const tail =
    also.length > 0
      ? ` After that, plan for ${also.join(" and ")}.`
      : "";
  return `Hi — I'm Leo. I'd tackle "${first.title}" first so day-to-day operations stay smooth.${tail}`;
}

export async function getSchoolSetupReadiness(
  schoolId: string | mongoose.Types.ObjectId
): Promise<SchoolSetupReadinessResult> {
  await connectToDatabase();
  const schoolIdObj =
    schoolId instanceof mongoose.Types.ObjectId
      ? schoolId
      : new mongoose.Types.ObjectId(String(schoolId));

  const [
    currentPeriod,
    classGroupCount,
    teacherCount,
    studentCount,
    subjectCount,
    feeStructureCount,
    settingsLean,
    schoolLean,
  ] = await Promise.all([
    AcademicPeriod.findOne({
      schoolId: schoolIdObj,
      isCurrent: true,
    })
      .select("_id")
      .lean(),
    ClassGroup.countDocuments({ schoolId: schoolIdObj, isActive: true }),
    Teacher.countDocuments({ schoolId: schoolIdObj, status: "active" }),
    Student.countDocuments({ schoolId: schoolIdObj }),
    Subject.countDocuments({ schoolId: schoolIdObj }),
    FeeStructure.countDocuments({ schoolId: schoolIdObj, isActive: true }),
    SchoolSettings.findOne({ schoolId: schoolIdObj })
      .select("createdAt updatedAt gradeScheduleOverrides dailyScheduleOverrides breakGradeOverrides")
      .lean() as Promise<{
      createdAt?: Date;
      updatedAt?: Date;
      gradeScheduleOverrides?: unknown[];
      dailyScheduleOverrides?: unknown[];
      breakGradeOverrides?: unknown[];
    } | null>,
    School.findById(schoolIdObj).select("billing").lean() as Promise<
      Pick<ISchool, "billing"> & { _id: mongoose.Types.ObjectId }
    > | null,
  ]);

  const hasPeriod = !!currentPeriod;
  const hasClasses = classGroupCount > 0;
  const hasTeachers = teacherCount > 0;
  const hasStudents = studentCount > 0;
  const hasSubjects = subjectCount > 0;
  const hasFeeStructures = feeStructureCount > 0;

  let scheduleLooksReviewed = false;
  if (settingsLean) {
    const created = settingsLean.createdAt
      ? new Date(settingsLean.createdAt).getTime()
      : 0;
    const updated = settingsLean.updatedAt
      ? new Date(settingsLean.updatedAt).getTime()
      : 0;
    const hasOverrides =
      (settingsLean.gradeScheduleOverrides?.length ?? 0) > 0 ||
      (settingsLean.dailyScheduleOverrides?.length ?? 0) > 0 ||
      (settingsLean.breakGradeOverrides?.length ?? 0) > 0;
    scheduleLooksReviewed =
      hasOverrides || (updated > 0 && created > 0 && updated - created > 5000);
  }

  const payStatus = schoolLean?.billing?.paymentSetup?.status;
  const paystackReady = !!schoolLean?.billing?.paystack?.subaccountCode;
  const paymentsProvisioned =
    paystackReady ||
    payStatus === "provisioned" ||
    payStatus === "details_submitted" ||
    payStatus === "pending_provisioning";

  const items: SetupReadinessItem[] = [
    {
      id: "academic_period",
      title: "Current academic period",
      description: "Set the active term or year so assignments, fees, and reports line up.",
      done: hasPeriod,
      priority: "blocking",
      href: "/admin/periods",
      ctaLabel: "Manage periods",
    },
    {
      id: "class_groups",
      title: "Class groups",
      description: "Create streams or sections so students and teachers can be placed.",
      done: hasClasses,
      priority: "blocking",
      href: "/admin/classes",
      ctaLabel: "Classes",
    },
    {
      id: "subjects",
      title: "Subjects",
      description: "Ensure subjects exist for your curriculum and class assignments.",
      done: hasSubjects,
      priority: "high",
      href: "/admin/subjects",
      ctaLabel: "Subjects",
    },
    {
      id: "teachers",
      title: "Teaching staff",
      description: "Add teachers and assign them to classes where needed.",
      done: hasTeachers,
      priority: "high",
      href: "/admin/teachers",
      ctaLabel: "Teachers",
    },
    {
      id: "students",
      title: "Students",
      description: "Enrol learners and assign them to class groups.",
      done: hasStudents,
      priority: "high",
      href: "/admin/students",
      ctaLabel: "Students",
    },
    {
      id: "fee_structures",
      title: "Fee structures",
      description: "Define fee types (tuition, levies, etc.) before invoicing.",
      done: hasFeeStructures,
      priority: "high",
      href: "/admin/fees/structures",
      ctaLabel: "Fee structures",
    },
    {
      id: "payments",
      title: "Payment collection",
      description: "Complete Paystack / billing setup so families can pay online.",
      done: paymentsProvisioned,
      priority: "medium",
      href: "/admin/settings/payment-setup",
      ctaLabel: "Payment setup",
    },
    {
      id: "daily_schedule",
      title: "Daily schedule",
      description: "Confirm school start and end times, periods, breaks, and assembly.",
      done: scheduleLooksReviewed,
      priority: "medium",
      href: "/admin/settings?tab=schedule",
      ctaLabel: "School settings",
    },
  ];

  const doneCount = items.filter((i) => i.done).length;
  const incomplete = items.filter((i) => !i.done);
  return {
    items,
    completionPercent: pct(doneCount, items.length),
    incompleteCount: incomplete.length,
    coachMessage: buildCoachMessage(incomplete),
  };
}
