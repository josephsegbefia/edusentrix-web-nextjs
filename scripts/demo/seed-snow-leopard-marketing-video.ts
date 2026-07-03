/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Seeds/refreshes focused demo data for the EduSentrix marketing walkthrough.
 *
 * Scope:
 * - Snow Leopard Academy only
 * - Existing parent account by default: ejosephsegbefia@gmail.com
 * - Dedicated Janice teacher identity if no Janice record already exists
 *
 * Usage:
 *   npx tsx scripts/demo/seed-snow-leopard-marketing-video.ts --dryRun
 *   npx tsx scripts/demo/seed-snow-leopard-marketing-video.ts
 */
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import mongoose, { Types } from "mongoose";

loadEnv({ path: resolve(process.cwd(), ".env.local"), quiet: true });
loadEnv({ path: resolve(process.cwd(), ".env"), quiet: true });

import { connectToDatabase, disconnectDatabase } from "../../src/db/connectToDatabase";

type CollectionName =
  | "users"
  | "usermemberships"
  | "teachers"
  | "teacherassignments"
  | "classgroups"
  | "grades"
  | "subjects"
  | "subjectofferings"
  | "academicperiods"
  | "students"
  | "guardians"
  | "feestructures"
  | "invoices"
  | "invoicelineitems"
  | "payments"
  | "paymentallocations"
  | "invoiceevents"
  | "lessonnotes"
  | "lessonweekplans"
  | "lessonsessions"
  | "messagethreads"
  | "messages"
  | "reportcardruns"
  | "studentreportcards"
  | "schools";

const MARKER = "marketing-video-2026";
const DEFAULT_SCHOOL_NAME = "Snow Leopard Academy";
const DEFAULT_PARENT_EMAIL = "ejosephsegbefia@gmail.com";
const JANICE_EMAIL = "janice.owusu@tryedusentrix.app";

const argv = new Set(process.argv.slice(2));
const dryRun = argv.has("--dryRun") || argv.has("--dry-run");

function argValue(name: string, fallback: string) {
  const prefix = `--${name}=`;
  const found = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length).trim() || fallback : fallback;
}

function oid(value?: string | Types.ObjectId | null) {
  return value instanceof Types.ObjectId ? value : new Types.ObjectId(String(value));
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function mondayOf(date: Date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function db() {
  return mongoose.connection.db;
}

function col<T = any>(name: CollectionName) {
  return db().collection<T>(name);
}

async function writeOne(
  collectionName: CollectionName,
  action: string,
  fn: () => Promise<unknown>,
) {
  if (dryRun) {
    console.log(`[dry] ${collectionName}: ${action}`);
    return null;
  }
  return fn();
}

async function upsertById(collectionName: CollectionName, _id: Types.ObjectId, doc: Record<string, unknown>) {
  await writeOne(collectionName, `upsert ${String(_id)}`, () =>
    col(collectionName).updateOne(
      { _id },
      {
        $set: { ...doc, updatedAt: new Date() },
        $setOnInsert: { _id, createdAt: new Date() },
      },
      { upsert: true },
    ),
  );
}

async function main() {
  await connectToDatabase();

  const schoolName = argValue("schoolName", DEFAULT_SCHOOL_NAME);
  const parentEmail = argValue("parentEmail", DEFAULT_PARENT_EMAIL).toLowerCase();

  const school = await col("schools").findOne({
    name: new RegExp(`^${escapeRegex(schoolName)}$`, "i"),
  });
  if (!school) throw new Error(`School not found: ${schoolName}`);
  const schoolId = oid(school._id);

  const period = await col("academicperiods").findOne({ schoolId, isCurrent: true });
  if (!period) throw new Error(`No current academic period found for ${schoolName}`);
  const academicPeriodId = oid(period._id);

  const parent = await col("users").findOne({ schoolId, email: parentEmail });
  if (!parent) throw new Error(`Existing parent account not found in ${schoolName}: ${parentEmail}`);
  const parentUserId = oid(parent._id);

  await writeOne("usermemberships", `ensure active parent membership for ${parentEmail}`, () =>
    col("usermemberships").updateOne(
      { userId: parentUserId, schoolId },
      {
        $set: { roles: ["parent"], status: "active", updatedAt: new Date() },
        $setOnInsert: { userId: parentUserId, schoolId, createdAt: new Date() },
      },
      { upsert: true },
    ),
  );

  let janiceUser = await col("users").findOne({
    schoolId,
    $or: [{ email: JANICE_EMAIL }, { firstName: /^Janice$/i }],
  });
  if (!janiceUser) {
    const janiceUserId = new Types.ObjectId();
    await upsertById("users", janiceUserId, {
      email: JANICE_EMAIL,
      firstName: "Janice",
      lastName: "Owusu",
      name: "Janice Owusu",
      phone: "0245550198",
      role: "teacher",
      schoolId,
      pendingOnboarding: false,
      termsAccepted: true,
      privacyAccepted: true,
    });
    janiceUser = { _id: janiceUserId, email: JANICE_EMAIL, firstName: "Janice", lastName: "Owusu" };
  }
  const janiceUserId = oid(janiceUser._id);

  await writeOne("usermemberships", "ensure Janice teacher membership", () =>
    col("usermemberships").updateOne(
      { userId: janiceUserId, schoolId },
      {
        $set: { roles: ["teacher"], status: "active", updatedAt: new Date() },
        $setOnInsert: { userId: janiceUserId, schoolId, createdAt: new Date() },
      },
      { upsert: true },
    ),
  );

  let janiceTeacher = await col("teachers").findOne({ userId: janiceUserId, schoolId });
  if (!janiceTeacher) {
    const teacherId = new Types.ObjectId();
    await upsertById("teachers", teacherId, {
      schoolId,
      userId: janiceUserId,
      employeeId: "MKT-JANICE-001",
      department: "Science and Mathematics",
      status: "active",
      hireDate: new Date("2024-09-02T00:00:00.000Z"),
      maxClasses: 6,
      maxStudents: 180,
      subjectIds: [],
      subjectOfferingIds: [],
      tags: ["marketing-demo"],
      subroles: ["lesson_note_reviewer"],
      qualifications: [
        {
          type: "degree",
          name: "B.Ed. Science Education",
          institution: "University of Education, Winneba",
          year: 2018,
        },
      ],
      emergencyContact: {
        name: "Kojo Owusu",
        relationship: "Brother",
        phone: "0245550199",
        email: "kojo.owusu@example.com",
      },
      notes: "Demo teacher for EduSentrix marketing video walkthrough.",
    });
    janiceTeacher = { _id: teacherId };
  }
  const teacherId = oid(janiceTeacher._id);

  const jhs1 = await col("grades").findOne({ schoolId, name: /^JHS\s*1$/i });
  if (!jhs1) throw new Error("JHS 1 grade not found");
  const classGroup =
    (await col("classgroups").findOne({ schoolId, gradeId: jhs1._id, name: /^JHS\s*1\s*A$/i })) ||
    (await col("classgroups").findOne({ schoolId, gradeId: jhs1._id }));
  if (!classGroup) throw new Error("JHS 1 class group not found");
  const classGroupId = oid(classGroup._id);
  const gradeId = oid(jhs1._id);

  const science =
    (await col("subjects").findOne({ schoolId, name: /^Science$/i })) ||
    (await col("subjects").findOne({ schoolId, name: /science/i }));
  if (!science) throw new Error("Science subject not found");
  const subjectId = oid(science._id);
  const scienceOffering =
    (await col("subjectofferings").findOne({
      schoolId,
      subjectId,
      gradeBand: "jhs",
      isActive: true,
    })) ||
    (await col("subjectofferings").findOne({ schoolId, subjectId, isActive: true }));
  if (!scienceOffering) throw new Error("Science subject offering not found");
  const subjectOfferingId = oid(scienceOffering._id);

  await writeOne("teachers", "attach Science offering to Janice", () =>
    col("teachers").updateOne(
      { _id: teacherId, schoolId },
      {
        $addToSet: {
          subjectIds: subjectId,
          subjectOfferingIds: subjectOfferingId,
          tags: "marketing-demo",
        },
        $set: { updatedAt: new Date() },
      },
    ),
  );

  await writeOne("teacherassignments", "assign Janice to JHS 1 A Science", () =>
    col("teacherassignments").updateOne(
      {
        schoolId,
        academicPeriodId,
        teacherId,
        classGroupId,
        subjectId,
        subjectOfferingId,
        status: "active",
      },
      {
        $set: {
          contactHoursPerWeek: 5,
          workloadHours: 5,
          notes: "Marketing video demo assignment: Janice teaches JHS 1 Science.",
          assignedBy: janiceUserId,
          assignedAt: new Date(),
          updatedAt: new Date(),
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true },
    ),
  );

  const guardians = await col("guardians").find({ userId: parentUserId }).toArray();
  const wardIds = guardians.map((guardian) => oid(guardian.studentId));
  if (wardIds.length === 0) throw new Error(`Parent ${parentEmail} has no linked wards`);

  const primaryWards = await col("students")
    .find({ _id: { $in: wardIds }, schoolId, status: "active" })
    .project({ firstName: 1, lastName: 1, admissionNo: 1, gradeId: 1, classGroupId: 1 })
    .toArray();
  if (primaryWards.length === 0) throw new Error(`Parent ${parentEmail} has no active wards`);

  const extraFinanceStudents = await col("students")
    .find({
      schoolId,
      status: "active",
      classGroupId: { $in: [classGroupId, ...primaryWards.map((ward) => ward.classGroupId).filter(Boolean)] },
      _id: { $nin: primaryWards.map((ward) => ward._id) },
    })
    .project({ firstName: 1, lastName: 1, admissionNo: 1, gradeId: 1, classGroupId: 1 })
    .limit(8)
    .toArray();

  const financeStudents = [...primaryWards, ...extraFinanceStudents].slice(0, 10);
  const feeStructureIds = await ensureFeeStructures(schoolId);
  const adminUserId = await resolveAdminUserId(schoolId, janiceUserId);
  await ensureFinanceStory(schoolId, academicPeriodId, financeStudents, feeStructureIds, adminUserId);
  await ensureLessonStory({
    schoolId,
    academicPeriodId,
    teacherId,
    classGroupId,
    subjectId,
    subjectOfferingId,
    adminUserId,
  });
  await ensureParentMessages(schoolId, parentUserId, janiceUserId, primaryWards[0]);
  await ensureReportCards(schoolId, academicPeriodId, primaryWards, classGroup, jhs1, teacherId, adminUserId);

  const summary = {
    dryRun,
    school: school.name,
    schoolId: String(schoolId),
    parent: parentEmail,
    wards: primaryWards.map((ward) => `${ward.firstName} ${ward.lastName}`),
    teacher: "Janice Owusu",
    classGroup: classGroup.name,
    subject: scienceOffering.displayName || science.name,
    financeStudents: financeStudents.length,
  };

  console.log(JSON.stringify(summary, null, 2));
}

async function resolveAdminUserId(schoolId: Types.ObjectId, fallbackUserId: Types.ObjectId) {
  const membership = await col("usermemberships").findOne({
    schoolId,
    roles: { $in: ["school_admin", "bursar"] },
    status: "active",
  });
  return membership?.userId ? oid(membership.userId) : fallbackUserId;
}

async function ensureFeeStructures(schoolId: Types.ObjectId) {
  const fees = [
    ["tuition", "Tuition", "TERM-TUITION", 185000],
    ["other", "Feeding", "TERM-FEEDING", 72000],
    ["other", "Books and Learning Materials", "TERM-BOOKS", 45000],
    ["sports", "Sports and Clubs", "TERM-SPORTS", 18000],
  ] as const;

  const ids: Record<string, Types.ObjectId> = {};
  for (const [category, name, code, defaultAmountMinor] of fees) {
    const existing = await col("feestructures").findOne({ schoolId, code });
    const _id = existing?._id ? oid(existing._id) : new Types.ObjectId();
    ids[code] = _id;
    await writeOne("feestructures", `upsert fee ${code}`, () =>
      col("feestructures").updateOne(
        { schoolId, code },
        {
          $set: {
            name,
            code,
            category,
            defaultAmountMinor,
            allowsInstallments: code === "TERM-TUITION",
            maxInstallments: code === "TERM-TUITION" ? 3 : null,
            isActive: true,
            description: `Snow Leopard Academy ${name.toLowerCase()} for marketing video demo.`,
            updatedAt: new Date(),
          },
          $setOnInsert: { _id, schoolId, createdAt: new Date() },
        },
        { upsert: true },
      ),
    );
  }
  return ids;
}

async function ensureFinanceStory(
  schoolId: Types.ObjectId,
  academicPeriodId: Types.ObjectId,
  students: any[],
  feeStructureIds: Record<string, Types.ObjectId>,
  adminUserId: Types.ObjectId,
) {
  for (let index = 0; index < students.length; index += 1) {
    const student = students[index];
    const total = 320000 + (index % 3) * 25000;
    const paid =
      index === 0 ? 180000 : index === 1 ? total : index % 4 === 0 ? 0 : Math.round(total * 0.62);
    const outstanding = total - paid;
    const invoiceNumber = `SL-MKT-${String(student.admissionNo || student._id).replace(/[^A-Z0-9-]/gi, "").slice(-12)}`;
    const dueDate = index % 4 === 0 ? new Date("2026-06-14T00:00:00.000Z") : new Date("2026-07-12T00:00:00.000Z");
    const status = outstanding === 0 ? "paid" : dueDate < new Date() ? "overdue" : "partially_paid";

    let invoice = await col("invoices").findOne({
      schoolId,
      studentId: oid(student._id),
      academicPeriodId,
    });

    if (!invoice) {
      const invoiceId = new Types.ObjectId();
      await upsertById("invoices", invoiceId, {
        schoolId,
        studentId: oid(student._id),
        academicPeriodId,
        invoiceNumber,
        status,
        totalAmountMinor: total,
        totalPaidMinor: paid,
        totalOutstandingMinor: outstanding,
        totalCreditAppliedMinor: 0,
        version: 1,
        issueDate: new Date("2026-05-13T09:00:00.000Z"),
        dueDate,
        paidDate: outstanding === 0 ? new Date("2026-06-03T11:20:00.000Z") : null,
        notes: `[${MARKER}] Term 3 fee invoice for marketing walkthrough.`,
        terms: "Payment may be made by mobile money, bank transfer, or school office receipt.",
      });
      invoice = { _id: invoiceId };
    }

    const invoiceId = oid(invoice._id);
    const existingLines = await col("invoicelineitems").countDocuments({ invoiceId });
    if (existingLines === 0 || String(invoice.notes || "").includes(MARKER)) {
      const lineDefs = [
        ["Tuition", "TERM-TUITION", 185000],
        ["Feeding", "TERM-FEEDING", 72000],
        ["Books and Learning Materials", "TERM-BOOKS", 45000],
        ["Sports and Clubs", "TERM-SPORTS", total - 302000],
      ] as const;
      let paidRemaining = paid;
      for (let lineIndex = 0; lineIndex < lineDefs.length; lineIndex += 1) {
        const [name, code, amount] = lineDefs[lineIndex];
        const linePaid = Math.min(paidRemaining, amount);
        paidRemaining -= linePaid;
        const lineStatus = linePaid === amount ? "paid" : linePaid > 0 ? "partially_paid" : status === "overdue" ? "overdue" : "pending";
        const existingLine = await col("invoicelineitems").findOne({
          invoiceId,
          name,
        });
        const lineId = existingLine?._id ? oid(existingLine._id) : new Types.ObjectId();
        await upsertById("invoicelineitems", lineId, {
          invoiceId,
          feeStructureId: feeStructureIds[code],
          name,
          description: `[${MARKER}] ${name} for ${student.firstName} ${student.lastName}`,
          amountMinor: amount,
          displayOrder: lineIndex + 1,
          allowsInstallments: code === "TERM-TUITION",
          numberOfInstallments: code === "TERM-TUITION" ? 3 : null,
          amountPaidMinor: linePaid,
          amountOutstandingMinor: amount - linePaid,
          isFullyPaid: linePaid === amount,
          status: lineStatus,
          isAdjustment: false,
          adjustmentType: null,
          adjustmentReason: null,
        });
      }
      await writeOne("invoices", `refresh invoice totals ${invoiceNumber}`, () =>
        col("invoices").updateOne(
          { _id: invoiceId },
          {
            $set: {
              status,
              totalAmountMinor: total,
              totalPaidMinor: paid,
              totalOutstandingMinor: outstanding,
              dueDate,
              paidDate: outstanding === 0 ? new Date("2026-06-03T11:20:00.000Z") : null,
              notes: `[${MARKER}] Term 3 fee invoice for marketing walkthrough.`,
              updatedAt: new Date(),
            },
          },
        ),
      );
    }

    if (paid > 0) {
      const payment = await col("payments").findOne({
        schoolId,
        invoiceId,
        idempotencyKey: `${MARKER}:${String(invoiceId)}:payment`,
      });
      const paymentId = payment?._id ? oid(payment._id) : new Types.ObjectId();
      await upsertById("payments", paymentId, {
        schoolId,
        studentId: oid(student._id),
        invoiceId,
        amountMinor: paid,
        platformFeeMinor: 0,
        processorFeeMinor: 0,
        netSchoolAmountMinor: paid,
        paymentDate: index === 1 ? new Date("2026-06-03T11:20:00.000Z") : new Date("2026-06-18T10:15:00.000Z"),
        paymentMethod: index % 2 === 0 ? "mobile_money" : "bank_transfer",
        reconciliationStatus: index % 2 === 0 ? "gateway_verified" : "bank_matched",
        gatewayVerifiedAt: index % 2 === 0 ? new Date("2026-06-18T10:16:00.000Z") : null,
        bankMatchedAt: index % 2 === 1 ? new Date("2026-06-18T15:40:00.000Z") : null,
        receivedBy: adminUserId,
        idempotencyKey: `${MARKER}:${String(invoiceId)}:payment`,
        internalReference: `MKT-RCP-${String(invoiceId).slice(-8).toUpperCase()}`,
        externalReference: `SLPAY-${String(invoiceId).slice(-6).toUpperCase()}`,
        notes: `[${MARKER}] Demo payment for finance walkthrough.`,
        status: "completed",
        approvalStatus: "not_required",
      });
    }

    await writeOne("invoiceevents", `ensure invoice event ${invoiceNumber}`, () =>
      col("invoiceevents").updateOne(
        { invoiceId, eventType: "issued", description: `[${MARKER}] Invoice issued for marketing video demo.` },
        {
          $set: {
            schoolId,
            studentId: oid(student._id),
            performedBy: adminUserId,
            metadata: { marker: MARKER, invoiceNumber },
          },
          $setOnInsert: { invoiceId, eventType: "issued", createdAt: new Date() },
        },
        { upsert: true },
      ),
    );
  }
}

async function ensureLessonStory(input: {
  schoolId: Types.ObjectId;
  academicPeriodId: Types.ObjectId;
  teacherId: Types.ObjectId;
  classGroupId: Types.ObjectId;
  subjectId: Types.ObjectId;
  subjectOfferingId: Types.ObjectId;
  adminUserId: Types.ObjectId;
}) {
  const weekStart = mondayOf(new Date("2026-06-22T00:00:00.000Z"));
  const weekEnd = addDays(weekStart, 4);
  const noteId = new Types.ObjectId();
  const existingNote = await col("lessonnotes").findOne({
    schoolId: input.schoolId,
    teacherId: input.teacherId,
    topic: "The Human Digestive System",
  });
  const lessonNoteId = existingNote?._id ? oid(existingNote._id) : noteId;

  await upsertById("lessonnotes", lessonNoteId, {
    schoolId: input.schoolId,
    teacherId: input.teacherId,
    classGroupId: input.classGroupId,
    subjectId: input.subjectId,
    subjectOfferingId: input.subjectOfferingId,
    subjectNameSnapshot: "Science",
    subjectOfferingCodeSnapshot: "NACCA-JHS-SCI",
    academicPeriodId: input.academicPeriodId,
    templateType: "CLASSIC_JHS",
    curriculumCode: "ghana_nacca",
    weekOf: weekStart,
    date: new Date("2026-06-23T00:00:00.000Z"),
    weekEndingDate: weekEnd,
    topic: "The Human Digestive System",
    durationMinutes: 45,
    references: ["NaCCA JHS 1 Science Curriculum", "Science for Junior High Schools, Book 1"],
    curriculum: {
      strand: "Systems",
      subStrand: "Human Body Systems",
      contentStandard: "Demonstrate understanding of digestion and nutrient absorption.",
      indicators: [
        {
          refNo: "B7.2.1.1",
          text: "Describe the main organs involved in digestion and explain their functions.",
        },
      ],
      learningOutcomes: [
        "Identify the major organs of the digestive system.",
        "Explain the journey of food through the body.",
        "Relate digestion to healthy eating habits.",
      ],
    },
    tlms: ["Digestive system chart", "Food samples", "Whiteboard", "Short class quiz"],
    body: {
      objectives: {
        general: "Learners will understand how food is broken down and absorbed by the human body.",
        specific: [
          "Name at least five organs in the digestive system.",
          "Describe the function of the mouth, stomach, small intestine, and large intestine.",
          "Explain why balanced meals support healthy digestion.",
        ],
      },
      rpk: "Learners have discussed food groups and balanced diets in previous lessons.",
      introduction: "Ask learners what happens to a ball of kenkey after they swallow it.",
      presentationSteps: [
        {
          stepTitle: "Trace the Journey",
          teacherActivity: "Display a digestive system chart and guide learners from mouth to anus.",
          learnerActivity: "Learners identify each organ and predict what happens there.",
          boardWork: "Mouth -> Oesophagus -> Stomach -> Small Intestine -> Large Intestine",
          keyQuestions: ["Where does digestion begin?", "Why is the small intestine important?"],
          timeMins: 15,
        },
        {
          stepTitle: "Organ Functions",
          teacherActivity: "Explain mechanical and chemical digestion with simple examples.",
          learnerActivity: "Learners match organs to their functions in pairs.",
          keyQuestions: ["What does the stomach do?", "Where are nutrients absorbed?"],
          timeMins: 20,
        },
      ],
      corePoints: [
        "Digestion begins in the mouth.",
        "The stomach churns food and mixes it with digestive juices.",
        "Most nutrient absorption happens in the small intestine.",
      ],
      evaluation: {
        questions: [
          "List four organs in the digestive system.",
          "State one function of the stomach.",
          "Explain why chewing food properly helps digestion.",
        ],
        answers: ["Mouth, oesophagus, stomach, small intestine.", "It churns food and begins protein digestion.", "It breaks food into smaller pieces."],
      },
      remarks: "Use Teach Mode for the diagram sequence and exit ticket.",
    },
    assessment: {
      inClassChecks: ["Oral questioning", "Pair matching activity", "Exit ticket"],
      exitTicket: "Write one organ and its function before leaving class.",
      homework: "Draw and label the digestive system.",
    },
    resources: [
      {
        title: "Class digestive system diagram",
        url: "https://tryedusentrix.app/demo-assets/digestive-system-chart",
        type: "image",
      },
    ],
    tags: ["marketing-demo", "teach-mode", "science"],
    status: "approved",
    submittedAt: new Date("2026-06-21T12:00:00.000Z"),
    approvedAt: new Date("2026-06-22T08:45:00.000Z"),
    approvedBy: input.adminUserId,
    content: "Approved Science lesson note for the EduSentrix marketing video Teach Mode walkthrough.",
    objectives: "Learners identify digestive organs and explain their functions.",
  });

  const existingWeekPlan = await col("lessonweekplans").findOne({
    schoolId: input.schoolId,
    classGroupId: input.classGroupId,
    subjectOfferingId: input.subjectOfferingId,
    weekStartDate: weekStart,
    title: "The Human Digestive System",
  });
  const weekPlanId = existingWeekPlan?._id ? oid(existingWeekPlan._id) : new Types.ObjectId();
  await upsertById("lessonweekplans", weekPlanId, {
    schoolId: input.schoolId,
    academicPeriodId: input.academicPeriodId,
    classGroupId: input.classGroupId,
    classGroupIds: [input.classGroupId],
    subjectOfferingId: input.subjectOfferingId,
    lessonNoteId,
    ownerTeacherId: input.teacherId,
    weekStartDate: weekStart,
    weekEndDate: weekEnd,
    weekLabel: "Week 7",
    title: "The Human Digestive System",
    status: "ready",
    sessionIds: [],
  });

  const existingSession = await col("lessonsessions").findOne({
    schoolId: input.schoolId,
    weekPlanId,
    sequenceInWeek: 1,
  });
  const sessionId = existingSession?._id ? oid(existingSession._id) : new Types.ObjectId();
  await upsertById("lessonsessions", sessionId, {
    schoolId: input.schoolId,
    weekPlanId,
    lessonNoteId,
    classGroupId: input.classGroupId,
    subjectOfferingId: input.subjectOfferingId,
    ownerTeacherId: input.teacherId,
    sequenceInWeek: 1,
    timetableSlotIds: [],
    scheduledDate: new Date("2026-06-23T00:00:00.000Z"),
    dayOfWeek: 2,
    startTime: "10:20",
    endTime: "11:05",
    durationMinutes: 45,
    title: "The Human Digestive System",
    status: "published",
    noteSectionAllocation: { schemeItemIds: [], noteSectionKeys: ["introduction", "presentation", "evaluation"], coverageWeight: 1 },
    studentVisibility: "published",
    parentVisibility: true,
    adminVisibility: true,
    contentVersion: 1,
    planNotes: "Use the organ journey as the main visual moment for the marketing video.",
    contentBlocks: [
      {
        id: "hook",
        type: "explanation",
        title: "Lesson Hook",
        bodyHtml: "<p>What happens to your food after you swallow it?</p>",
        order: 1,
        estimatedMinutes: 5,
        aiGenerated: false,
        teacherReviewed: true,
      },
      {
        id: "journey",
        type: "diagram",
        title: "Journey of Food",
        bodyHtml: "<p>Mouth -> Oesophagus -> Stomach -> Small intestine -> Large intestine.</p>",
        order: 2,
        estimatedMinutes: 15,
        aiGenerated: false,
        teacherReviewed: true,
        diagramMeta: { kind: "process", title: "Human digestive pathway" },
      },
      {
        id: "activity",
        type: "activity",
        title: "Pair Activity",
        bodyHtml: "<p>Match each digestive organ to its function.</p>",
        order: 3,
        estimatedMinutes: 15,
        aiGenerated: false,
        teacherReviewed: true,
      },
    ],
    assessmentItems: [
      {
        id: "q1",
        type: "multiple_choice",
        title: "Quick Check",
        question: "Where does digestion begin?",
        options: ["Mouth", "Stomach", "Small intestine", "Large intestine"],
        correctAnswer: "Mouth",
        estimatedMinutes: 2,
        aiGenerated: false,
      },
    ],
    boardNotes: {
      contentHtml: "<h3>Key Points</h3><ul><li>Digestion begins in the mouth.</li><li>The stomach churns food.</li><li>Nutrients are absorbed in the small intestine.</li></ul>",
      generatedAt: new Date("2026-06-22T08:50:00.000Z"),
      aiGenerated: false,
    },
    notebookNotesPublished: true,
    learnTeacherPriority: true,
    teachingDeck: {
      builtAt: new Date("2026-06-22T08:55:00.000Z").toISOString(),
      sourceContentVersion: 1,
      slides: [
        { id: "s1", type: "title", title: "The Human Digestive System", bodyHtml: "<p>JHS 1 Science</p>", estimatedMinutes: 2 },
        { id: "s2", type: "content_block", title: "Journey of Food", bodyHtml: "<p>Mouth -> Oesophagus -> Stomach -> Small intestine -> Large intestine.</p>", contentBlockId: "journey", contentBlockType: "diagram", estimatedMinutes: 12 },
        { id: "s3", type: "activity", title: "Match Organs to Functions", bodyHtml: "<p>Work in pairs and explain your match.</p>", estimatedMinutes: 15 },
        { id: "s4", type: "exit_ticket", title: "Exit Ticket", bodyHtml: "<p>Name one organ and write its function.</p>", estimatedMinutes: 3 },
      ],
    },
    aiMetadata: { leoGeneratedAt: null, teacherReviewedAllAi: true },
  });

  await writeOne("lessonweekplans", "attach lesson session to week plan", () =>
    col("lessonweekplans").updateOne({ _id: weekPlanId }, { $addToSet: { sessionIds: sessionId }, $set: { updatedAt: new Date() } }),
  );
}

async function ensureParentMessages(
  schoolId: Types.ObjectId,
  parentUserId: Types.ObjectId,
  janiceUserId: Types.ObjectId,
  ward: any,
) {
  const subject = `[${MARKER}] JHS 1 Science progress update`;
  const existingThread = await col("messagethreads").findOne({ schoolId, subject });
  const threadId = existingThread?._id ? oid(existingThread._id) : new Types.ObjectId();
  await upsertById("messagethreads", threadId, {
    schoolId,
    studentId: oid(ward._id),
    subject,
    participants: [
      { userId: janiceUserId, role: "teacher" },
      { userId: parentUserId, role: "parent" },
    ],
    lastMessageAt: new Date("2026-06-20T14:30:00.000Z"),
    lastMessagePreview: "Jeniah participated well in today’s Science activity.",
    createdBy: janiceUserId,
  });

  const existingMessage = await col("messages").findOne({
    threadId,
    body: /Jeniah participated well/i,
  });
  const messageId = existingMessage?._id ? oid(existingMessage._id) : new Types.ObjectId();
  await upsertById("messages", messageId, {
    threadId,
    schoolId,
    senderId: janiceUserId,
    body: "Jeniah participated well in today’s Science activity and completed the digestive system exit ticket. Please help her revise the organ functions before Friday’s quiz.",
    attachments: [],
    readBy: [{ userId: janiceUserId, readAt: new Date("2026-06-20T14:30:00.000Z") }],
  });
}

async function ensureReportCards(
  schoolId: Types.ObjectId,
  academicPeriodId: Types.ObjectId,
  wards: any[],
  classGroup: any,
  grade: any,
  teacherId: Types.ObjectId,
  adminUserId: Types.ObjectId,
) {
  const run = await col("reportcardruns").findOne({
    schoolId,
    academicPeriodId,
    classGroupId: oid(classGroup._id),
  });
  const runId = run?._id ? oid(run._id) : new Types.ObjectId();
  await upsertById("reportcardruns", runId, {
    schoolId,
    academicPeriodId,
    classGroupId: oid(classGroup._id),
    gradeId: oid(grade._id),
    homeroomTeacherId: teacherId,
    gradingPolicyId: new Types.ObjectId("000000000000000000000001"),
    assessmentPlanId: new Types.ObjectId("000000000000000000000002"),
    reportTemplateId: null,
    status: "released",
    openedBy: adminUserId,
    openedAt: new Date("2026-06-18T08:00:00.000Z"),
    compiledBy: adminUserId,
    compiledAt: new Date("2026-06-18T10:00:00.000Z"),
    submittedBy: adminUserId,
    submittedAt: new Date("2026-06-18T11:00:00.000Z"),
    approvedBy: adminUserId,
    approvedAt: new Date("2026-06-18T14:00:00.000Z"),
    releasedBy: adminUserId,
    releasedAt: new Date("2026-06-19T09:00:00.000Z"),
    releaseVisibility: { parents: true, students: true, marker: MARKER },
    readinessSnapshot: null,
    issueSummary: [],
  });

  for (const ward of wards) {
    const existing = await col("studentreportcards").findOne({
      schoolId,
      academicPeriodId,
      studentId: oid(ward._id),
    });
    const cardId = existing?._id ? oid(existing._id) : new Types.ObjectId();
    const wardName = `${ward.firstName} ${ward.lastName}`.trim();
    await upsertById("studentreportcards", cardId, {
      schoolId,
      academicPeriodId,
      reportCardRunId: runId,
      studentId: oid(ward._id),
      classGroupId: oid(ward.classGroupId || classGroup._id),
      gradeId: oid(ward.gradeId || grade._id),
      gradingPolicySnapshot: { label: "Snow Leopard Term 3 Policy", marker: MARKER },
      assessmentPlanSnapshot: { components: ["Class work", "Quiz", "End of term"], marker: MARKER },
      reportTemplateSnapshot: { name: "Official Term Report", marker: MARKER },
      studentSnapshot: { name: wardName, admissionNo: ward.admissionNo || null },
      schoolSnapshot: { name: "Snow Leopard Academy" },
      attendanceSnapshot: { daysOpen: 58, daysPresent: 54, daysAbsent: 4 },
      subjectResultsSnapshot: [
        { subjectName: "Science", finalScore: 84, grade: "A", remark: "Excellent practical understanding." },
        { subjectName: "Mathematics", finalScore: 78, grade: "B+", remark: "Good problem solving." },
        { subjectName: "English Language", finalScore: 81, grade: "A", remark: "Communicates clearly." },
      ],
      termSummarySnapshot: { averageFinalScore: 81, conduct: "Very Good", position: null },
      commentsSnapshot: {
        classTeacher: "A focused learner who participates confidently in class.",
        headTeacher: "Keep up the excellent effort.",
      },
      conductSnapshot: { punctuality: "Very Good", teamwork: "Excellent" },
      promotionSnapshot: null,
      pdfUrl: null,
      status: "released",
      compiledAt: new Date("2026-06-18T10:00:00.000Z"),
      approvedAt: new Date("2026-06-18T14:00:00.000Z"),
      releasedAt: new Date("2026-06-19T09:00:00.000Z"),
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase();
  });
