// scripts/seed-jhs-classes.ts
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
import { Grade } from "../src/models/Grade";
import { ClassGroup } from "../src/models/ClassGroup";
import { Subject } from "../src/models/Subject";
import { Student } from "../src/models/Student";

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
    describe: "Specific school ID to use (otherwise uses first active school)",
  })
  .help()
  .parseSync();

// Common JHS subjects
const JHS_SUBJECTS = [
  { name: "Mathematics", code: "MATH" },
  { name: "English Language", code: "ENG" },
  { name: "Integrated Science", code: "SCI" },
  { name: "Social Studies", code: "SOC" },
  { name: "Religious and Moral Education", code: "RME" },
  { name: "Information and Communication Technology", code: "ICT" },
  { name: "Ghanaian Language", code: "GHA" },
  { name: "French", code: "FRE" },
  { name: "Physical Education", code: "PE" },
  { name: "Creative Arts", code: "ART" },
];

// JHS grade names
const JHS_GRADES = [
  { name: "JHS 1", code: "JHS1", order: 1 },
  { name: "JHS 2", code: "JHS2", order: 2 },
  { name: "JHS 3", code: "JHS3", order: 3 },
];

// Class group names
const CLASS_GROUP_NAMES = ["A", "B"];

// Sample first names (mix of Ghanaian and common names)
const FIRST_NAMES = [
  "Kwame",
  "Ama",
  "Kofi",
  "Akosua",
  "Yaw",
  "Abena",
  "Kojo",
  "Efua",
  "Kwaku",
  "Adwoa",
  "John",
  "Mary",
  "Michael",
  "Sarah",
  "David",
  "Grace",
  "Emmanuel",
  "Patience",
  "Samuel",
  "Ruth",
  "Daniel",
  "Esther",
  "Joseph",
  "Hannah",
  "Benjamin",
  "Deborah",
];

// Sample last names
const LAST_NAMES = [
  "Mensah",
  "Osei",
  "Asante",
  "Boateng",
  "Darko",
  "Owusu",
  "Agyeman",
  "Appiah",
  "Amoah",
  "Asiedu",
  "Amoako",
  "Bonsu",
  "Gyamfi",
  "Kwarteng",
  "Sarpong",
  "Tetteh",
  "Adjei",
  "Adu",
  "Agyei",
  "Amoako",
];

// Middle names (optional)
const MIDDLE_NAMES = [
  "Kofi",
  "Ama",
  "Yaw",
  "Akosua",
  "Kwame",
  "Abena",
  "Kojo",
  "Efua",
  null,
  null,
  null,
];

function randomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function generateStudentName(): {
  firstName: string;
  middleName: string | null;
  lastName: string;
  sex: "male" | "female";
} {
  const firstName = randomElement(FIRST_NAMES);
  const lastName = randomElement(LAST_NAMES);
  const middleName = randomElement(MIDDLE_NAMES);

  // Determine sex based on common Ghanaian name patterns
  const isFemale =
    firstName.startsWith("Ama") ||
    firstName.startsWith("Akosua") ||
    firstName.startsWith("Abena") ||
    firstName.startsWith("Efua") ||
    firstName.startsWith("Adwoa") ||
    firstName === "Mary" ||
    firstName === "Sarah" ||
    firstName === "Grace" ||
    firstName === "Patience" ||
    firstName === "Ruth" ||
    firstName === "Esther" ||
    firstName === "Hannah" ||
    firstName === "Deborah";

  return {
    firstName,
    middleName: middleName || null,
    lastName,
    sex: isFemale ? "female" : "male",
  };
}

function generateAdmissionNo(
  gradeCode: string,
  classGroupName: string,
  index: number
): string {
  const year = new Date().getFullYear();
  const paddedIndex = String(index).padStart(2, "0");
  return `${year}-${gradeCode}-${classGroupName}-${paddedIndex}`;
}

async function main() {
  const cliUri = argv.mongo || undefined;
  await connectToDatabase(cliUri);

  // Get or find school
  let schoolId: mongoose.Types.ObjectId;
  if (argv.schoolId) {
    if (!mongoose.Types.ObjectId.isValid(argv.schoolId)) {
      console.error("Invalid schoolId provided");
      process.exit(1);
    }
    const school = await School.findById(argv.schoolId);
    if (!school) {
      console.error(`School with ID ${argv.schoolId} not found`);
      process.exit(1);
    }
    schoolId = school._id;
    console.log(`Using school: ${school.name} (${schoolId})`);
  } else {
    // Find first active school or create one
    let school = await School.findOne({ status: "active" });
    if (!school) {
      school = await School.findOne();
    }
    if (!school) {
      console.log("No school found. Creating a default school...");
      school = await School.create({
        name: "Demo School",
        type: "Basic",
        status: "active",
      });
    }
    schoolId = school._id;
    console.log(`Using school: ${school.name} (${schoolId})`);
  }

  if (argv.dryRun) {
    console.log("\n🔍 DRY RUN MODE - No changes will be made\n");
  }

  // Step 1: Create or find subjects
  console.log("\n📚 Creating/verifying subjects...");
  const subjects: mongoose.Types.ObjectId[] = [];
  for (const subj of JHS_SUBJECTS) {
    let subject = await Subject.findOne({
      schoolId,
      name: { $regex: new RegExp(`^${subj.name}$`, "i") },
    });

    if (!subject) {
      if (argv.dryRun) {
        console.log(`  [DRY] Would create subject: ${subj.name}`);
        subjects.push(new mongoose.Types.ObjectId());
      } else {
        subject = await Subject.create({
          schoolId,
          name: subj.name,
          code: subj.code,
          isActive: true,
        });
        console.log(`  ✓ Created subject: ${subj.name}`);
      }
    } else {
      console.log(`  ✓ Found existing subject: ${subj.name}`);
    }

    if (subject) {
      subjects.push(subject._id);
    }
  }

  // Step 2: Create or find JHS grades
  console.log("\n🎓 Creating/verifying JHS grades...");
  const grades: Map<string, mongoose.Types.ObjectId> = new Map();
  for (const gradeData of JHS_GRADES) {
    let grade = await Grade.findOne({
      schoolId,
      name: { $regex: new RegExp(`^${gradeData.name}$`, "i") },
    });

    if (!grade) {
      if (argv.dryRun) {
        console.log(`  [DRY] Would create grade: ${gradeData.name}`);
        grades.set(gradeData.name, new mongoose.Types.ObjectId());
      } else {
        grade = await Grade.create({
          schoolId,
          name: gradeData.name,
          code: gradeData.code,
          stage: "Basic",
          order: gradeData.order,
          isActive: true,
        });
        console.log(`  ✓ Created grade: ${gradeData.name}`);
      }
    } else {
      console.log(`  ✓ Found existing grade: ${gradeData.name}`);
    }

    if (grade) {
      grades.set(gradeData.name, grade._id);
    }
  }

  // Step 3: Create class groups (2 per grade)
  console.log("\n🏫 Creating class groups...");
  const classGroups: Array<{
    gradeName: string;
    name: string;
    id: mongoose.Types.ObjectId;
  }> = [];

  for (const gradeName of JHS_GRADES.map((g) => g.name)) {
    const gradeId = grades.get(gradeName);
    if (!gradeId) {
      console.error(`  ✗ Grade ${gradeName} not found, skipping`);
      continue;
    }

    for (const groupName of CLASS_GROUP_NAMES) {
      let classGroup = await ClassGroup.findOne({
        schoolId,
        gradeId,
        name: { $regex: new RegExp(`^${groupName}$`, "i") },
      });

      if (!classGroup) {
        if (argv.dryRun) {
          console.log(
            `  [DRY] Would create class group: ${gradeName} ${groupName}`
          );
          classGroups.push({
            gradeName,
            name: groupName,
            id: new mongoose.Types.ObjectId(),
          });
        } else {
          classGroup = await ClassGroup.create({
            schoolId,
            gradeId,
            name: groupName,
            subjectIds: subjects, // Assign all subjects to each class
            isActive: true,
            capacity: 30,
          });
          console.log(`  ✓ Created class group: ${gradeName} ${groupName}`);
        }
      } else {
        // Update subjects if not set
        if (classGroup.subjectIds.length === 0 && !argv.dryRun) {
          classGroup.subjectIds = subjects;
          await classGroup.save();
          console.log(
            `  ✓ Updated class group: ${gradeName} ${groupName} (added subjects)`
          );
        } else {
          console.log(`  ✓ Found existing class group: ${gradeName} ${groupName}`);
        }
      }

      if (classGroup) {
        classGroups.push({
          gradeName,
          name: groupName,
          id: classGroup._id,
        });
      }
    }
  }

  // Step 4: Create students (10 per class group)
  console.log("\n👥 Creating students...");
  let totalStudentsCreated = 0;
  let totalStudentsSkipped = 0;

  for (const classGroup of classGroups) {
    const gradeId = grades.get(classGroup.gradeName);
    if (!gradeId) continue;

    const gradeCode = JHS_GRADES.find((g) => g.name === classGroup.gradeName)
      ?.code || "JHS";

    for (let i = 1; i <= 10; i++) {
      const admissionNo = generateAdmissionNo(
        gradeCode,
        classGroup.name,
        i
      );

      // Check if student already exists
      const existing = await Student.findOne({
        schoolId,
        admissionNo,
      });

      if (existing) {
        totalStudentsSkipped++;
        continue;
      }

      const nameData = generateStudentName();
      const dateOfBirth = new Date(
        2008 + Math.floor(Math.random() * 3), // Age 15-17
        Math.floor(Math.random() * 12),
        Math.floor(Math.random() * 28) + 1
      );

      if (argv.dryRun) {
        console.log(
          `  [DRY] Would create student: ${nameData.firstName} ${nameData.lastName} (${admissionNo}) in ${classGroup.gradeName} ${classGroup.name}`
        );
        totalStudentsCreated++;
      } else {
        await Student.create({
          schoolId,
          admissionNo,
          firstName: nameData.firstName,
          middleName: nameData.middleName,
          lastName: nameData.lastName,
          sex: nameData.sex,
          dateOfBirth,
          gradeId,
          classGroupId: classGroup.id,
          status: "active",
          enrolledAt: new Date(2023, 0, 1), // Enrolled in 2023
          photoUrl: null, // Explicitly null as requested
        });
        totalStudentsCreated++;
      }
    }
  }

  // Summary
  console.log("\n" + "=".repeat(50));
  console.log("📊 SUMMARY");
  console.log("=".repeat(50));
  console.log(`Subjects: ${subjects.length} (${JHS_SUBJECTS.length} expected)`);
  console.log(`Grades: ${grades.size} (${JHS_GRADES.length} expected)`);
  console.log(
    `Class Groups: ${classGroups.length} (${JHS_GRADES.length * CLASS_GROUP_NAMES.length} expected)`
  );
  console.log(`Students Created: ${totalStudentsCreated}`);
  console.log(`Students Skipped (already exist): ${totalStudentsSkipped}`);
  console.log(
    `Total Students: ${totalStudentsCreated + totalStudentsSkipped}`
  );

  if (argv.dryRun) {
    console.log("\n🔍 This was a dry run. Use without --dryRun to apply changes.");
  } else {
    console.log("\n✅ Done!");
  }

  await disconnectDatabase();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
