import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import mongoose, { Types } from "mongoose";
import {
  PRESENTATION_ADMIN,
  PRESENTATION_OUTSTANDING_CEDIS,
  PRESENTATION_PARENT,
  PRESENTATION_SEED_MARKER,
  PRESENTATION_STUDENT,
  PRESENTATION_SUBJECTS,
  PRESENTATION_TEACHER,
  presentationPersonaEmail,
} from "@/lib/demo/presentation-cast";
import {
  assertPresentationDemoDatabase,
  resolvePresentationDatabaseName,
} from "@/lib/demo/presentation-db-guard";
import { allocateToInvoiceLineItems } from "@/lib/fees/allocateToInvoiceLineItems";
import { calculateSubjectResult } from "@/lib/academics/assessment-engine/calculate-subject-result";
import { serializeGradingPolicy } from "@/lib/academics/assessment-engine/grading-policy-service";

const __filename =
  typeof __dirname !== "undefined"
    ? path.join(__dirname, "seed-demo-presentation.ts")
    : fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(__filename), "../..");

const CLASSMATE_COUNT = 17;
const CEDIS = 100;
const OUTSTANDING_MINOR = PRESENTATION_OUTSTANDING_CEDIS * CEDIS;

const CLASSMATES: Array<{ firstName: string; lastName: string; sex: "male" | "female" }> = [
  { firstName: "Abena", lastName: "Asante", sex: "female" },
  { firstName: "Kofi", lastName: "Boateng", sex: "male" },
  { firstName: "Efua", lastName: "Owusu", sex: "female" },
  { firstName: "Yaw", lastName: "Agyemang", sex: "male" },
  { firstName: "Adwoa", lastName: "Appiah", sex: "female" },
  { firstName: "Kojo", lastName: "Donkor", sex: "male" },
  { firstName: "Akua", lastName: "Osei", sex: "female" },
  { firstName: "Kwesi", lastName: "Frimpong", sex: "male" },
  { firstName: "Yaa", lastName: "Gyasi", sex: "female" },
  { firstName: "Fiifi", lastName: "Baidoo", sex: "male" },
  { firstName: "Esi", lastName: "Tetteh", sex: "female" },
  { firstName: "Nana", lastName: "Quartey", sex: "male" },
  { firstName: "Maame", lastName: "Adjei", sex: "female" },
  { firstName: "Emmanuel", lastName: "Amankwah", sex: "male" },
  { firstName: "Grace", lastName: "Ankrah", sex: "female" },
  { firstName: "Samuel", lastName: "Darko", sex: "male" },
  { firstName: "Priscilla", lastName: "Amoako", sex: "female" },
];

function ghs(amount: number) {
  return Math.round(amount * CEDIS);
}

function normalizeSubjectKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

async function resolvePresentationSubject(
  schoolId: Types.ObjectId,
  name: string
) {
  const Subject = mongoose.model("Subject");
  const normalizedKey = normalizeSubjectKey(name);
  const existing = await Subject.findOne({
    schoolId,
    $or: [{ normalizedKey }, { name }],
  })
    .collation({ locale: "en", strength: 2 })
    .select("_id normalizedKey code")
    .lean();

  if (existing?._id) {
    if (!existing.normalizedKey) {
      await Subject.updateOne(
        { _id: existing._id, schoolId },
        { $set: { normalizedKey } }
      );
    }
    return existing;
  }

  try {
    return await Subject.create({
      schoolId,
      name,
      normalizedKey,
      code: name.slice(0, 3).toUpperCase(),
      category: "core",
      isActive: true,
    });
  } catch (error: unknown) {
    const duplicateName =
      error instanceof Error &&
      (error.message.includes("E11000") || error.message.includes("duplicate key"));
    if (!duplicateName) throw error;

    const fallback = await Subject.findOne({ schoolId, name })
      .collation({ locale: "en", strength: 2 })
      .select("_id normalizedKey code")
      .lean();
    if (!fallback?._id) throw error;
    if (!fallback.normalizedKey) {
      await Subject.updateOne(
        { _id: fallback._id, schoolId },
        { $set: { normalizedKey } }
      );
    }
    return fallback;
  }
}

function weekdayDates(start: Date, count: number) {
  const dates: Date[] = [];
  const cursor = new Date(start);
  cursor.setUTCHours(0, 0, 0, 0);
  while (dates.length < count) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) {
      dates.push(new Date(cursor));
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

async function loadModels() {
  await Promise.all([
    import("@/models/School"),
    import("@/models/User"),
    import("@/models/UserMembership"),
    import("@/models/Teacher"),
    import("@/models/Student"),
    import("@/models/Guardian"),
    import("@/models/Grade"),
    import("@/models/ClassGroup"),
    import("@/models/Subject"),
    import("@/models/SubjectOffering"),
    import("@/models/TeacherAssignment"),
    import("@/models/AcademicPeriod"),
    import("@/models/FeeStructure"),
    import("@/models/Invoice"),
    import("@/models/InvoiceLineItem"),
    import("@/models/Payment"),
    import("@/models/PaymentAllocation"),
    import("@/models/StudentAttendance"),
    import("@/models/AcademicGradingPolicy"),
    import("@/models/AssessmentPlan"),
    import("@/models/AssessmentItem"),
    import("@/models/AssessmentScore"),
    import("@/models/SubjectResult"),
    import("@/models/ReportCardRun"),
    import("@/models/StudentReportCard"),
    import("@/models/SchemeOfWork"),
    import("@/models/SchemeItem"),
    import("@/models/LessonNote"),
    import("@/models/Lesson"),
    import("@/models/TimetableVersion"),
    import("@/models/TimetableSlot"),
    import("@/models/Notice"),
    import("@/models/MessageThread"),
    import("@/models/Message"),
    import("@/models/DemoSandbox"),
  ]);
}

type SeedCtx = {
  schoolId: Types.ObjectId;
  adminUserId: Types.ObjectId;
  teacherUserId: Types.ObjectId;
  teacherId: Types.ObjectId;
  parentUserId: Types.ObjectId;
  studentId: Types.ObjectId;
  classmateIds: Types.ObjectId[];
  gradeId: Types.ObjectId;
  classGroupId: Types.ObjectId;
  periodId: Types.ObjectId;
  subjects: Map<string, Types.ObjectId>;
  offerings: Map<string, Types.ObjectId>;
  mathsSubjectId: Types.ObjectId;
  mathsOfferingId: Types.ObjectId;
  subjectTeacherIds: Map<string, Types.ObjectId>;
};

async function upsertUser(params: {
  schoolId: Types.ObjectId;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}) {
  const User = mongoose.model("User");
  const UserMembership = mongoose.model("UserMembership");
  const user = await User.findOneAndUpdate(
    { schoolId: params.schoolId, email: params.email },
    {
      $set: {
        email: params.email,
        firstName: params.firstName,
        lastName: params.lastName,
        role: params.role,
        schoolId: params.schoolId,
        name: `${params.firstName} ${params.lastName}`,
        pendingOnboarding: false,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  await UserMembership.findOneAndUpdate(
    { userId: user._id, schoolId: params.schoolId },
    {
      $set: {
        userId: user._id,
        schoolId: params.schoolId,
        roles: [params.role],
        status: "active",
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return user;
}

async function seedPeopleAndClass(schoolId: Types.ObjectId): Promise<SeedCtx> {
  const School = mongoose.model("School");
  const User = mongoose.model("User");
  const Teacher = mongoose.model("Teacher");
  const Student = mongoose.model("Student");
  const Guardian = mongoose.model("Guardian");
  const Grade = mongoose.model("Grade");
  const ClassGroup = mongoose.model("ClassGroup");
  const SubjectOffering = mongoose.model("SubjectOffering");
  const AcademicPeriod = mongoose.model("AcademicPeriod");
  const TeacherAssignment = mongoose.model("TeacherAssignment");

  const schoolIdStr = String(schoolId);
  await School.updateOne(
    { _id: schoolId },
    { $set: { name: "Lighthouse Preparatory School", city: "Accra", region: "Greater Accra" } }
  );

  const existingAdmin = await User.findOne({
    schoolId,
    role: "school_admin",
    email: { $in: PRESENTATION_ADMIN.fallbackEmails },
  });
  const admin = existingAdmin
    ? await User.findByIdAndUpdate(
        existingAdmin._id,
        {
          $set: {
            firstName: PRESENTATION_ADMIN.firstName,
            lastName: PRESENTATION_ADMIN.lastName,
            pendingOnboarding: false,
          },
        },
        { new: true }
      )
    : await upsertUser({
        schoolId,
        email: presentationPersonaEmail(PRESENTATION_ADMIN.emailLocal, schoolIdStr),
        firstName: PRESENTATION_ADMIN.firstName,
        lastName: PRESENTATION_ADMIN.lastName,
        role: "school_admin",
      });
  if (!admin) throw new Error("Failed to upsert presentation admin");

  const teacherUser = await upsertUser({
    schoolId,
    email: presentationPersonaEmail(PRESENTATION_TEACHER.emailLocal, schoolIdStr),
    firstName: PRESENTATION_TEACHER.firstName,
    lastName: PRESENTATION_TEACHER.lastName,
    role: "teacher",
  });
  const teacher = await Teacher.findOneAndUpdate(
    { schoolId, userId: teacherUser._id },
    {
      $set: {
        schoolId,
        userId: teacherUser._id,
        employeeId: `PRES-T-${schoolIdStr.slice(-6)}`,
        status: "active",
        department: "Mathematics",
        tags: [PRESENTATION_SEED_MARKER],
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const parentUser = await upsertUser({
    schoolId,
    email: presentationPersonaEmail(PRESENTATION_PARENT.emailLocal, schoolIdStr),
    firstName: PRESENTATION_PARENT.firstName,
    lastName: PRESENTATION_PARENT.lastName,
    role: "parent",
  });

  await AcademicPeriod.updateMany(
    { schoolId, isCurrent: true, yearLabel: { $ne: "2026/2027" } },
    { $set: { isCurrent: false } }
  );
  const period = await AcademicPeriod.findOneAndUpdate(
    { schoolId, yearLabel: "2026/2027", term: "Term 1" },
    {
      $set: {
        schoolId,
        yearLabel: "2026/2027",
        term: "Term 1",
        startDate: new Date("2026-09-07T00:00:00.000Z"),
        endDate: new Date("2026-12-18T00:00:00.000Z"),
        isCurrent: true,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const grade = await Grade.findOneAndUpdate(
    { schoolId, name: PRESENTATION_STUDENT.gradeName },
    {
      $set: {
        schoolId,
        name: PRESENTATION_STUDENT.gradeName,
        code: "JHS2",
        stage: "Basic",
        order: 8,
        isActive: true,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const subjects = new Map<string, Types.ObjectId>();
  const offerings = new Map<string, Types.ObjectId>();
  for (const name of PRESENTATION_SUBJECTS) {
    const subject = await resolvePresentationSubject(schoolId, name);
    subjects.set(name, subject._id);
    const offeringCode = `JHS2-${(subject.code || name.slice(0, 3)).toString().toUpperCase()}`;
    const offering = await SubjectOffering.findOneAndUpdate(
      { schoolId, subjectId: subject._id, code: offeringCode },
      {
        $set: {
          schoolId,
          subjectId: subject._id,
          curriculumCode: "ghana_nacca",
          subjectFamily: name,
          displayName: name,
          shortName: name,
          code: offeringCode,
          stage: "jhs",
          gradeBand: "jhs",
          gradeIds: [grade._id],
          category: "core",
          lessonNoteTemplateVariant: "nacca_jhs",
          isActive: true,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    offerings.set(name, offering._id);
  }

  const mathsSubjectId = subjects.get("Mathematics")!;
  const mathsOfferingId = offerings.get("Mathematics")!;
  const subjectIds = [...subjects.values()];
  const subjectOfferingIds = [...offerings.values()];

  const classGroup = await ClassGroup.findOneAndUpdate(
    { schoolId, gradeId: grade._id, name: PRESENTATION_STUDENT.className },
    {
      $set: {
        schoolId,
        gradeId: grade._id,
        name: PRESENTATION_STUDENT.className,
        subjectIds,
        subjectOfferingIds,
        homeroomTeacherId: teacher._id,
        defaultRoomName: "Room J2A",
        isActive: true,
        capacity: 30,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  await Teacher.updateOne(
    { _id: teacher._id },
    {
      $set: {
        homeroomClassGroupId: classGroup._id,
        subjectIds: [mathsSubjectId],
        subjectOfferingIds: [mathsOfferingId],
      },
    }
  );

  await TeacherAssignment.findOneAndUpdate(
    {
      schoolId,
      teacherId: teacher._id,
      classGroupId: classGroup._id,
      subjectId: mathsSubjectId,
      academicPeriodId: period._id,
    },
    {
      $set: {
        schoolId,
        teacherId: teacher._id,
        classGroupId: classGroup._id,
        subjectId: mathsSubjectId,
        subjectOfferingId: mathsOfferingId,
        academicPeriodId: period._id,
        contactHoursPerWeek: 6,
        status: "active",
        notes: PRESENTATION_SEED_MARKER,
        assignedBy: admin._id,
        assignedAt: new Date(),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const subjectTeacherIds = new Map<string, Types.ObjectId>([
    ["Mathematics", teacher._id],
  ]);
  const extraSubjectTeachers = [
    { subject: "English Language", firstName: "Efua", lastName: "Asante", emailLocal: "efua.asante.teacher" },
    { subject: "Integrated Science", firstName: "Yaw", lastName: "Agyemang", emailLocal: "yaw.agyemang.teacher" },
    { subject: "Social Studies", firstName: "Adwoa", lastName: "Appiah", emailLocal: "adwoa.appiah.teacher" },
    { subject: "Computing", firstName: "Kojo", lastName: "Donkor", emailLocal: "kojo.donkor.teacher" },
    { subject: "Religious and Moral Education", firstName: "Akua", lastName: "Osei", emailLocal: "akua.osei.teacher" },
  ] as const;
  for (const spec of extraSubjectTeachers) {
    const subjectId = subjects.get(spec.subject);
    const offeringId = offerings.get(spec.subject);
    if (!subjectId || !offeringId) continue;
    const user = await upsertUser({
      schoolId,
      email: presentationPersonaEmail(spec.emailLocal, schoolIdStr),
      firstName: spec.firstName,
      lastName: spec.lastName,
      role: "teacher",
    });
    const row = await Teacher.findOneAndUpdate(
      { schoolId, userId: user._id },
      {
        $set: {
          schoolId,
          userId: user._id,
          status: "active",
          department: spec.subject,
          tags: [PRESENTATION_SEED_MARKER],
          subjectIds: [subjectId],
          subjectOfferingIds: [offeringId],
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    await TeacherAssignment.findOneAndUpdate(
      {
        schoolId,
        teacherId: row._id,
        classGroupId: classGroup._id,
        subjectId,
        academicPeriodId: period._id,
      },
      {
        $set: {
          schoolId,
          teacherId: row._id,
          classGroupId: classGroup._id,
          subjectId,
          subjectOfferingId: offeringId,
          academicPeriodId: period._id,
          contactHoursPerWeek: 4,
          status: "active",
          notes: PRESENTATION_SEED_MARKER,
          assignedBy: admin._id,
          assignedAt: new Date(),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    subjectTeacherIds.set(spec.subject, row._id);
  }

  const studentUser = await upsertUser({
    schoolId,
    email: presentationPersonaEmail(PRESENTATION_STUDENT.emailLocal, schoolIdStr),
    firstName: PRESENTATION_STUDENT.firstName,
    lastName: PRESENTATION_STUDENT.lastName,
    role: "student",
  });
  const student = await Student.findOneAndUpdate(
    { schoolId, admissionNo: PRESENTATION_STUDENT.admissionNo },
    {
      $set: {
        schoolId,
        userId: studentUser._id,
        admissionNo: PRESENTATION_STUDENT.admissionNo,
        firstName: PRESENTATION_STUDENT.firstName,
        lastName: PRESENTATION_STUDENT.lastName,
        sex: PRESENTATION_STUDENT.sex,
        gradeId: grade._id,
        classGroupId: classGroup._id,
        status: "active",
        enrolledAt: new Date("2024-09-09T00:00:00.000Z"),
        dateOfBirth: new Date("2012-03-14T00:00:00.000Z"),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  await Guardian.findOneAndUpdate(
    { studentId: student._id, userId: parentUser._id },
    {
      $set: {
        studentId: student._id,
        userId: parentUser._id,
        relationship: PRESENTATION_PARENT.relationship,
        isPrimary: true,
        phone: PRESENTATION_PARENT.phone,
        email: parentUser.email,
        occupation: "Trader",
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const classmateIds: Types.ObjectId[] = [];
  for (let i = 0; i < CLASSMATE_COUNT; i++) {
    const mate = CLASSMATES[i]!;
    const admissionNo = `PRES-S${String(i + 2).padStart(4, "0")}`;
    const email = presentationPersonaEmail(`classmate.${i + 1}`, schoolIdStr);
    const user = await upsertUser({
      schoolId,
      email,
      firstName: mate.firstName,
      lastName: mate.lastName,
      role: "student",
    });
    const row = await Student.findOneAndUpdate(
      { schoolId, admissionNo },
      {
        $set: {
          schoolId,
          userId: user._id,
          admissionNo,
          firstName: mate.firstName,
          lastName: mate.lastName,
          sex: mate.sex,
          gradeId: grade._id,
          classGroupId: classGroup._id,
          status: "active",
          enrolledAt: new Date("2024-09-09T00:00:00.000Z"),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    classmateIds.push(row._id);
  }

  return {
    schoolId,
    adminUserId: admin._id,
    teacherUserId: teacherUser._id,
    teacherId: teacher._id,
    parentUserId: parentUser._id,
    studentId: student._id,
    classmateIds,
    gradeId: grade._id,
    classGroupId: classGroup._id,
    periodId: period._id,
    subjects,
    offerings,
    mathsSubjectId,
    mathsOfferingId,
    subjectTeacherIds,
  };
}

async function seedFees(ctx: SeedCtx) {
  const FeeStructure = mongoose.model("FeeStructure");
  const Invoice = mongoose.model("Invoice");
  const InvoiceLineItem = mongoose.model("InvoiceLineItem");
  const Payment = mongoose.model("Payment");
  const PaymentAllocation = mongoose.model("PaymentAllocation");

  const feeDefs = [
    { name: "Tuition", code: "PRES-TUITION", category: "tuition", amount: 2000 },
    { name: "PTA Levy", code: "PRES-PTA", category: "other", amount: 200 },
    { name: "ICT/Technology Fee", code: "PRES-ICT", category: "other", amount: 150 },
    { name: "Books / Learning Materials", code: "PRES-BOOKS", category: "other", amount: 400 },
  ] as const;

  const structures = [];
  for (const def of feeDefs) {
    const row = await FeeStructure.findOneAndUpdate(
      { schoolId: ctx.schoolId, code: def.code },
      {
        $set: {
          schoolId: ctx.schoolId,
          name: def.name,
          code: def.code,
          category: def.category,
          isActive: true,
          defaultAmountMinor: ghs(def.amount),
          allowsInstallments: def.code === "PRES-TUITION",
          description: PRESENTATION_SEED_MARKER,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    structures.push({ ...def, _id: row._id as Types.ObjectId });
  }

  const dueDate = new Date("2026-10-15T00:00:00.000Z");
  const issueDate = new Date("2026-09-08T00:00:00.000Z");
  const allStudentIds = [ctx.studentId, ...ctx.classmateIds];

  for (const [index, studentId] of allStudentIds.entries()) {
    const invoiceNumber = `PRES-${String(ctx.schoolId).slice(-6)}-${String(index + 1).padStart(4, "0")}`;
    const isKwame = String(studentId) === String(ctx.studentId);
    const paidBooks = true;
    const tuitionPaid = isKwame ? 1500 : index % 4 === 0 ? 800 : 2000;
    const ptaPaid = isKwame ? 0 : index % 3 === 0 ? 0 : 200;
    const ictPaid = isKwame ? 0 : index % 5 === 0 ? 0 : 150;

    const invoice = await Invoice.findOneAndUpdate(
      { schoolId: ctx.schoolId, studentId, academicPeriodId: ctx.periodId },
      {
        $set: {
          schoolId: ctx.schoolId,
          studentId,
          academicPeriodId: ctx.periodId,
          invoiceNumber,
          status: "issued",
          dueDate,
          issueDate,
          notes: PRESENTATION_SEED_MARKER,
          terms: "Payable at the school accounts office or via MoMo.",
          version: 1,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const lineItems = [];
    for (const [order, def] of structures.entries()) {
      const line = await InvoiceLineItem.findOneAndUpdate(
        { invoiceId: invoice._id, name: def.name },
        {
          $set: {
            invoiceId: invoice._id,
            feeStructureId: def._id,
            name: def.name,
            description: PRESENTATION_SEED_MARKER,
            amountMinor: ghs(def.amount),
            displayOrder: order + 1,
            allowsInstallments: def.code === "PRES-TUITION",
            amountPaidMinor: 0,
            amountOutstandingMinor: ghs(def.amount),
            isFullyPaid: false,
            status: "pending",
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      lineItems.push(line);
    }

    const priorPayments = await Payment.find({
      schoolId: ctx.schoolId,
      studentId,
      idempotencyKey: { $regex: `^${PRESENTATION_SEED_MARKER}` },
    })
      .select("_id")
      .lean();
    if (priorPayments.length) {
      await PaymentAllocation.deleteMany({
        paymentId: { $in: priorPayments.map((row) => row._id) },
      });
      await Payment.deleteMany({
        _id: { $in: priorPayments.map((row) => row._id) },
      });
    }

    const payments: Array<{ amount: number; method: string; date: Date; key: string }> = [];
    if (paidBooks) {
      payments.push({
        amount: 400,
        method: "mobile_money",
        date: new Date("2026-09-12T10:00:00.000Z"),
        key: `${PRESENTATION_SEED_MARKER}:books:${studentId}`,
      });
    }
    if (tuitionPaid > 0) {
      payments.push({
        amount: tuitionPaid,
        method: isKwame ? "cash" : "mobile_money",
        date: new Date("2026-09-28T11:30:00.000Z"),
        key: `${PRESENTATION_SEED_MARKER}:tuition:${studentId}`,
      });
    }
    if (ptaPaid > 0) {
      payments.push({
        amount: ptaPaid,
        method: "cash",
        date: new Date("2026-09-20T09:00:00.000Z"),
        key: `${PRESENTATION_SEED_MARKER}:pta:${studentId}`,
      });
    }
    if (ictPaid > 0) {
      payments.push({
        amount: ictPaid,
        method: "bank_transfer",
        date: new Date("2026-09-22T09:00:00.000Z"),
        key: `${PRESENTATION_SEED_MARKER}:ict:${studentId}`,
      });
    }

    let totalPaid = 0;
    const liveLines = lineItems.map((li) => ({
      _id: li._id,
      name: li.name,
      amountMinor: li.amountMinor,
      amountPaidMinor: 0,
      amountOutstandingMinor: li.amountMinor,
      sortOrder: li.displayOrder,
    }));

    for (const pay of payments) {
      const payment = await Payment.create({
        schoolId: ctx.schoolId,
        studentId,
        invoiceId: invoice._id,
        amountMinor: ghs(pay.amount),
        paymentDate: pay.date,
        paymentMethod: pay.method,
        status: "completed",
        approvalStatus: "not_required",
        reconciliationStatus: "fully_reconciled",
        receivedBy: ctx.adminUserId,
        idempotencyKey: pay.key,
        notes: PRESENTATION_SEED_MARKER,
        internalReference: `PRES-${pay.key.split(":")[1]}-${String(studentId).slice(-6)}`,
      });
      const allocation = allocateToInvoiceLineItems({
        lineItems: liveLines,
        amountMinor: ghs(pay.amount),
        mode: "auto",
      });
      for (const alloc of allocation.allocations) {
        await PaymentAllocation.create({
          paymentId: payment._id,
          invoiceLineItemId: alloc.invoiceLineItemId,
          amountMinor: alloc.amountMinor,
          notes: PRESENTATION_SEED_MARKER,
        });
        const line = liveLines.find((l) => String(l._id) === String(alloc.invoiceLineItemId));
        if (line) {
          line.amountPaidMinor += alloc.amountMinor;
          line.amountOutstandingMinor = Math.max(0, line.amountMinor - line.amountPaidMinor);
        }
      }
      totalPaid += ghs(pay.amount);
    }

    for (const line of liveLines) {
      const paid = line.amountPaidMinor;
      const outstanding = line.amountOutstandingMinor;
      await InvoiceLineItem.updateOne(
        { _id: line._id },
        {
          $set: {
            amountPaidMinor: paid,
            amountOutstandingMinor: outstanding,
            isFullyPaid: outstanding === 0,
            status: outstanding === 0 ? "paid" : paid > 0 ? "partially_paid" : "overdue",
          },
        }
      );
    }

    const totalAmount = liveLines.reduce((sum, l) => sum + l.amountMinor, 0);
    const outstanding = totalAmount - totalPaid;
    await Invoice.updateOne(
      { _id: invoice._id },
      {
        $set: {
          totalAmountMinor: totalAmount,
          totalPaidMinor: totalPaid,
          totalOutstandingMinor: outstanding,
          totalCreditAppliedMinor: 0,
          status: outstanding <= 0 ? "paid" : totalPaid > 0 ? "partially_paid" : "overdue",
          paidDate: outstanding <= 0 ? new Date("2026-09-28T11:30:00.000Z") : null,
        },
      }
    );
  }
}

async function seedAttendance(ctx: SeedCtx) {
  const StudentAttendance = mongoose.model("StudentAttendance");
  const dates = weekdayDates(new Date("2026-09-08T00:00:00.000Z"), 20);
  const studentIds = [ctx.studentId, ...ctx.classmateIds];

  await StudentAttendance.deleteMany({
    schoolId: ctx.schoolId,
    classGroupId: ctx.classGroupId,
    recordedBy: ctx.teacherUserId,
  });

  const docs = [];
  for (const date of dates) {
    for (const [index, studentId] of studentIds.entries()) {
      let status: "present" | "absent" | "late" = "present";
      const isKwame = String(studentId) === String(ctx.studentId);
      if (isKwame) {
        if (date.toISOString().startsWith("2026-09-16")) status = "absent";
        else if (date.toISOString().startsWith("2026-09-23")) status = "late";
      } else if (index % 11 === 0 && date.getUTCDate() === 15) {
        status = "absent";
      } else if (index % 9 === 0 && date.getUTCDate() === 18) {
        status = "late";
      }
      docs.push({
        schoolId: ctx.schoolId,
        studentId,
        classGroupId: ctx.classGroupId,
        academicPeriodId: ctx.periodId,
        date,
        type: "homeroom",
        status,
        lateMinutes: status === "late" ? 12 : undefined,
        reason: status === "absent" && isKwame ? "Malaria (clinic note on file)" : undefined,
        recordedBy: ctx.teacherUserId,
      });
    }
  }
  if (docs.length) await StudentAttendance.insertMany(docs);
}

async function seedAcademics(ctx: SeedCtx) {
  const AcademicGradingPolicy = mongoose.model("AcademicGradingPolicy");
  const AssessmentPlan = mongoose.model("AssessmentPlan");
  const AssessmentItem = mongoose.model("AssessmentItem");
  const AssessmentScore = mongoose.model("AssessmentScore");
  const SubjectResult = mongoose.model("SubjectResult");
  const ReportCardRun = mongoose.model("ReportCardRun");
  const StudentReportCard = mongoose.model("StudentReportCard");

  const policy = await AcademicGradingPolicy.findOneAndUpdate(
    { schoolId: ctx.schoolId, name: "Presentation JHS Scale" },
    {
      $set: {
        schoolId: ctx.schoolId,
        name: "Presentation JHS Scale",
        description: PRESENTATION_SEED_MARKER,
        curriculumCode: "ghana_nacca",
        gradeLabelMode: "letters",
        appliesToGradeIds: [ctx.gradeId],
        appliesToGradeBandCodes: ["jhs"],
        isDefault: true,
        status: "active",
        scoreComponents: [
          {
            key: "classwork",
            label: "Classwork",
            weight: 30,
            order: 1,
            required: true,
            allowedAssessmentTypes: ["classwork", "quiz", "midterm", "assignment"],
          },
          {
            key: "exam",
            label: "End-of-Term Examination",
            weight: 70,
            order: 2,
            required: true,
            allowedAssessmentTypes: ["exam"],
          },
        ],
        gradeBoundaries: [
          { gradeLabel: "A", minPercentage: 80, maxPercentage: 100, gradePoint: 4, descriptor: "Excellent" },
          { gradeLabel: "B", minPercentage: 70, maxPercentage: 79.99, gradePoint: 3, descriptor: "Very good" },
          { gradeLabel: "C", minPercentage: 60, maxPercentage: 69.99, gradePoint: 2, descriptor: "Good" },
          { gradeLabel: "D", minPercentage: 50, maxPercentage: 59.99, gradePoint: 1, descriptor: "Fair" },
          { gradeLabel: "E", minPercentage: 0, maxPercentage: 49.99, gradePoint: 0, descriptor: "Needs support" },
        ],
        passMark: 50,
        roundingRule: "nearest_integer",
        showClassPosition: true,
        showSubjectPosition: true,
        showGradeKey: true,
        allowTeacherContributionSelection: true,
        requireAdminApprovalForPolicyChanges: false,
        createdBy: ctx.adminUserId,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const plan = await AssessmentPlan.findOneAndUpdate(
    { schoolId: ctx.schoolId, name: "Presentation Term 1 Plan", academicPeriodId: ctx.periodId },
    {
      $set: {
        schoolId: ctx.schoolId,
        name: "Presentation Term 1 Plan",
        academicPeriodId: ctx.periodId,
        gradingPolicyId: policy._id,
        appliesToGradeId: ctx.gradeId,
        appliesToGradeIds: [ctx.gradeId],
        appliesToClassGroupIds: [ctx.classGroupId],
        curriculumCode: "ghana_nacca",
        status: "active",
        componentRules: [
          { componentKey: "classwork", contributionMode: "average_all" },
          { componentKey: "exam", contributionMode: "average_all" },
        ],
        teacherCanCreateReportItems: true,
        teacherCanMarkItemsAsReportContributing: true,
        allowOfflineMarks: true,
        allowAppAssignmentImport: false,
        allowCsvImport: true,
        minimumCompletionRules: [],
        createdBy: ctx.adminUserId,
        approvedBy: ctx.adminUserId,
        approvedAt: new Date(),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const itemTemplates = [
    { kind: "Class Exercise", type: "classwork", componentKey: "classwork", max: 20 },
    { kind: "Quiz", type: "quiz", componentKey: "classwork", max: 30 },
    { kind: "Mid-Term Assessment", type: "midterm", componentKey: "classwork", max: 50 },
    { kind: "Assignment", type: "assignment", componentKey: "classwork", max: 20 },
    { kind: "End-of-Term Examination", type: "exam", componentKey: "exam", max: 100 },
  ] as const;

  const scoreTargets: Record<string, { classworkPercent: number; examScore: number; remark: string }> = {
    Computing: {
      classworkPercent: 90,
      examScore: 87,
      remark: "Confident with practical computing tasks.",
    },
    Mathematics: {
      classworkPercent: 90,
      examScore: 81,
      remark: "Kwame shows strong algebraic reasoning.",
    },
    "Integrated Science": {
      classworkPercent: 84,
      examScore: 80,
      remark: "Sound scientific method; keep practising investigations.",
    },
    "Religious and Moral Education": {
      classworkPercent: 82,
      examScore: 78,
      remark: "Thoughtful contributions in class discussion.",
    },
    "English Language": {
      classworkPercent: 80,
      examScore: 74,
      remark: "Clear writing; continue building vocabulary.",
    },
    "Social Studies": {
      classworkPercent: 76,
      examScore: 70,
      remark: "Understands the topics; needs more precise answers.",
    },
  };

  const studentIds = [ctx.studentId, ...ctx.classmateIds];

  await AssessmentItem.deleteMany({
    schoolId: ctx.schoolId,
    classGroupId: ctx.classGroupId,
    sourceRefType: PRESENTATION_SEED_MARKER,
  });
  await AssessmentScore.deleteMany({
    schoolId: ctx.schoolId,
    classGroupId: ctx.classGroupId,
    remarks: PRESENTATION_SEED_MARKER,
  });

  const calculated: Array<{
    subjectName: string;
    subjectId: Types.ObjectId;
    teacherId: Types.ObjectId;
    remark: string;
    calc: ReturnType<typeof calculateSubjectResult>;
  }> = [];

  for (const subjectName of PRESENTATION_SUBJECTS) {
    const subjectId = ctx.subjects.get(subjectName);
    const offeringId = ctx.offerings.get(subjectName);
    const teacherId = ctx.subjectTeacherIds.get(subjectName) ?? ctx.teacherId;
    const target = scoreTargets[subjectName];
    if (!subjectId || !offeringId || !target) {
      throw new Error(`Missing presentation subject setup for ${subjectName}`);
    }

    const itemDefs = itemTemplates.map((template) => {
      const percent =
        template.componentKey === "exam" ? target.examScore : target.classworkPercent;
      return {
        ...template,
        title: `${template.kind} — ${subjectName}`,
        kwame: Math.round((template.max * percent) / 100),
      };
    });
    const assessmentItemIds: Types.ObjectId[] = [];

    for (const def of itemDefs) {
      const item = await AssessmentItem.create({
        schoolId: ctx.schoolId,
        academicPeriodId: ctx.periodId,
        assessmentPlanId: plan._id,
        classGroupId: ctx.classGroupId,
        gradeId: ctx.gradeId,
        subjectId,
        subjectOfferingId: offeringId,
        teacherId,
        title: def.title,
        assessmentType: def.type,
        sourceType: "manual",
        sourceRefType: PRESENTATION_SEED_MARKER,
        maxScore: def.max,
        componentKey: def.componentKey,
        contributesToReport: true,
        contributionLockedByRule: false,
        visibility: "visible_to_parent_after_release",
        status: "completed",
        createdBy: ctx.teacherUserId,
        assessedAt: new Date("2026-09-30T00:00:00.000Z"),
      });
      assessmentItemIds.push(item._id);

      const scores = studentIds.map((studentId, index) => {
        const isKwame = String(studentId) === String(ctx.studentId);
        const jitter = ((index * 3) % 5) - 2;
        const raw = isKwame
          ? def.kwame
          : Math.max(8, Math.min(def.max, Math.round(def.max * 0.72) + jitter));
        return {
          schoolId: ctx.schoolId,
          academicPeriodId: ctx.periodId,
          assessmentItemId: item._id,
          assessmentPlanId: plan._id,
          classGroupId: ctx.classGroupId,
          subjectId,
          studentId,
          teacherId,
          score: raw,
          maxScoreSnapshot: def.max,
          percentage: Number(((raw / def.max) * 100).toFixed(1)),
          status: "recorded",
          remarks: PRESENTATION_SEED_MARKER,
          gradedAt: new Date("2026-10-01T00:00:00.000Z"),
          recordedBy: ctx.teacherUserId,
        };
      });
      await AssessmentScore.insertMany(scores);
    }

    const calc = calculateSubjectResult({
      scoreComponents: policy.scoreComponents,
      componentRules: plan.componentRules,
      items: itemDefs.map((def, index) => ({
        id: String(assessmentItemIds[index]),
        componentKey: def.componentKey,
        assessmentType: def.type,
        title: def.title,
        maxScore: def.max,
        contributesToReport: true,
      })),
      scores: itemDefs.map((def, index) => ({
        assessmentItemId: String(assessmentItemIds[index]),
        score: def.kwame,
        status: "recorded" as const,
      })),
      gradeBoundaries: policy.gradeBoundaries,
      passMark: policy.passMark,
      roundingRule: policy.roundingRule,
    });

    await SubjectResult.findOneAndUpdate(
      {
        schoolId: ctx.schoolId,
        studentId: ctx.studentId,
        subjectId,
        academicPeriodId: ctx.periodId,
      },
      {
        $set: {
          schoolId: ctx.schoolId,
          academicPeriodId: ctx.periodId,
          assessmentPlanId: plan._id,
          gradingPolicyId: policy._id,
          classGroupId: ctx.classGroupId,
          gradeId: ctx.gradeId,
          subjectId,
          studentId: ctx.studentId,
          teacherId,
          components: calc.components,
          finalScore: calc.finalScore,
          roundedFinalScore: calc.roundedFinalScore,
          gradeLabel: calc.gradeLabel,
          gradePoint: calc.gradePoint,
          descriptor: calc.descriptor,
          isPassed: calc.isPassed,
          subjectRemark: target.remark,
          missingRequiredItems: calc.missingRequiredItems,
          sourceAssessmentItemIds: assessmentItemIds,
          status: "approved",
          submittedBy: ctx.teacherUserId,
          submittedAt: new Date("2026-10-02T00:00:00.000Z"),
          approvedBy: ctx.adminUserId,
          approvedAt: new Date("2026-10-03T00:00:00.000Z"),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    calculated.push({
      subjectName,
      subjectId,
      teacherId,
      remark: target.remark,
      calc,
    });
  }

  const averageFinalScore =
    Math.round(
      (calculated.reduce((sum, row) => sum + row.calc.roundedFinalScore, 0) /
        calculated.length) *
        10
    ) / 10;

  const run = await ReportCardRun.findOneAndUpdate(
    { schoolId: ctx.schoolId, classGroupId: ctx.classGroupId, academicPeriodId: ctx.periodId },
    {
      $set: {
        schoolId: ctx.schoolId,
        academicPeriodId: ctx.periodId,
        classGroupId: ctx.classGroupId,
        gradeId: ctx.gradeId,
        homeroomTeacherId: ctx.teacherId,
        gradingPolicyId: policy._id,
        assessmentPlanId: plan._id,
        status: "released",
        openedBy: ctx.adminUserId,
        openedAt: new Date("2026-10-01T00:00:00.000Z"),
        compiledBy: ctx.adminUserId,
        compiledAt: new Date("2026-10-03T00:00:00.000Z"),
        submittedBy: ctx.teacherUserId,
        submittedAt: new Date("2026-10-03T00:00:00.000Z"),
        approvedBy: ctx.adminUserId,
        approvedAt: new Date("2026-10-04T00:00:00.000Z"),
        releasedBy: ctx.adminUserId,
        releasedAt: new Date("2026-10-04T00:00:00.000Z"),
        releaseVisibility: { parents: true, students: true },
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  await StudentReportCard.findOneAndUpdate(
    { schoolId: ctx.schoolId, studentId: ctx.studentId, academicPeriodId: ctx.periodId },
    {
      $set: {
        schoolId: ctx.schoolId,
        academicPeriodId: ctx.periodId,
        reportCardRunId: run._id,
        studentId: ctx.studentId,
        classGroupId: ctx.classGroupId,
        gradeId: ctx.gradeId,
        gradingPolicySnapshot: serializeGradingPolicy(policy),
        assessmentPlanSnapshot: { name: plan.name },
        reportTemplateSnapshot: { name: "JHS Term Report", marker: PRESENTATION_SEED_MARKER },
        studentSnapshot: {
          name: `${PRESENTATION_STUDENT.firstName} ${PRESENTATION_STUDENT.lastName}`,
          firstName: PRESENTATION_STUDENT.firstName,
          lastName: PRESENTATION_STUDENT.lastName,
          admissionNo: PRESENTATION_STUDENT.admissionNo,
          classLabel: "JHS 2A",
        },
        schoolSnapshot: { name: "Lighthouse Preparatory School" },
        attendanceSnapshot: { present: 18, absent: 1, late: 1, rate: 95 },
        subjectResultsSnapshot: calculated.map((row) => ({
          subjectId: String(row.subjectId),
          subjectName: row.subjectName,
          teacherId: String(row.teacherId),
          finalScore: row.calc.finalScore,
          roundedFinalScore: row.calc.roundedFinalScore,
          gradeLabel: row.calc.gradeLabel,
          gradePoint: row.calc.gradePoint,
          descriptor: row.calc.descriptor,
          isPassed: row.calc.isPassed,
          subjectRemark: row.remark,
          components: row.calc.components,
          status: "approved",
        })),
        termSummarySnapshot: {
          subjectCount: calculated.length,
          passedSubjectCount: calculated.filter((row) => row.calc.isPassed).length,
          averageFinalScore,
          remark: "A consistent learner with clear strengths in Computing and Mathematics.",
        },
        commentsSnapshot: {
          classTeacher: "Kwame is respectful, participates well, and leads in Mathematics.",
          head: "Keep up the excellent work. Support him to strengthen Computing.",
        },
        status: "released",
        compiledAt: new Date("2026-10-03T00:00:00.000Z"),
        approvedAt: new Date("2026-10-04T00:00:00.000Z"),
        releasedAt: new Date("2026-10-04T00:00:00.000Z"),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function seedTeaching(ctx: SeedCtx) {
  const SchemeOfWork = mongoose.model("SchemeOfWork");
  const SchemeItem = mongoose.model("SchemeItem");
  const LessonNote = mongoose.model("LessonNote");
  const Lesson = mongoose.model("Lesson");
  const TimetableVersion = mongoose.model("TimetableVersion");
  const TimetableSlot = mongoose.model("TimetableSlot");

  const scheme = await SchemeOfWork.findOneAndUpdate(
    { schoolId: ctx.schoolId, title: "JHS 2 Mathematics — Algebraic Expressions" },
    {
      $set: {
        schoolId: ctx.schoolId,
        title: "JHS 2 Mathematics — Algebraic Expressions",
        description: PRESENTATION_SEED_MARKER,
        academicYearLabel: "2026/2027",
        termLabel: "Term 1",
        academicPeriodId: ctx.periodId,
        gradeId: ctx.gradeId,
        classGroupId: ctx.classGroupId,
        subjectId: ctx.mathsSubjectId,
        subjectOfferingId: ctx.mathsOfferingId,
        ownerTeacherId: ctx.teacherId,
        status: "active",
        sourceType: "manual",
        version: 1,
        createdByUserId: ctx.teacherUserId,
        approvedByUserId: ctx.adminUserId,
        approvedAt: new Date("2026-09-05T00:00:00.000Z"),
        activatedByUserId: ctx.adminUserId,
        activatedAt: new Date("2026-09-05T00:00:00.000Z"),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const schemeItem = await SchemeItem.findOneAndUpdate(
    { schoolId: ctx.schoolId, schemeId: scheme._id, sequence: 1 },
    {
      $set: {
        schoolId: ctx.schoolId,
        schemeId: scheme._id,
        weekNumber: 4,
        lessonOrder: 1,
        sequence: 1,
        topic: "Algebraic Expressions",
        title: "Simplifying algebraic expressions",
        strand: "Algebra",
        subStrand: "Algebraic expressions",
        contentStandard: "B8.2.1.1 Demonstrate understanding of algebraic expressions",
        indicator: "B8.2.1.1.1 Simplify algebraic expressions involving addition and subtraction",
        learningObjectives: [
          "Identify like and unlike terms",
          "Simplify algebraic expressions by collecting like terms",
        ],
        teachingResources: ["Number cards", "Whiteboard", "NaCCA JHS Mathematics Book 2"],
        status: "in_progress",
        coverageStatus: "in_progress",
        createdByUserId: ctx.teacherUserId,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const lessonNote = await LessonNote.findOneAndUpdate(
    { schoolId: ctx.schoolId, teacherId: ctx.teacherId, topic: "Algebraic Expressions" },
    {
      $set: {
        schoolId: ctx.schoolId,
        teacherId: ctx.teacherId,
        classGroupId: ctx.classGroupId,
        subjectId: ctx.mathsSubjectId,
        subjectOfferingId: ctx.mathsOfferingId,
        subjectNameSnapshot: "Mathematics",
        academicPeriodId: ctx.periodId,
        templateType: "NACCA_3_PHASE",
        curriculumCode: "ghana_nacca",
        topic: "Algebraic Expressions",
        weekOf: new Date("2026-09-21T00:00:00.000Z"),
        durationMinutes: 60,
        curriculum: {
          strand: "Algebra",
          subStrand: "Algebraic expressions",
          contentStandard: "B8.2.1.1 Demonstrate understanding of algebraic expressions",
          indicators: [
            {
              refNo: "B8.2.1.1.1",
              text: "Simplify algebraic expressions involving addition and subtraction",
            },
          ],
          learningOutcomes: [
            "Learners can collect like terms",
            "Learners can simplify expressions such as 3a + 4a - a",
          ],
        },
        body: {
          starter: {
            activities: "Show cards with 2a, 5a, 3b. Ask which belong together and why.",
            rpkPrompt: "Last week we added whole numbers. How is 2a + 3a similar?",
            engagementHook: "Market story: Ama buys 3 bags of rice and 2 more bags. How many bags?",
            timeMins: 10,
          },
          main: {
            teacherActivities:
              "Model collecting like terms on the board. Work 4a + 3a - a with the class, then guide paired practice.",
            learnerActivities:
              "In pairs, simplify five expressions and present one solution. Stronger learners write a word problem.",
            resourcesUsed: "Whiteboard, counters, NaCCA JHS Mathematics Book 2 p.42",
            embeddedAssessment: "Mini-whiteboards: simplify 5x + 2x - 3x. Thumbs up if confident.",
            differentiation:
              "Support group uses counters. Extension: multiply a simple expression by a constant.",
            groupingStrategy: "Mixed-ability pairs",
            timeMins: 40,
          },
          plenary: {
            summaryPoints: "Like terms have the same letter; we add or subtract their coefficients.",
            learnerReflection: "One thing I can now simplify that I could not yesterday.",
            teacherReflection: "Most learners collected like terms; two still mix x and y terms.",
            exitTicket: "Simplify 7m + 2m - 4m",
            homework: "Exercise 4.2 questions 1–8",
            timeMins: 10,
          },
        },
        assessment: {
          inClassChecks: ["Mini-whiteboard like-terms check", "Paired presentation"],
          exitTicket: "Simplify 7m + 2m - 4m",
          homework: "Exercise 4.2 questions 1–8",
        },
        resources: [{ title: "NaCCA JHS Mathematics Book 2", url: "", type: "doc" }],
        tags: [PRESENTATION_SEED_MARKER],
        status: "approved",
        submittedAt: new Date("2026-09-22T00:00:00.000Z"),
        approvedAt: new Date("2026-09-23T00:00:00.000Z"),
        approvedBy: ctx.adminUserId,
        schemeId: scheme._id,
        schemeItemIds: [schemeItem._id],
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  await Lesson.findOneAndUpdate(
    { schoolId: ctx.schoolId, lessonNoteId: lessonNote._id },
    {
      $set: {
        schoolId: ctx.schoolId,
        teacherId: ctx.teacherId,
        lessonNoteId: lessonNote._id,
        classGroupId: ctx.classGroupId,
        subjectId: ctx.mathsSubjectId,
        subjectOfferingId: ctx.mathsOfferingId,
        academicPeriodId: ctx.periodId,
        title: "Simplifying algebraic expressions",
        scheduledAt: new Date("2026-09-24T09:00:00.000Z"),
        status: "published",
        publishedAt: new Date("2026-09-23T16:00:00.000Z"),
        schemeId: scheme._id,
        schemeItemIds: [schemeItem._id],
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  let version = await TimetableVersion.findOne({
    schoolId: ctx.schoolId,
    academicPeriodId: ctx.periodId,
    status: "published",
  });
  if (!version) {
    version = await TimetableVersion.findOneAndUpdate(
      { schoolId: ctx.schoolId, academicPeriodId: ctx.periodId, name: "Presentation Term 1" },
      {
        $set: {
          schoolId: ctx.schoolId,
          academicPeriodId: ctx.periodId,
          name: "Presentation Term 1",
          status: "published",
          publishedAt: new Date("2026-09-01T00:00:00.000Z"),
          createdBy: ctx.adminUserId,
          updatedBy: ctx.adminUserId,
          lockVersion: 1,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  await TimetableSlot.deleteMany({
    schoolId: ctx.schoolId,
    versionId: version._id,
    classroomLabel: "Room J2A",
  });

  const slots = [
    { dayOfWeek: 1, startTime: "08:00", endTime: "08:40" },
    { dayOfWeek: 2, startTime: "09:30", endTime: "10:10" },
    { dayOfWeek: 3, startTime: "08:00", endTime: "08:40" },
    { dayOfWeek: 4, startTime: "11:00", endTime: "11:40" },
    { dayOfWeek: 5, startTime: "08:40", endTime: "09:20" },
  ];
  await TimetableSlot.insertMany(
    slots.map((slot) => ({
      schoolId: ctx.schoolId,
      academicPeriodId: ctx.periodId,
      versionId: version._id,
      classGroupId: ctx.classGroupId,
      gradeId: ctx.gradeId,
      subjectId: ctx.mathsSubjectId,
      subjectOfferingId: ctx.mathsOfferingId,
      teacherId: ctx.teacherId,
      dayOfWeek: slot.dayOfWeek,
      startTime: slot.startTime,
      endTime: slot.endTime,
      classroomLabel: "Room J2A",
      source: "manual",
      createdBy: ctx.adminUserId,
      updatedBy: ctx.adminUserId,
    }))
  );
}

async function seedCommunications(ctx: SeedCtx) {
  const Notice = mongoose.model("Notice");
  const MessageThread = mongoose.model("MessageThread");
  const Message = mongoose.model("Message");

  const notices = [
    {
      title: "Parent-Teacher Meeting",
      message:
        "Join us in the assembly hall on Friday 17 October at 3:00pm to discuss Term 1 progress. JHS 2A meets Mr. Owusu in Room J2A.",
    },
    {
      title: "Mid-Term Break Reminder",
      message:
        "School closes on Friday 24 October and reopens on Monday 3 November. Please complete outstanding assignments before the break.",
    },
    {
      title: "Outstanding Fee Reminder",
      message:
        "Families with a balance on the Term 1 bill are asked to settle at the accounts office or via MoMo. Speak to the office if you need a payment plan.",
    },
    {
      title: "End-of-Term Examination Schedule",
      message:
        "End-of-term examinations begin 1 December. Mathematics for JHS 2 is on Tuesday 2 December, 8:00am. A full timetable is on the notice board.",
    },
  ];

  for (const notice of notices) {
    await Notice.findOneAndUpdate(
      { schoolId: ctx.schoolId, teacherId: ctx.teacherId, title: notice.title },
      {
        $set: {
          schoolId: ctx.schoolId,
          teacherId: ctx.teacherId,
          title: notice.title,
          message: `${notice.message}\n\n[${PRESENTATION_SEED_MARKER}]`,
          audience: "school",
          classGroupIds: [ctx.classGroupId],
          status: "published",
          publishedAt: new Date("2026-09-30T08:00:00.000Z"),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  const thread = await MessageThread.findOneAndUpdate(
    {
      schoolId: ctx.schoolId,
      studentId: ctx.studentId,
      subject: "Kwame Mensah — Term 1 check-in",
    },
    {
      $set: {
        schoolId: ctx.schoolId,
        studentId: ctx.studentId,
        subject: "Kwame Mensah — Term 1 check-in",
        participants: [
          { userId: ctx.teacherUserId, role: "teacher" },
          { userId: ctx.parentUserId, role: "parent" },
          { userId: ctx.adminUserId, role: "school_admin" },
        ],
        lastMessageAt: new Date("2026-09-29T14:00:00.000Z"),
        lastMessagePreview: "Please find Kwame's current fee balance and attendance note.",
        createdBy: ctx.adminUserId,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  await Message.deleteMany({ threadId: thread._id, body: { $regex: PRESENTATION_SEED_MARKER } });
  await Message.create({
    threadId: thread._id,
    schoolId: ctx.schoolId,
    senderId: ctx.adminUserId,
    body: `Akosua, this is a school-only note confirming Kwame's Term 1 picture: strong Mathematics, one short absence, and a remaining fee balance of GHS ${PRESENTATION_OUTSTANDING_CEDIS}. [${PRESENTATION_SEED_MARKER}]`,
  });
}

export async function resetPresentationForSchool(schoolId: Types.ObjectId) {
  await loadModels();
  const Student = mongoose.model("Student");
  const Payment = mongoose.model("Payment");
  const students = await Student.find({
    schoolId,
    admissionNo: { $regex: /^PRES-S/ },
  })
    .select("_id classGroupId")
    .lean();
  const studentIds = students.map((s) => s._id);
  const classGroupIds = [
    ...new Set(students.map((s) => String(s.classGroupId)).filter(Boolean)),
  ].map((id) => new Types.ObjectId(id));

  const payments = await Payment.find({
    schoolId,
    idempotencyKey: { $regex: `^${PRESENTATION_SEED_MARKER}` },
  })
    .select("_id")
    .lean();
  if (payments.length) {
    await mongoose.model("PaymentAllocation").deleteMany({
      paymentId: { $in: payments.map((row) => row._id) },
    });
  }
  await Payment.deleteMany({
    schoolId,
    idempotencyKey: { $regex: `^${PRESENTATION_SEED_MARKER}` },
  });
  await mongoose.model("InvoiceLineItem").deleteMany({ description: PRESENTATION_SEED_MARKER });
  await mongoose.model("Invoice").deleteMany({ schoolId, notes: PRESENTATION_SEED_MARKER });
  await mongoose.model("FeeStructure").deleteMany({
    schoolId,
    description: PRESENTATION_SEED_MARKER,
  });
  if (studentIds.length) {
    await mongoose.model("StudentAttendance").deleteMany({
      schoolId,
      studentId: { $in: studentIds },
    });
    await mongoose.model("Guardian").deleteMany({ studentId: { $in: studentIds } });
    await mongoose.model("AssessmentScore").deleteMany({
      schoolId,
      studentId: { $in: studentIds },
    });
    await mongoose.model("SubjectResult").deleteMany({
      schoolId,
      studentId: { $in: studentIds },
    });
    await mongoose.model("StudentReportCard").deleteMany({
      schoolId,
      studentId: { $in: studentIds },
    });
    await mongoose.model("Student").deleteMany({ _id: { $in: studentIds } });
  }
  if (classGroupIds.length) {
    await mongoose.model("ReportCardRun").deleteMany({
      schoolId,
      classGroupId: { $in: classGroupIds },
    });
  }
  await mongoose.model("AssessmentItem").deleteMany({
    schoolId,
    sourceRefType: PRESENTATION_SEED_MARKER,
  });
  await mongoose.model("Notice").deleteMany({
    schoolId,
    message: { $regex: PRESENTATION_SEED_MARKER },
  });
  await mongoose.model("Message").deleteMany({
    schoolId,
    body: { $regex: PRESENTATION_SEED_MARKER },
  });
  await mongoose.model("MessageThread").deleteMany({
    schoolId,
    subject: "Kwame Mensah — Term 1 check-in",
  });
  const notes = await mongoose
    .model("LessonNote")
    .find({ schoolId, tags: PRESENTATION_SEED_MARKER })
    .select("_id")
    .lean();
  if (notes.length) {
    await mongoose.model("Lesson").deleteMany({
      schoolId,
      lessonNoteId: { $in: notes.map((row) => row._id) },
    });
  }
  await mongoose.model("LessonNote").deleteMany({
    schoolId,
    tags: PRESENTATION_SEED_MARKER,
  });
  const schemes = await mongoose
    .model("SchemeOfWork")
    .find({ schoolId, description: PRESENTATION_SEED_MARKER })
    .select("_id")
    .lean();
  if (schemes.length) {
    await mongoose.model("SchemeItem").deleteMany({
      schoolId,
      schemeId: { $in: schemes.map((row) => row._id) },
    });
  }
  await mongoose.model("SchemeOfWork").deleteMany({
    schoolId,
    description: PRESENTATION_SEED_MARKER,
  });
  await mongoose.model("TeacherAssignment").deleteMany({
    schoolId,
    notes: PRESENTATION_SEED_MARKER,
  });
  await mongoose.model("TimetableSlot").deleteMany({
    schoolId,
    classroomLabel: "Room J2A",
  });
}

export async function seedPresentationForSchool(schoolId: Types.ObjectId) {
  await loadModels();
  const ctx = await seedPeopleAndClass(schoolId);
  await seedFees(ctx);
  await seedAttendance(ctx);
  await seedAcademics(ctx);
  await seedTeaching(ctx);
  await seedCommunications(ctx);
  const Invoice = mongoose.model("Invoice");
  const invoice = await Invoice.findOne({
    schoolId,
    studentId: ctx.studentId,
    academicPeriodId: ctx.periodId,
  })
    .select("totalOutstandingMinor")
    .lean();
  return {
    studentId: String(ctx.studentId),
    outstandingMinor: invoice?.totalOutstandingMinor ?? null,
    teacherId: String(ctx.teacherId),
  };
}

async function sandboxSchoolIds() {
  const DemoSandbox = mongoose.model("DemoSandbox");
  const rows = await DemoSandbox.find({}).select("schoolId").lean();
  return rows.map((row) => row.schoolId as Types.ObjectId);
}

export async function runPresentationSeed(options: { reset: boolean }) {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is required");
  const dbName = resolvePresentationDatabaseName();
  assertPresentationDemoDatabase(dbName);

  await mongoose.connect(uri, { dbName });
  assertPresentationDemoDatabase(mongoose.connection.name || dbName);
  await loadModels();

  const schoolIds = await sandboxSchoolIds();
  if (schoolIds.length === 0) {
    throw new Error(
      "No DemoSandbox schools found. Seed the flagship sandbox pool first, then rerun this presentation seed."
    );
  }

  const results = [];
  for (const schoolId of schoolIds) {
    if (options.reset) {
      await resetPresentationForSchool(schoolId);
    }
    results.push(await seedPresentationForSchool(schoolId));
  }

  console.log(
    `[presentation-seed] ${options.reset ? "Reset and reseeded" : "Seeded"} ${schoolIds.length} sandbox school(s) on ${dbName}.`
  );
  console.log(
    `[presentation-seed] Primary student ${PRESENTATION_STUDENT.title}; target outstanding GHS ${PRESENTATION_OUTSTANDING_CEDIS}; first school outstandingMinor=${results[0]?.outstandingMinor}`
  );
  return results;
}

async function main() {
  dotenv.config({ path: path.join(root, ".env.demo") });
  dotenv.config({ path: path.join(root, ".env.local") });
  const reset = process.argv.includes("--reset");
  await runPresentationSeed({ reset });
  await mongoose.disconnect();
}

if (process.argv[1]?.includes("seed-demo-presentation")) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
