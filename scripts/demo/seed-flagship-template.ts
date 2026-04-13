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
 * Loads env from `.env.demo` (then `.env.local` as fallback) so you
 * don't need to pass MONGODB_URI manually.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __filename = typeof __dirname !== "undefined"
  ? path.join(__dirname, "seed-flagship-template.ts")
  : fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(__filename), "../..");
dotenv.config({ path: path.join(root, ".env.demo") });
dotenv.config({ path: path.join(root, ".env.local") });

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

const GRADES = [
  { name: "Grade 1", code: "G1", order: 1 },
  { name: "Grade 2", code: "G2", order: 2 },
  { name: "Grade 3", code: "G3", order: 3 },
  { name: "Grade 4", code: "G4", order: 4 },
  { name: "Grade 5", code: "G5", order: 5 },
  { name: "Grade 6", code: "G6", order: 6 },
];

async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is required");
  await mongoose.connect(uri);
  console.log("[seed] Connected to database");
}

async function ensureModelsLoaded() {
  const modelFiles = [
    "@/models/School", "@/models/User", "@/models/UserMembership",
    "@/models/Teacher", "@/models/Student", "@/models/Grade",
    "@/models/ClassGroup",
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
    curriculumCode: "ghana_nacca",
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
      employeeId: `DEMO-T${String(i + 1).padStart(3, "0")}`,
      subroles: i === 0 ? ["head_of_department"] : [],
      status: "active",
    });
    teacherUserIds.push(userId);
  }

  const Grade = mongoose.model("Grade");
  const gradeIds: Types.ObjectId[] = [];
  for (const g of GRADES) {
    const gId = oid();
    await Grade.create({
      _id: gId,
      schoolId,
      name: g.name,
      code: g.code,
      stage: "Basic",
      order: g.order,
      isActive: true,
    });
    gradeIds.push(gId);
  }

  const ClassGroup = mongoose.model("ClassGroup");
  const classGroupIds: Types.ObjectId[] = [];
  for (let i = 0; i < GRADES.length; i++) {
    const cgId = oid();
    await ClassGroup.create({
      _id: cgId,
      schoolId,
      gradeId: gradeIds[i],
      name: "A",
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
        gradeId: gradeIds[c],
        classGroupId: classGroupIds[c],
        firstName: names.firstName,
        lastName: names.lastName,
        sex: gender,
        admissionNo: `DEMO-S${String(c * 15 + s + 1).padStart(4, "0")}`,
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
    yearLabel: "2025/2026",
    term: "Term 1",
    startDate: new Date("2025-09-01"),
    endDate: new Date("2025-12-20"),
    isCurrent: true,
  });

  const GradingScale = mongoose.model("GradingScale");
  await GradingScale.create({
    schoolId,
    name: "Default Basic Scale",
    isDefault: true,
    gradeMappings: [
      { letter: "A", minPercentage: 80, maxPercentage: 100, point: 4.0 },
      { letter: "B", minPercentage: 70, maxPercentage: 79, point: 3.0 },
      { letter: "C", minPercentage: 60, maxPercentage: 69, point: 2.5 },
      { letter: "D", minPercentage: 50, maxPercentage: 59, point: 2.0 },
      { letter: "E", minPercentage: 40, maxPercentage: 49, point: 1.5 },
      { letter: "F", minPercentage: 0, maxPercentage: 39, point: 0.0 },
    ],
    caWeight: 0.3,
    examWeight: 0.7,
    passThreshold: 50,
  });

  const FeeStructure = mongoose.model("FeeStructure");
  await FeeStructure.create({
    schoolId,
    name: "Term 1 Tuition",
    code: "TUITION",
    category: "tuition",
    defaultAmountMinor: 250000,
    isActive: true,
    allowsInstallments: true,
    maxInstallments: 3,
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
      curriculumCode: "ghana_nacca",
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

async function cleanPreviousRun() {
  const db = mongoose.connection.db;
  if (!db) return;
  const collections = await db.listCollections().toArray();
  const names = collections.map((c) => c.name);

  const toClean = [
    "schools", "users", "usermemberships", "teachers", "students",
    "grades", "classgroups", "subjects", "gradingscales", "academicperiods",
    "academiccalendars", "schoolsettings", "feestructures",
    "timetableversions", "timetableslots",
    "demosandboxes", "demotemplateversions", "demosessions",
    "demoleads", "demoevents",
  ];

  for (const name of toClean) {
    if (names.includes(name)) {
      await db.collection(name).deleteMany({});
      console.log(`[clean] Cleared ${name}`);
    }
  }
}

async function main() {
  const poolSize = Number(
    process.argv.find((a) => a.startsWith("--pool-size="))?.split("=")[1] ||
      DEFAULT_POOL_SIZE
  );
  const shouldClean = process.argv.includes("--clean");

  await connectDB();
  await ensureModelsLoaded();

  if (shouldClean) {
    console.log("[seed] Cleaning previous demo data...");
    await cleanPreviousRun();
  }

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
