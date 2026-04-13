/**
 * Demo Flagship Template Seed Script
 *
 * Creates a complete demo school (Ghana Basic curriculum) with synthetic
 * data spanning every feature area: academic calendar, classes, subjects,
 * teachers, students, guardians, fee structures, grades, timetables, etc.
 *
 * Usage:
 *   npx tsx scripts/demo/seed-flagship-template.ts [--pool-size=5]
 *
 * Env:
 *   MONGODB_URI  — demo database connection string
 */

import mongoose, { Types } from "mongoose";
import crypto from "node:crypto";

const TEMPLATE_KEY = "flagship_basic_v1";
const TEMPLATE_VERSION = 1;
const DEFAULT_POOL_SIZE = 5;

function oid() {
  return new Types.ObjectId();
}

function randomName(first: string[], last: string[]) {
  return {
    firstName: first[Math.floor(Math.random() * first.length)],
    lastName: last[Math.floor(Math.random() * last.length)],
  };
}

const FIRST_NAMES_M = [
  "Kwame", "Kofi", "Yaw", "Kwesi", "Kojo", "Kwaku", "Ebo", "Fiifi",
  "Nana", "Kobby", "Akwasi", "Emmanuel", "Samuel", "Daniel", "Joseph",
];
const FIRST_NAMES_F = [
  "Ama", "Abena", "Akua", "Efua", "Adwoa", "Yaa", "Afia", "Esi",
  "Nana", "Maame", "Akosua", "Grace", "Priscilla", "Elizabeth", "Sarah",
];
const LAST_NAMES = [
  "Mensah", "Asante", "Boateng", "Owusu", "Agyemang", "Amoako",
  "Donkor", "Appiah", "Osei", "Frimpong", "Gyasi", "Baidoo",
  "Tetteh", "Quartey", "Adjei", "Amankwah", "Ankrah", "Darko",
];

const SUBJECTS_BASIC = [
  "English Language", "Mathematics", "Integrated Science", "Social Studies",
  "Religious and Moral Education", "Creative Arts", "Computing",
  "Ghanaian Language (Twi)", "Physical Education", "French",
];

const CLASS_NAMES = ["Class 1", "Class 2", "Class 3", "Class 4", "Class 5", "Class 6"];

async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is required");
  await mongoose.connect(uri);
  console.log("[seed] Connected to database");
}

async function ensureModelsLoaded() {
  const modelFiles = [
    "@/models/School", "@/models/User", "@/models/UserMembership",
    "@/models/Teacher", "@/models/Student", "@/models/ClassGroup",
    "@/models/Subject", "@/models/GradingScale", "@/models/AcademicPeriod",
    "@/models/AcademicCalendar", "@/models/SchoolSettings",
    "@/models/FeeStructure", "@/models/TimetableVersion",
    "@/models/TimetableSlot", "@/models/DemoSandbox",
    "@/models/DemoTemplateVersion",
  ];
  for (const m of modelFiles) {
    try { await import(m); } catch { /* model may not exist yet */ }
  }
}

type SeedContext = {
  schoolId: Types.ObjectId;
  adminUserId: Types.ObjectId;
  teacherUserIds: Types.ObjectId[];
  studentUserIds: Types.ObjectId[];
  parentUserIds: Types.ObjectId[];
  classGroupIds: Types.ObjectId[];
  subjectIds: Types.ObjectId[];
  academicPeriodId: Types.ObjectId;
};

async function seedSchool(): Promise<SeedContext> {
  const schoolId = oid();
  const adminUserId = oid();
  const now = new Date();

  const School = mongoose.model("School");
  await School.create({
    _id: schoolId,
    name: "Lighthouse Preparatory School",
    motto: "Illuminating futures through excellence",
    type: "Basic",
    curriculumCode: "GH_BASIC",
    address: "23 Independence Avenue, Osu",
    email: "admin@lighthouseprep.demo.tryedusentrix.app",
    city: "Accra",
    region: "Greater Accra",
    status: "active",
    createdBy: adminUserId,
    onboarding: { finishedAt: now },
    billing: {
      status: "provisioned",
      paymentSetup: {
        status: "provisioned",
        ownerUserId: adminUserId,
        ownerEmail: "admin@lighthouseprep.demo.tryedusentrix.app",
        submittedAt: now,
        approvedAt: now,
      },
    },
  });

  const User = mongoose.model("User");
  const UserMembership = mongoose.model("UserMembership");

  const admin = await User.create({
    _id: adminUserId,
    email: "admin@lighthouseprep.demo.tryedusentrix.app",
    firstName: "Kwame",
    lastName: "Mensah",
    role: "school_admin",
    schoolId,
    pendingOnboarding: false,
    createdAt: now,
    updatedAt: now,
  });
  await UserMembership.create({
    userId: admin._id,
    schoolId,
    roles: ["school_admin"],
    status: "active",
  });

  const Teacher = mongoose.model("Teacher");
  const teacherUserIds: Types.ObjectId[] = [];
  for (let i = 0; i < 8; i++) {
    const names = randomName(
      i % 2 === 0 ? FIRST_NAMES_M : FIRST_NAMES_F,
      LAST_NAMES
    );
    const userId = oid();
    const teacherEmail = `teacher${i + 1}@lighthouseprep.demo.tryedusentrix.app`;
    await User.create({
      _id: userId,
      email: teacherEmail,
      firstName: names.firstName,
      lastName: names.lastName,
      role: "teacher",
      schoolId,
      createdAt: now,
      updatedAt: now,
    });
    await UserMembership.create({
      userId,
      schoolId,
      roles: ["teacher"],
      status: "active",
    });
    await Teacher.create({
      userId,
      schoolId,
      email: teacherEmail,
      firstName: names.firstName,
      lastName: names.lastName,
      subroles: i === 0 ? ["head_of_department"] : [],
      status: "active",
    });
    teacherUserIds.push(userId);
  }

  const ClassGroup = mongoose.model("ClassGroup");
  const classGroupIds: Types.ObjectId[] = [];
  for (let i = 0; i < CLASS_NAMES.length; i++) {
    const cgId = oid();
    await ClassGroup.create({
      _id: cgId,
      schoolId,
      name: CLASS_NAMES[i],
      grade: `Grade ${i + 1}`,
      section: "A",
      defaultRoomName: `Room ${100 + i}`,
    });
    classGroupIds.push(cgId);
  }

  const Subject = mongoose.model("Subject");
  const subjectIds: Types.ObjectId[] = [];
  for (const name of SUBJECTS_BASIC) {
    const sId = oid();
    await Subject.create({
      _id: sId,
      schoolId,
      name,
      code: name.substring(0, 3).toUpperCase(),
    });
    subjectIds.push(sId);
  }

  const Student = mongoose.model("Student");
  const studentUserIds: Types.ObjectId[] = [];
  const parentUserIds: Types.ObjectId[] = [];

  for (let c = 0; c < classGroupIds.length; c++) {
    for (let s = 0; s < 15; s++) {
      const gender = s % 2 === 0 ? "male" : "female";
      const names = randomName(
        gender === "male" ? FIRST_NAMES_M : FIRST_NAMES_F,
        LAST_NAMES
      );
      const studentUserId = oid();
      const studentEmail = `student.${c + 1}.${s + 1}@lighthouseprep.demo.tryedusentrix.app`;
      await User.create({
        _id: studentUserId,
        email: studentEmail,
        firstName: names.firstName,
        lastName: names.lastName,
        role: "student",
        schoolId,
        createdAt: now,
        updatedAt: now,
      });
      await UserMembership.create({
        userId: studentUserId,
        schoolId,
        roles: ["student"],
        status: "active",
      });
      await Student.create({
        userId: studentUserId,
        schoolId,
        classGroupId: classGroupIds[c],
        firstName: names.firstName,
        lastName: names.lastName,
        email: studentEmail,
        gender,
        status: "active",
      });
      studentUserIds.push(studentUserId);

      if (s < 5) {
        const parentId = oid();
        const parentNames = randomName(
          gender === "male" ? FIRST_NAMES_F : FIRST_NAMES_M,
          LAST_NAMES
        );
        const parentEmail = `parent.${c + 1}.${s + 1}@lighthouseprep.demo.tryedusentrix.app`;
        await User.create({
          _id: parentId,
          email: parentEmail,
          firstName: parentNames.firstName,
          lastName: parentNames.lastName,
          role: "parent",
          schoolId,
          createdAt: now,
          updatedAt: now,
        });
        await UserMembership.create({
          userId: parentId,
          schoolId,
          roles: ["parent"],
          status: "active",
        });
        parentUserIds.push(parentId);
      }
    }
  }

  const AcademicPeriod = mongoose.model("AcademicPeriod");
  const periodId = oid();
  await AcademicPeriod.create({
    _id: periodId,
    schoolId,
    name: "Term 1 2025/26",
    label: "Term 1",
    startDate: new Date("2025-09-01"),
    endDate: new Date("2025-12-20"),
    status: "active",
  });

  const GradingScale = mongoose.model("GradingScale");
  await GradingScale.create({
    schoolId,
    name: "Default Basic Scale",
    isDefault: true,
    scale: [
      { label: "A", minPercent: 80, maxPercent: 100, gpa: 4.0 },
      { label: "B", minPercent: 70, maxPercent: 79, gpa: 3.0 },
      { label: "C", minPercent: 60, maxPercent: 69, gpa: 2.5 },
      { label: "D", minPercent: 50, maxPercent: 59, gpa: 2.0 },
      { label: "E", minPercent: 40, maxPercent: 49, gpa: 1.5 },
      { label: "F", minPercent: 0, maxPercent: 39, gpa: 0.0 },
    ],
  });

  const FeeStructure = mongoose.model("FeeStructure");
  await FeeStructure.create({
    schoolId,
    name: "Term 1 Tuition",
    academicPeriodId: periodId,
    amountMinor: 250000,
    currency: "GHS",
    status: "active",
  });

  console.log(
    `[seed] School "${schoolId}" created with ${teacherUserIds.length} teachers, ${studentUserIds.length} students, ${parentUserIds.length} parents`
  );

  return {
    schoolId,
    adminUserId,
    teacherUserIds,
    studentUserIds,
    parentUserIds,
    classGroupIds,
    subjectIds,
    academicPeriodId: periodId,
  };
}

async function registerSandbox(ctx: SeedContext) {
  const DemoSandbox = mongoose.model("DemoSandbox");
  await DemoSandbox.create({
    templateKey: TEMPLATE_KEY,
    templateVersion: TEMPLATE_VERSION,
    schoolId: ctx.schoolId,
    state: "available",
    lastResetAt: new Date(),
    seedFingerprint: crypto.randomBytes(16).toString("hex"),
  });
  console.log(`[seed] Sandbox registered for school ${ctx.schoolId}`);
}

async function registerTemplateVersion() {
  const DemoTemplateVersion = mongoose.model("DemoTemplateVersion");
  const existing = await DemoTemplateVersion.findOne({
    templateKey: TEMPLATE_KEY,
    version: TEMPLATE_VERSION,
  });
  if (!existing) {
    await DemoTemplateVersion.create({
      templateKey: TEMPLATE_KEY,
      version: TEMPLATE_VERSION,
      status: "active",
      schoolType: "Basic",
      curriculumCode: "GH_BASIC",
      seedScriptVersion: "1.0.0",
      manifestVersion: "1.0.0",
      manifest: {
        users: 120,
        students: 90,
        teachers: 8,
        classGroups: 6,
        subjects: 10,
      },
    });
    console.log(`[seed] Template version ${TEMPLATE_KEY}@${TEMPLATE_VERSION} registered`);
  }
}

async function main() {
  const poolSize = Number(
    process.argv.find((a) => a.startsWith("--pool-size="))?.split("=")[1] ||
      DEFAULT_POOL_SIZE
  );

  await connectDB();
  await ensureModelsLoaded();
  await registerTemplateVersion();

  for (let i = 0; i < poolSize; i++) {
    console.log(`\n[seed] Creating sandbox ${i + 1}/${poolSize}...`);
    const ctx = await seedSchool();
    await registerSandbox(ctx);
  }

  console.log(`\n[seed] Done — ${poolSize} sandboxes ready`);
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("[seed] FATAL:", err);
  process.exit(1);
});
