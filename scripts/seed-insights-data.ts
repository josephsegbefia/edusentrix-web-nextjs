/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * seed-insights-data.ts
 *
 * Generates comprehensive test data for the AI Insights tab:
 * - SubjectGrade records for the CURRENT academic period
 * - TermResult records for the CURRENT academic period
 * - TeacherComment records for the CURRENT academic period
 * - StudentAttendance records (homeroom) for the CURRENT academic period
 * - Invoice records for the CURRENT academic period
 * - Payment records linked to invoices
 *
 * Usage:
 *   npx tsx scripts/seed-insights-data.ts --schoolId <SCHOOL_ID>
 *   npx tsx scripts/seed-insights-data.ts --schoolId <SCHOOL_ID> --dryRun
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import mongoose from "mongoose";
import connectToDatabase, {
  disconnectDatabase,
} from "../src/db/connectToDatabase";
import { School } from "../src/models/School";
import { Student } from "../src/models/Student";
import { ClassGroup } from "../src/models/ClassGroup";
import { Subject } from "../src/models/Subject";
import { Grade } from "../src/models/Grade";
import { AcademicPeriod } from "../src/models/AcademicPeriod";
import { SubjectGrade } from "../src/models/SubjectGrade";
import { TermResult } from "../src/models/TermResult";
import { TeacherComment } from "../src/models/TeacherComment";
import { Teacher } from "../src/models/Teacher";
import { StudentAttendance } from "../src/models/StudentAttendance";
import { Invoice } from "../src/models/Invoice";
import { Payment } from "../src/models/Payment";
import { GradingScale, type IGradingScale } from "../src/models/GradingScale";
import { resolveGradingScaleLetter } from "../src/lib/academics/calculateGrades";

const argv = yargs(hideBin(process.argv))
  .option("mongo", {
    type: "string",
    describe: "MongoDB connection string (overrides MONGODB_URI)",
  })
  .option("dryRun", {
    type: "boolean",
    default: false,
    describe: "Validate only; do not write to DB",
  })
  .option("schoolId", {
    type: "string",
    describe: "School ID",
    demandOption: true,
  })
  .help()
  .parseSync();

// ─── Helpers ───

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number): number {
  return Number((Math.random() * (max - min) + min).toFixed(1));
}

type Tier = "top" | "above_average" | "average" | "at_risk";

function assignStudentTier(): Tier {
  const r = Math.random();
  if (r < 0.15) return "top";
  if (r < 0.40) return "above_average";
  if (r < 0.75) return "average";
  return "at_risk";
}

function generateScores(tier: Tier) {
  const ranges: Record<Tier, [number, number, number, number]> = {
    top: [78, 95, 80, 98],
    above_average: [65, 82, 65, 85],
    average: [50, 70, 48, 72],
    at_risk: [30, 55, 25, 55],
  };
  const [caMin, caMax, exMin, exMax] = ranges[tier];
  const ca = randomFloat(caMin, caMax);
  const ex = randomFloat(exMin, exMax);
  const total = Number((ca * 0.3 + ex * 0.7).toFixed(1));
  return { caPercentage: ca, examPercentage: ex, totalScore: total };
}

function getSchoolDays(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  const d = new Date(start);
  const cutoff = end < new Date() ? end : new Date();
  while (d <= cutoff) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) days.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

const COMMENT_TEMPLATES: Record<string, string[]> = {
  subject: [
    "Demonstrates strong understanding of core concepts and applies them well.",
    "Needs consistent practice to improve performance in this subject.",
    "Shows remarkable improvement compared to last term. Keep it up!",
    "Struggles with exam-type questions but does well in class assessments.",
    "An attentive student who participates actively during lessons.",
    "Should spend more time revising for exams. CA performance is much better.",
    "Excellent work ethic — always submits assignments on time.",
    "Has potential but needs to focus more during practical sessions.",
  ],
  general: [
    "A diligent student who consistently puts in effort across all subjects.",
    "Shows great promise — with more discipline, can reach the top of the class.",
    "Has been distracted this term. Needs parental support to stay focused.",
    "A well-rounded student who balances academics and extracurriculars well.",
    "Quiet but hardworking. Should build confidence to ask questions in class.",
    "Leadership potential evident — often helps classmates with difficult topics.",
    "Needs to improve time management, especially during examinations.",
    "A pleasure to teach. Curious mind and always eager to learn more.",
  ],
  behavior: [
    "Well-mannered and respectful to both teachers and classmates.",
    "Shows excellent leadership qualities and is a positive influence on peers.",
    "Occasionally disruptive in class but responds well to correction.",
    "Punctual and well-organized. A model student in terms of conduct.",
    "Needs to work on self-control during group activities.",
    "Very helpful and kind to others. A joy to have in the classroom.",
  ],
};

// ─── Main ───

async function main() {
  await connectToDatabase(argv.mongo || undefined);

  if (!mongoose.Types.ObjectId.isValid(argv.schoolId)) {
    console.error("Invalid schoolId");
    process.exit(1);
  }

  const schoolId = new mongoose.Types.ObjectId(argv.schoolId);
  const school = await School.findById(schoolId);
  if (!school) {
    console.error(`School not found: ${argv.schoolId}`);
    process.exit(1);
  }

  console.log(`\n🏫 School: ${school.name} (${schoolId})`);
  if (argv.dryRun) console.log("   🔍 DRY RUN MODE\n");

  // ── 1. Find the current academic period ──
  let currentPeriod = await AcademicPeriod.findOne({
    schoolId,
    isCurrent: true,
  });

  if (!currentPeriod) {
    console.log("⚠ No current academic period found. Creating one...");
    if (!argv.dryRun) {
      currentPeriod = await AcademicPeriod.create({
        schoolId,
        yearLabel: "2025/2026",
        term: "2nd Term",
        startDate: new Date("2026-01-06"),
        endDate: new Date("2026-04-10"),
        isCurrent: true,
      });
    } else {
      console.log("   [DRY] Would create 2025/2026 – 2nd Term");
    }
  }

  const periodId = currentPeriod?._id;
  const periodLabel = currentPeriod
    ? `${currentPeriod.yearLabel} – ${currentPeriod.term}`
    : "2025/2026 – 2nd Term";
  console.log(`📅 Current period: ${periodLabel}\n`);

  if (!periodId && !argv.dryRun) {
    console.error("Failed to resolve academic period");
    process.exit(1);
  }

  // ── 2. Find JHS students ──
  const jhsGrades = await Grade.find({
    schoolId,
    code: { $in: ["JHS1", "JHS2", "JHS3"] },
  }).lean();

  const jhsGradeIds = jhsGrades.map((g) => g._id);
  console.log(
    `📚 JHS grades found: ${jhsGrades.map((g) => g.name).join(", ") || "NONE"}`
  );

  if (jhsGradeIds.length === 0) {
    console.error(
      "No JHS grades found. Run seed:jhs first:\n  npx tsx scripts/seed-jhs-classes.ts --schoolId " +
        argv.schoolId
    );
    process.exit(1);
  }

  const students = await Student.find({
    schoolId,
    gradeId: { $in: jhsGradeIds },
    status: "active",
  })
    .select("_id firstName lastName classGroupId gradeId")
    .lean();

  console.log(`👥 JHS students: ${students.length}`);
  if (students.length === 0) {
    console.error("No JHS students found. Run seed:jhs first.");
    process.exit(1);
  }

  // ── 3. Subjects + class groups + teachers ──
  const classGroupIds = [
    ...new Set(students.map((s) => s.classGroupId?.toString())),
  ].filter(Boolean);
  const classGroups = await ClassGroup.find({
    _id: { $in: classGroupIds },
  })
    .select("_id name gradeId subjectIds")
    .lean();
  const classGroupMap = new Map(
    classGroups.map((cg) => [cg._id.toString(), cg])
  );

  const allSubjectIds = new Set<string>();
  classGroups.forEach((cg) =>
    (cg.subjectIds || []).forEach((sid: any) =>
      allSubjectIds.add(sid.toString())
    )
  );
  const subjects = await Subject.find({
    _id: { $in: Array.from(allSubjectIds) },
  })
    .select("_id name")
    .lean();
  const subjectMap = new Map(subjects.map((s) => [s._id.toString(), s]));
  console.log(`📖 Subjects: ${subjects.length}`);

  const teachers = await Teacher.find({ schoolId, status: "active" })
    .select("_id subjectIds")
    .lean();

  const teacherBySubject = new Map<string, any>();
  for (const t of teachers) {
    for (const sid of t.subjectIds || []) {
      teacherBySubject.set(sid.toString(), t);
    }
  }
  // Fallback teacher
  const fallbackTeacher = teachers[0];
  console.log(`👨‍🏫 Teachers: ${teachers.length}`);

  // ── 4. Grading scale ──
  const gradingScale = (await GradingScale.findOne({
    schoolId,
    isDefault: true,
  }).lean()) as IGradingScale | null;

  if (!gradingScale) {
    console.error("No grading scale found. Run seed:academics first.");
    process.exit(1);
  }

  // ── 5. School days for attendance ──
  const termStart = currentPeriod?.startDate ?? new Date("2026-01-06");
  const termEnd = currentPeriod?.endDate ?? new Date("2026-04-10");
  const schoolDays = getSchoolDays(termStart, termEnd);
  console.log(`📆 School days this term: ${schoolDays.length}\n`);

  // ── Batch arrays ──
  const bulkSubjectGrades: any[] = [];
  const bulkTermResults: any[] = [];
  const bulkComments: any[] = [];
  const bulkAttendance: any[] = [];
  const bulkInvoices: any[] = [];
  const bulkPayments: any[] = [];

  // ── Pre-fetch existing records to avoid N+1 queries ──
  console.log("  Checking existing records...");

  const existingSGSet = new Set(
    (
      await SubjectGrade.find(
        { schoolId, academicPeriodId: periodId },
        { studentId: 1, subjectId: 1 }
      ).lean()
    ).map(
      (sg: any) => `${sg.studentId.toString()}_${sg.subjectId.toString()}`
    )
  );

  const existingTRSet = new Set(
    (
      await TermResult.find(
        { schoolId, academicPeriodId: periodId },
        { studentId: 1 }
      ).lean()
    ).map((tr: any) => tr.studentId.toString())
  );

  const existingCommentStudents = new Set(
    (
      await TeacherComment.find(
        { schoolId, academicPeriodId: periodId },
        { studentId: 1 }
      ).lean()
    ).map((tc: any) => tc.studentId.toString())
  );

  const existingAttendanceStudents = new Set(
    (
      await StudentAttendance.find(
        { schoolId, academicPeriodId: periodId, type: "homeroom" },
        { studentId: 1 }
      ).lean()
    ).map((a: any) => a.studentId.toString())
  );

  const existingInvoiceStudents = new Set(
    (
      await Invoice.find(
        { schoolId, academicPeriodId: periodId },
        { studentId: 1 }
      ).lean()
    ).map((i: any) => i.studentId.toString())
  );

  console.log("  ✓ Pre-fetch complete\n");

  // ── 6. Build bulk data in memory ──
  const recorderBy =
    fallbackTeacher?._id ?? new mongoose.Types.ObjectId();

  for (const student of students) {
    const sId = student._id.toString();
    const cg = classGroupMap.get(student.classGroupId?.toString() ?? "");
    if (!cg) continue;

    const studentSubjectIds: string[] = (cg.subjectIds || []).map((s: any) =>
      s.toString()
    );
    const tier = assignStudentTier();

    // ── 6a. SubjectGrades ──
    const sgScores: number[] = [];

    for (const subjectIdStr of studentSubjectIds) {
      const subject = subjectMap.get(subjectIdStr);
      if (!subject) continue;

      if (existingSGSet.has(`${sId}_${subjectIdStr}`)) continue;

      const teacher =
        teacherBySubject.get(subjectIdStr) || fallbackTeacher;
      if (!teacher) continue;

      const { caPercentage, examPercentage, totalScore } =
        generateScores(tier);
      const caMaxTotal = 30;
      const caTotal = Number(((caPercentage / 100) * caMaxTotal).toFixed(1));
      const examMaxScore = 70;
      const examScore = Number(
        ((examPercentage / 100) * examMaxScore).toFixed(1)
      );
      const mapping = resolveGradingScaleLetter(totalScore, gradingScale);

      bulkSubjectGrades.push({
        schoolId,
        academicPeriodId: periodId,
        subjectId: new mongoose.Types.ObjectId(subjectIdStr),
        studentId: student._id,
        teacherId: teacher._id,
        caTotal,
        caMaxTotal,
        caPercentage,
        examScore,
        examMaxScore,
        examPercentage,
        totalScore,
        gradeLetter: mapping?.letter ?? "F",
        gradePoint: mapping?.point ?? 0,
        isPassed: totalScore >= 50,
        lastUpdated: new Date(),
      });
      sgScores.push(totalScore);
    }

    // ── 6b. TermResult ──
    if (!existingTRSet.has(sId) && sgScores.length > 0) {
      const avg = Number(
        (sgScores.reduce((a, b) => a + b, 0) / sgScores.length).toFixed(2)
      );
      const cgStudents = students.filter(
        (s) => s.classGroupId?.toString() === cg._id.toString()
      );
      const position = randomInt(1, cgStudents.length);
      const perfTier: Tier =
        avg >= 80
          ? "top"
          : avg >= 65
            ? "above_average"
            : avg >= 50
              ? "average"
              : "at_risk";

      bulkTermResults.push({
        schoolId,
        academicPeriodId: periodId,
        studentId: student._id,
        classGroupId: cg._id,
        totalSubjects: sgScores.length,
        totalScore: Number(sgScores.reduce((a, b) => a + b, 0).toFixed(1)),
        averageScore: avg,
        classPosition: position,
        totalStudents: cgStudents.length,
        performanceTier: perfTier,
        gpa: Number((avg / 25).toFixed(2)),
        isPromoted: avg >= 50,
        calculatedAt: new Date(),
      });
    }

    // ── 6c. TeacherComments ──
    if (!existingCommentStudents.has(sId)) {
      const numComments = randomInt(2, 4);
      for (let i = 0; i < numComments; i++) {
        const type = randomElement(["subject", "general", "behavior"] as const);
        const subjectId =
          type === "subject" && studentSubjectIds.length > 0
            ? randomElement(studentSubjectIds)
            : null;
        const teacher = subjectId
          ? teacherBySubject.get(subjectId) || fallbackTeacher
          : fallbackTeacher;
        if (!teacher) continue;

        bulkComments.push({
          schoolId,
          academicPeriodId: periodId,
          studentId: student._id,
          subjectId: subjectId
            ? new mongoose.Types.ObjectId(subjectId)
            : null,
          teacherId: teacher._id,
          commentType: type,
          comment: randomElement(COMMENT_TEMPLATES[type]),
          isPublic: true,
        });
      }
    }

    // ── 6d. Attendance ──
    if (!existingAttendanceStudents.has(sId) && schoolDays.length > 0) {
      const absentRate =
        tier === "at_risk"
          ? 0.15
          : tier === "average"
            ? 0.08
            : tier === "above_average"
              ? 0.04
              : 0.02;
      const lateRate =
        tier === "at_risk"
          ? 0.1
          : tier === "average"
            ? 0.06
            : 0.03;
      const absentDayBias = randomElement([1, 1, 5, 5, 3]);

      for (const day of schoolDays) {
        const r = Math.random();
        let status: "present" | "absent" | "late" | "excused";
        let lateMinutes: number | undefined;
        let reason: string | undefined;

        const dayOfWeek = day.getDay();
        const dayBiasMultiplier = dayOfWeek === absentDayBias ? 2 : 1;

        if (r < absentRate * dayBiasMultiplier) {
          status = Math.random() < 0.3 ? "excused" : "absent";
          reason =
            status === "excused"
              ? randomElement([
                  "Medical appointment",
                  "Family event",
                  "Feeling unwell",
                ])
              : undefined;
        } else if (r < absentRate * dayBiasMultiplier + lateRate) {
          status = "late";
          lateMinutes = randomInt(5, 45);
        } else {
          status = "present";
        }

        bulkAttendance.push({
          schoolId,
          studentId: student._id,
          classGroupId: cg._id,
          academicPeriodId: periodId,
          date: day,
          type: "homeroom",
          status,
          lateMinutes,
          reason,
          recordedBy: recorderBy,
        });
      }
    }

    // ── 6e. Invoice + Payments ──
    if (!existingInvoiceStudents.has(sId)) {
      const totalAmountMinor = randomInt(80000, 250000);
      const paidRatio = randomElement([1.0, 1.0, 1.0, 0.7, 0.5, 0.3, 0, 0]);
      const totalPaidMinor = Math.round(totalAmountMinor * paidRatio);
      const totalOutstandingMinor = totalAmountMinor - totalPaidMinor;

      let status: string;
      if (totalOutstandingMinor <= 0) status = "paid";
      else if (totalPaidMinor > 0) status = "partially_paid";
      else status = "issued";

      const dueDate = new Date(termStart);
      dueDate.setDate(dueDate.getDate() + 30);
      if (totalOutstandingMinor > 0 && new Date() > dueDate) {
        status = "overdue";
      }

      const invoiceNumber = `INV-${currentPeriod?.yearLabel?.replace("/", "") ?? "2526"}-${sId.slice(-6).toUpperCase()}`;
      const invoiceOid = new mongoose.Types.ObjectId();

      bulkInvoices.push({
        _id: invoiceOid,
        schoolId,
        studentId: student._id,
        academicPeriodId: periodId,
        invoiceNumber,
        status,
        totalAmountMinor,
        totalPaidMinor,
        totalOutstandingMinor,
        totalCreditAppliedMinor: 0,
        version: 1,
        issueDate: termStart,
        dueDate,
        paidDate: status === "paid" ? new Date() : null,
      });

      if (totalPaidMinor > 0) {
        const numPayments =
          paidRatio >= 1 ? 1 : paidRatio >= 0.5 ? randomInt(1, 2) : 1;
        let remaining = totalPaidMinor;

        for (let p = 0; p < numPayments; p++) {
          const isLast = p === numPayments - 1;
          const amount = isLast
            ? remaining
            : Math.round(remaining * randomFloat(0.4, 0.7));
          remaining -= amount;

          const payDate = new Date(termStart);
          payDate.setDate(payDate.getDate() + randomInt(1, 60));

          bulkPayments.push({
            schoolId,
            studentId: student._id,
            invoiceId: invoiceOid,
            amountMinor: amount,
            paymentDate: payDate,
            paymentMethod: randomElement([
              "cash",
              "mobile_money",
              "bank_transfer",
              "cash",
              "mobile_money",
            ] as const),
            status: "completed",
            approvalStatus: "not_required",
            reconciliationStatus: "unmatched",
            receivedBy: recorderBy,
          });
        }
      }
    }
  }

  // ── 7. Bulk insert ──
  if (argv.dryRun) {
    console.log("  [DRY] Would insert:");
  } else {
    console.log("  Inserting data...");
  }

  const insertBatch = async (
    label: string,
    model: any,
    docs: any[]
  ) => {
    if (docs.length === 0) {
      console.log(`  ${label}: 0 (skipped)`);
      return;
    }
    if (!argv.dryRun) {
      try {
        await model.insertMany(docs, { ordered: false });
        console.log(`  ✓ ${label}: ${docs.length}`);
      } catch (err: any) {
        if (err.code === 11000) {
          const inserted = err.result?.insertedCount ?? "some";
          const dupes = docs.length - (typeof inserted === "number" ? inserted : 0);
          console.log(
            `  ✓ ${label}: ${inserted} inserted (${dupes} duplicates skipped)`
          );
        } else {
          throw err;
        }
      }
    } else {
      console.log(`  ✓ ${label}: ${docs.length}`);
    }
  };

  await insertBatch("Subject grades", SubjectGrade, bulkSubjectGrades);
  await insertBatch("Term results", TermResult, bulkTermResults);
  await insertBatch("Teacher comments", TeacherComment, bulkComments);
  await insertBatch("Attendance records", StudentAttendance, bulkAttendance);
  await insertBatch("Invoices", Invoice, bulkInvoices);
  await insertBatch("Payments", Payment, bulkPayments);

  // ── Summary ──
  console.log("\n" + "═".repeat(55));
  console.log("  📊  SEED INSIGHTS DATA — SUMMARY");
  console.log("═".repeat(55));
  console.log(`  Period:           ${periodLabel}`);
  console.log(`  Students:         ${students.length}`);
  console.log(`  Subject grades:   ${bulkSubjectGrades.length}`);
  console.log(`  Term results:     ${bulkTermResults.length}`);
  console.log(`  Teacher comments: ${bulkComments.length}`);
  console.log(`  Attendance:       ${bulkAttendance.length}`);
  console.log(`  Invoices:         ${bulkInvoices.length}`);
  console.log(`  Payments:         ${bulkPayments.length}`);
  console.log("═".repeat(55));

  if (argv.dryRun) {
    console.log(
      "\n  🔍 Dry run complete. Use without --dryRun to write data.\n"
    );
  } else {
    console.log("\n  ✅ All done! AI Insights tab is ready for testing.\n");
  }

  await disconnectDatabase();
}

main().catch((err) => {
  console.error("\nFatal error:", err);
  process.exit(1);
});
