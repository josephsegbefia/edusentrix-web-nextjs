// src/lib/demo/seeder.ts
// Demo data seeding - creates isolated demo environment for each session

import "server-only";
import mongoose from "mongoose";
import { DEMO_SEED_CONFIG } from "./config";

// Import models
import { School } from "@/models/School";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { Student } from "@/models/Student";
import { ClassGroup } from "@/models/ClassGroup";
import { Subject } from "@/models/Subject";
import { Activity } from "@/models/Activity";
import { FeeStructure } from "@/models/FeeStructure";
import { Grade } from "@/models/Grade";
import { User } from "@/models/User";

interface SeedOptions {
  organizationName: string;
  adminName: string;
  adminEmail: string;
}

interface SeedResult {
  schoolId: mongoose.Types.ObjectId;
  stats: {
    students: number;
    teachers: number;
    classGroups: number;
    subjects: number;
    activities: number;
  };
}

// Demo data generators
const FIRST_NAMES = [
  "James", "Mary", "John", "Patricia", "Robert", "Jennifer", "Michael", "Linda",
  "William", "Elizabeth", "David", "Barbara", "Richard", "Susan", "Joseph", "Jessica",
  "Thomas", "Sarah", "Charles", "Karen", "Christopher", "Lisa", "Daniel", "Nancy",
  "Matthew", "Betty", "Anthony", "Margaret", "Mark", "Sandra", "Donald", "Ashley",
  "Kwame", "Ama", "Kofi", "Akua", "Yaw", "Yaa", "Kwesi", "Efua", "Kojo", "Adjoa",
];

const LAST_NAMES = [
  "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis",
  "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson",
  "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson",
  "Mensah", "Osei", "Asante", "Boateng", "Owusu", "Agyeman", "Adjei", "Amoah",
  "Appiah", "Badu", "Danso", "Frimpong", "Gyamfi", "Kyei", "Nkrumah", "Ofori",
];

const SUBJECTS_LIST = [
  { name: "Mathematics", code: "MATH" },
  { name: "English Language", code: "ENG" },
  { name: "Science", code: "SCI" },
  { name: "Social Studies", code: "SOC" },
  { name: "Information Technology", code: "ICT" },
  { name: "French", code: "FRE" },
  { name: "Physical Education", code: "PE" },
  { name: "Creative Arts", code: "ART" },
  { name: "Religious and Moral Education", code: "RME" },
  { name: "Ghanaian Language", code: "GHL" },
  { name: "History", code: "HIS" },
  { name: "Geography", code: "GEO" },
];

const GRADE_NAMES = [
  { name: "Primary 1", code: "P1", order: 1 },
  { name: "Primary 2", code: "P2", order: 2 },
  { name: "Primary 3", code: "P3", order: 3 },
  { name: "Primary 4", code: "P4", order: 4 },
  { name: "Primary 5", code: "P5", order: 5 },
  { name: "Primary 6", code: "P6", order: 6 },
  { name: "JHS 1", code: "JHS1", order: 7 },
  { name: "JHS 2", code: "JHS2", order: 8 },
];

const STUDENT_STATUSES: ("active" | "inactive")[] = ["active", "active", "active", "active", "inactive"];

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function generateAdmissionNo(index: number): string {
  const year = new Date().getFullYear();
  return `ADM${year}${String(index).padStart(4, "0")}`;
}

/**
 * Seed demo data for a tenant
 */
export async function seedDemoData(
  demoTenantId: string,
  options: SeedOptions
): Promise<SeedResult> {
  const { organizationName, adminName, adminEmail } = options;
  const config = DEMO_SEED_CONFIG;

  console.log(`[Demo Seeder] Starting seed for tenant: ${demoTenantId}`);
  const startTime = Date.now();

  // Create a demo user for the admin (not linked to Clerk, just for data relations)
  const demoUser = await User.create({
    email: adminEmail,
    firstName: adminName.split(" ")[0] || "Demo",
    lastName: adminName.split(" ").slice(1).join(" ") || "Admin",
    role: "school_admin",
    demoTenantId,
  });

  // Create school
  const school = await School.create({
    name: `${organizationName} Demo School`,
    type: "Basic",
    email: adminEmail,
    status: "active",
    demoTenantId,
    createdBy: demoUser._id,
  });

  const schoolId = school._id as mongoose.Types.ObjectId;

  // Create academic periods
  const now = new Date();
  const periods = await AcademicPeriod.insertMany([
    {
      schoolId,
      demoTenantId,
      yearLabel: "2025",
      term: "Term 1",
      startDate: new Date(now.getFullYear(), 0, 6),
      endDate: new Date(now.getFullYear(), 3, 10),
      isCurrent: false,
    },
    {
      schoolId,
      demoTenantId,
      yearLabel: "2025",
      term: "Term 2",
      startDate: new Date(now.getFullYear(), 4, 1),
      endDate: new Date(now.getFullYear(), 7, 15),
      isCurrent: true,
    },
    {
      schoolId,
      demoTenantId,
      yearLabel: "2025",
      term: "Term 3",
      startDate: new Date(now.getFullYear(), 8, 1),
      endDate: new Date(now.getFullYear(), 11, 20),
      isCurrent: false,
    },
  ]);

  // Create subjects
  const subjects = await Subject.insertMany(
    SUBJECTS_LIST.slice(0, config.subjectsCount).map((s) => ({
      schoolId,
      demoTenantId,
      name: s.name,
      code: s.code,
      isActive: true,
    }))
  );

  // Create grades
  const grades = await Grade.insertMany(
    GRADE_NAMES.slice(0, config.classGroupsCount).map((g) => ({
      schoolId,
      demoTenantId,
      name: g.name,
      code: g.code,
      order: g.order,
      stage: g.name.startsWith("JHS") ? "Secondary" : "Basic",
      isActive: true,
    }))
  );

  // Create class groups (one per grade with section "A")
  const classGroups = await ClassGroup.insertMany(
    grades.map((grade) => ({
      schoolId,
      demoTenantId,
      gradeId: grade._id,
      name: "A",
      subjectIds: subjects.slice(0, 6).map((s) => s._id), // First 6 subjects per class
      capacity: 35,
      isActive: true,
    }))
  );

  // Create students (no userId, just basic student records)
  const studentDocs = [];
  for (let i = 0; i < config.studentsCount; i++) {
    const firstName = randomElement(FIRST_NAMES);
    const lastName = randomElement(LAST_NAMES);
    const classGroup = randomElement(classGroups);
    // Find the grade for this class group
    const grade = grades.find((g) => String(g._id) === String(classGroup.gradeId));

    studentDocs.push({
      schoolId,
      demoTenantId,
      firstName,
      lastName,
      admissionNo: generateAdmissionNo(i + 1),
      sex: Math.random() > 0.5 ? "male" : "female",
      status: randomElement(STUDENT_STATUSES),
      dateOfBirth: randomDate(new Date(2010, 0, 1), new Date(2018, 11, 31)),
      classGroupId: classGroup._id,
      gradeId: grade?._id,
      enrolledAt: randomDate(new Date(2023, 0, 1), new Date()),
    });
  }
  const students = await Student.insertMany(studentDocs);

  // Create fee structures
  await FeeStructure.insertMany([
    {
      schoolId,
      demoTenantId,
      name: "Tuition Fee",
      code: "TUITION",
      category: "tuition",
      defaultAmountMinor: 150000, // 1500 GHS in pesewas
      isActive: true,
    },
    {
      schoolId,
      demoTenantId,
      name: "Library Fee",
      code: "LIBRARY",
      category: "library",
      defaultAmountMinor: 5000, // 50 GHS
      isActive: true,
    },
    {
      schoolId,
      demoTenantId,
      name: "Sports Fee",
      code: "SPORTS",
      category: "sports",
      defaultAmountMinor: 3000, // 30 GHS
      isActive: true,
    },
  ]);

  // Create activity logs
  const activityTypes: Array<{
    type: "student.created" | "class_group.created" | "academic_period.created" | "subject.created" | "fee.created" | "settings.updated";
    description: string;
  }> = [
    { type: "student.created", description: "New student enrolled" },
    { type: "class_group.created", description: "Class group created" },
    { type: "academic_period.created", description: "Academic period created" },
    { type: "subject.created", description: "Subject added" },
    { type: "fee.created", description: "Fee structure created" },
    { type: "settings.updated", description: "Settings updated" },
  ];

  const activityDocs = [];
  for (let i = 0; i < config.activitiesCount; i++) {
    const activityType = randomElement(activityTypes);
    activityDocs.push({
      schoolId,
      demoTenantId,
      type: activityType.type,
      userId: demoUser._id,
      description: activityType.description,
      createdAt: randomDate(
        new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        now
      ),
      metadata: {},
    });
  }
  await Activity.insertMany(activityDocs);

  const duration = Date.now() - startTime;
  console.log(`[Demo Seeder] Completed in ${duration}ms for tenant: ${demoTenantId}`);

  return {
    schoolId,
    stats: {
      students: students.length,
      teachers: 0, // Teachers require userId linked to Clerk, skipping for demo
      classGroups: classGroups.length,
      subjects: subjects.length,
      activities: config.activitiesCount,
    },
  };
}
