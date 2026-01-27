/* eslint-disable @typescript-eslint/no-explicit-any */
// scripts/seed-academics.ts
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
import { AcademicPeriod } from "../src/models/AcademicPeriod";
import { SubjectGrade } from "../src/models/SubjectGrade";
import { TermResult } from "../src/models/TermResult";
import { TeacherComment } from "../src/models/TeacherComment";
import { Teacher } from "../src/models/Teacher";
import { User } from "../src/models/User";
import { GradingScale, type IGradingScale } from "../src/models/GradingScale";
import {
  resolveGradingScaleLetter,
  calculateTermResultFromSubjectGrades,
} from "../src/lib/academics/calculateGrades";

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
    describe: "Specific school ID to use",
    demandOption: true,
  })
  .help()
  .parseSync();

// Teacher names for creating teacher accounts
const TEACHER_NAMES = [
  { firstName: "Kwame", lastName: "Asante", subjects: ["Mathematics"] },
  { firstName: "Ama", lastName: "Mensah", subjects: ["English Language"] },
  { firstName: "Kofi", lastName: "Boateng", subjects: ["Integrated Science"] },
  { firstName: "Akosua", lastName: "Darko", subjects: ["Social Studies"] },
  {
    firstName: "Yaw",
    lastName: "Owusu",
    subjects: ["Religious and Moral Education"],
  },
  {
    firstName: "Abena",
    lastName: "Agyeman",
    subjects: ["Information and Communication Technology"],
  },
  { firstName: "Kojo", lastName: "Appiah", subjects: ["Ghanaian Language"] },
  { firstName: "Efua", lastName: "Osei", subjects: ["French"] },
  { firstName: "Kwaku", lastName: "Amoah", subjects: ["Physical Education"] },
  { firstName: "Adwoa", lastName: "Asiedu", subjects: ["Creative Arts"] },
];

// Comment templates
const COMMENT_TEMPLATES = {
  subject: [
    "Shows excellent understanding of the subject matter.",
    "Needs to improve in this subject area.",
    "Demonstrates consistent effort and improvement.",
    "Should focus more on exam preparation.",
  ],
  general: [
    "A diligent student who shows great potential.",
    "Keep up the good work and continue striving for excellence.",
    "Needs to be more consistent with assignments.",
    "Shows improvement but can do better with more focus.",
  ],
  promotion: [
    "Ready to proceed to the next level.",
    "Has met all requirements for promotion.",
    "Promoted with distinction.",
  ],
  behavior: [
    "Well-behaved and respectful in class.",
    "Shows leadership qualities among peers.",
    "Needs to improve classroom behavior.",
  ],
};

function randomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number, decimals = 1): number {
  return Number((Math.random() * (max - min) + min).toFixed(decimals));
}

// Generate realistic scores based on performance tier
function generateScores(
  performanceTier: "top" | "above_average" | "average" | "at_risk"
): {
  caPercentage: number;
  examPercentage: number;
  totalScore: number;
} {
  let caMin: number, caMax: number, examMin: number, examMax: number;

  switch (performanceTier) {
    case "top":
      caMin = 75;
      caMax = 95;
      examMin = 80;
      examMax = 98;
      break;
    case "above_average":
      caMin = 65;
      caMax = 80;
      examMin = 65;
      examMax = 85;
      break;
    case "average":
      caMin = 50;
      caMax = 70;
      examMin = 50;
      examMax = 75;
      break;
    case "at_risk":
      caMin = 35;
      caMax = 55;
      examMin = 30;
      examMax = 60;
      break;
  }

  const caPercentage = randomFloat(caMin, caMax);
  const examPercentage = randomFloat(examMin, examMax);
  // CA weight: 30%, Exam weight: 70%
  const totalScore = caPercentage * 0.3 + examPercentage * 0.7;

  return { caPercentage, examPercentage, totalScore };
}

async function main() {
  const cliUri = argv.mongo || undefined;
  await connectToDatabase(cliUri);

  // Validate schoolId
  if (!mongoose.Types.ObjectId.isValid(argv.schoolId)) {
    console.error("Invalid schoolId provided");
    process.exit(1);
  }

  const schoolId = new mongoose.Types.ObjectId(argv.schoolId);
  const school = await School.findById(schoolId);
  if (!school) {
    console.error(`School with ID ${argv.schoolId} not found`);
    process.exit(1);
  }

  console.log(`Using school: ${school.name} (${schoolId})`);

  if (argv.dryRun) {
    console.log("\n🔍 DRY RUN MODE - No changes will be made\n");
  }

  // Step 1: Query all students for this school
  console.log("\n👥 Fetching students...");
  const students = await Student.find({ schoolId, status: "active" })
    .select("_id firstName lastName classGroupId gradeId")
    .lean();

  if (students.length === 0) {
    console.error("No active students found for this school!");
    process.exit(1);
  }

  console.log(`  ✓ Found ${students.length} active students`);

  // Step 2: Get class groups and their subjects
  console.log("\n🏫 Fetching class groups and subjects...");
  const classGroupIds = [...new Set(students.map((s) => s.classGroupId))];
  const classGroups = await ClassGroup.find({
    _id: { $in: classGroupIds },
  })
    .select("_id name gradeId subjectIds")
    .lean();

  const classGroupMap = new Map<string, (typeof classGroups)[number]>(
    classGroups.map((cg) => [
      (cg._id as mongoose.Types.ObjectId).toString(),
      cg,
    ])
  );

  // Get all unique subject IDs
  const allSubjectIds = new Set<mongoose.Types.ObjectId>();
  classGroups.forEach((cg) => {
    cg.subjectIds.forEach((sid: mongoose.Types.ObjectId) =>
      allSubjectIds.add(sid)
    );
  });

  const subjects = await Subject.find({
    _id: { $in: Array.from(allSubjectIds) },
  })
    .select("_id name code")
    .lean();

  const subjectMap = new Map<string, (typeof subjects)[number]>(
    subjects.map((s) => [(s._id as mongoose.Types.ObjectId).toString(), s])
  );
  console.log(`  ✓ Found ${subjects.length} subjects`);

  // Step 3: Get or create grading scale
  console.log("\n📊 Setting up grading scale...");
  let gradingScale = await GradingScale.findOne({
    schoolId,
    isDefault: true,
  });

  if (!gradingScale) {
    const defaultScale = {
      schoolId,
      name: "Default Grading Scale",
      isDefault: true,
      caWeight: 0.3,
      examWeight: 0.7,
      gradeMappings: [
        { minPercentage: 80, maxPercentage: 100, letter: "A", point: 4.0 },
        { minPercentage: 70, maxPercentage: 79.9, letter: "B", point: 3.0 },
        { minPercentage: 60, maxPercentage: 69.9, letter: "C", point: 2.0 },
        { minPercentage: 50, maxPercentage: 59.9, letter: "D", point: 1.0 },
        { minPercentage: 0, maxPercentage: 49.9, letter: "F", point: 0.0 },
      ],
    };

    if (argv.dryRun) {
      console.log("  [DRY] Would create grading scale");
      gradingScale = defaultScale as IGradingScale;
    } else {
      gradingScale = await GradingScale.create(defaultScale);
      console.log("  ✓ Created grading scale");
    }
  } else {
    console.log("  ✓ Found existing grading scale");
  }

  // Step 4: Create or find teachers
  console.log("\n👨‍🏫 Setting up teachers...");
  const teacherMap = new Map<string, mongoose.Types.ObjectId>(); // subject name -> teacherId

  for (const teacherData of TEACHER_NAMES) {
    const subject = subjects.find((s) =>
      teacherData.subjects.some((subjName) =>
        s.name.toLowerCase().includes(subjName.toLowerCase())
      )
    );

    if (!subject) continue;

    // Find or create User
    const email = `${teacherData.firstName.toLowerCase()}.${teacherData.lastName.toLowerCase()}@${school.name
      .toLowerCase()
      .replace(/\s+/g, "")}.edu`;
    let user = await User.findOne({ email, schoolId });

    if (!user) {
      if (argv.dryRun) {
        console.log(
          `  [DRY] Would create user: ${teacherData.firstName} ${teacherData.lastName}`
        );
        user = { _id: new mongoose.Types.ObjectId() } as any;
      } else {
        user = await User.create({
          email,
          firstName: teacherData.firstName,
          lastName: teacherData.lastName,
          schoolId,
          role: "teacher",
        });
        console.log(
          `  ✓ Created user: ${teacherData.firstName} ${teacherData.lastName}`
        );
      }
    }

    // Find or create Teacher
    let teacher = await Teacher.findOne({
      schoolId,
      userId: user._id,
    });

    if (!teacher) {
      if (argv.dryRun) {
        console.log(`  [DRY] Would create teacher record`);
        teacher = { _id: new mongoose.Types.ObjectId() } as any;
      } else {
        teacher = await Teacher.create({
          schoolId,
          userId: user._id,
          subjectIds: [subject._id],
          status: "active",
        });
        console.log(`  ✓ Created teacher record for ${subject.name}`);
      }
    }

    teacherMap.set(subject.name, teacher._id);
  }

  // Step 5: Create academic periods (2 years = 6 terms)
  console.log("\n📅 Creating academic periods...");
  const currentYear = new Date().getFullYear();
  const periods: mongoose.Types.ObjectId[] = [];

  for (let year = currentYear - 2; year < currentYear; year++) {
    const yearLabel = `${year}/${year + 1}`;
    for (let term = 1; term <= 3; term++) {
      const termName = `Term ${term}`;
      const startDate = new Date(year, (term - 1) * 4, 1); // Jan, May, Sep
      const endDate = new Date(year, term * 4 - 1, 30); // Apr, Aug, Dec

      let period = await AcademicPeriod.findOne({
        schoolId,
        yearLabel,
        term: termName,
      });

      if (!period) {
        if (argv.dryRun) {
          console.log(`  [DRY] Would create period: ${yearLabel} ${termName}`);
          periods.push(new mongoose.Types.ObjectId());
        } else {
          period = await AcademicPeriod.create({
            schoolId,
            yearLabel,
            term: termName,
            startDate,
            endDate,
            isCurrent: year === currentYear - 1 && term === 3, // Latest term is current
          });
          console.log(`  ✓ Created period: ${yearLabel} ${termName}`);
        }
      } else {
        console.log(`  ✓ Found existing period: ${yearLabel} ${termName}`);
      }

      if (period) {
        periods.push(period._id);
      }
    }
  }

  if (argv.dryRun) {
    console.log(`  [DRY] Would create ${periods.length} periods`);
  }

  // Step 6: Generate SubjectGrade records
  console.log("\n📝 Generating subject grades...");
  let subjectGradesCreated = 0;
  let termResultsCreated = 0;
  let commentsCreated = 0;

  // Group students by class group for term result calculations
  const studentsByClassGroup = new Map<
    string,
    Array<{
      studentId: mongoose.Types.ObjectId;
      gradeId: mongoose.Types.ObjectId;
    }>
  >();

  students.forEach((student) => {
    const cgId = student.classGroupId.toString();
    if (!studentsByClassGroup.has(cgId)) {
      studentsByClassGroup.set(cgId, []);
    }
    studentsByClassGroup.get(cgId)!.push({
      studentId: student._id as mongoose.Types.ObjectId,
      gradeId: student.gradeId as mongoose.Types.ObjectId,
    });
  });

  // Process each period
  for (const periodId of periods) {
    const period = await AcademicPeriod.findById(periodId);
    if (!period) continue;

    console.log(`\n  Processing ${period.yearLabel} ${period.term}...`);

    // Process each student
    for (const student of students) {
      const classGroup = classGroupMap.get(student.classGroupId.toString());
      if (!classGroup) continue;

      const studentSubjects = classGroup.subjectIds || [];
      const studentSubjectGrades: Array<{
        totalScore: number;
      }> = [];

      // Generate performance tier for this student-term (varies slightly)
      const baseTier = randomElement([
        "top",
        "above_average",
        "average",
        "at_risk",
      ] as const);
      const performanceTier = randomElement([
        baseTier,
        baseTier,
        "average", // Bias toward average
      ] as const);

      // Create SubjectGrade for each subject
      for (const subjectId of studentSubjects) {
        const subject = subjectMap.get(subjectId.toString());
        if (!subject) continue;

        const teacherId = teacherMap.get(subject.name);
        if (!teacherId) continue;

        // Check if already exists
        const existing = await SubjectGrade.findOne({
          schoolId,
          studentId: student._id,
          academicPeriodId: periodId,
          subjectId,
        });

        if (existing && !argv.dryRun) {
          continue; // Skip if already exists
        }

        const { caPercentage, examPercentage, totalScore } =
          generateScores(performanceTier);

        // Calculate CA and Exam scores (assuming max scores)
        const caMaxTotal = 30; // 30% max
        const caTotal = (caPercentage / 100) * caMaxTotal;
        const examMaxScore = 70; // 70% max
        const examScore = (examPercentage / 100) * examMaxScore;

        // Get grade letter
        const mapping = resolveGradingScaleLetter(totalScore, gradingScale);
        const gradeLetter = mapping?.letter || "F";
        const gradePoint = mapping?.point || 0;
        const isPassed = totalScore >= 50;

        if (argv.dryRun) {
          subjectGradesCreated++;
          studentSubjectGrades.push({ totalScore });
        } else {
          await SubjectGrade.create({
            schoolId,
            academicPeriodId: periodId,
            subjectId,
            studentId: student._id,
            teacherId,
            caTotal,
            caMaxTotal,
            caPercentage,
            examScore,
            examMaxScore,
            examPercentage,
            totalScore,
            gradeLetter,
            gradePoint,
            isPassed,
            lastUpdated: new Date(),
          });
          subjectGradesCreated++;
          studentSubjectGrades.push({ totalScore });
        }
      }

      // Create TermResult
      const classGroupId = classGroup._id as mongoose.Types.ObjectId;
      const classGroupStudents =
        studentsByClassGroup.get(classGroupId.toString()) || [];
      const totalStudents = classGroupStudents.length;

      // Calculate class position (random but realistic)
      const classPosition = randomInt(1, totalStudents);

      const termResultData = calculateTermResultFromSubjectGrades(
        studentSubjectGrades,
        totalStudents,
        classPosition
      );

      const existingTermResult = await TermResult.findOne({
        schoolId,
        studentId: student._id,
        academicPeriodId: periodId,
      });

      if (!existingTermResult) {
        if (argv.dryRun) {
          termResultsCreated++;
        } else {
          await TermResult.create({
            schoolId,
            academicPeriodId: periodId,
            studentId: student._id,
            classGroupId: classGroup._id,
            totalSubjects: termResultData.totalSubjects,
            totalScore: termResultData.totalScore,
            averageScore: termResultData.averageScore,
            classPosition,
            totalStudents,
            performanceTier: termResultData.performanceTier,
            gpa: termResultData.averageScore / 25, // Rough GPA calculation
            isPromoted: termResultData.averageScore >= 50,
            calculatedAt: new Date(),
          });
          termResultsCreated++;
        }
      }

      // Create teacher comments (1-2 per student per term)
      const numComments = randomInt(1, 2);
      for (let i = 0; i < numComments; i++) {
        const commentType = randomElement([
          "subject",
          "general",
          "promotion",
          "behavior",
        ] as const);

        const templates = COMMENT_TEMPLATES[commentType];
        const comment = randomElement(templates);

        // Randomly assign to a subject or general
        const subjectId =
          commentType === "subject" && studentSubjects.length > 0
            ? randomElement(studentSubjects)
            : null;

        const teacherId = subjectId
          ? teacherMap.get(subjectMap.get(subjectId.toString())?.name || "")
          : randomElement(Array.from(teacherMap.values()));

        if (!teacherId) continue;

        if (argv.dryRun) {
          commentsCreated++;
        } else {
          await TeacherComment.create({
            schoolId,
            academicPeriodId: periodId,
            studentId: student._id,
            subjectId,
            teacherId,
            commentType,
            comment,
            isPublic: true,
          });
          commentsCreated++;
        }
      }
    }
  }

  // Summary
  console.log("\n" + "=".repeat(50));
  console.log("📊 SUMMARY");
  console.log("=".repeat(50));
  console.log(`Students processed: ${students.length}`);
  console.log(`Academic periods: ${periods.length}`);
  console.log(`Subject grades created: ${subjectGradesCreated}`);
  console.log(`Term results created: ${termResultsCreated}`);
  console.log(`Teacher comments created: ${commentsCreated}`);

  if (argv.dryRun) {
    console.log(
      "\n🔍 This was a dry run. Use without --dryRun to apply changes."
    );
  } else {
    console.log("\n✅ Done!");
  }

  await disconnectDatabase();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
