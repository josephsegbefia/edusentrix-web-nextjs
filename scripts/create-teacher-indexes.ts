/* eslint-disable @typescript-eslint/no-explicit-any */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

import connectToDatabase, {
  disconnectDatabase,
} from "../src/db/connectToDatabase";

import { StudentAttendance } from "../src/models/StudentAttendance";
import { Homework } from "../src/models/Homework";
import { Submission } from "../src/models/Submission";
import { Rubric } from "../src/models/Rubric";
import { Notice } from "../src/models/Notice";
import { MessageThread } from "../src/models/MessageThread";
import { Message } from "../src/models/Message";
import { Escalation } from "../src/models/Escalation";
import { JournalEntry } from "../src/models/JournalEntry";
import { TeacherPermission } from "../src/models/TeacherPermission";

async function main() {
  try {
    await connectToDatabase();

    await StudentAttendance.collection.createIndex(
      { studentId: 1, date: 1, type: 1 },
      { unique: true, partialFilterExpression: { type: "homeroom" } }
    );
    await StudentAttendance.collection.createIndex(
      { studentId: 1, date: 1, periodNumber: 1 },
      { unique: true, partialFilterExpression: { type: "period" } }
    );
    await StudentAttendance.collection.createIndex({ schoolId: 1, classGroupId: 1, date: 1 });
    await StudentAttendance.collection.createIndex({ schoolId: 1, date: 1, status: 1 });

    await Homework.collection.createIndex(
      { schoolId: 1, teacherId: 1, status: 1, createdAt: -1 }
    );
    await Homework.collection.createIndex(
      { schoolId: 1, classGroupIds: 1, status: 1, dueDate: 1 }
    );

    await Submission.collection.createIndex(
      { homeworkId: 1, studentId: 1 },
      { unique: true }
    );
    await Submission.collection.createIndex({ homeworkId: 1, status: 1 });
    await Submission.collection.createIndex({ schoolId: 1, studentId: 1, status: 1 });

    await Rubric.collection.createIndex({ schoolId: 1, teacherId: 1, createdAt: -1 });
    await Notice.collection.createIndex({ schoolId: 1, teacherId: 1, status: 1, createdAt: -1 });
    await MessageThread.collection.createIndex({ schoolId: 1, lastMessageAt: -1 });
    await MessageThread.collection.createIndex({ schoolId: 1, "participants.userId": 1 });
    await Message.collection.createIndex({ threadId: 1, createdAt: -1 });
    await Message.collection.createIndex({ schoolId: 1, senderId: 1, createdAt: -1 });
    await Escalation.collection.createIndex({ schoolId: 1, teacherId: 1, createdAt: -1 });
    await JournalEntry.collection.createIndex({ schoolId: 1, classGroupId: 1, date: -1 });
    await TeacherPermission.collection.createIndex(
      { schoolId: 1, name: 1 },
      { unique: true }
    );

    console.log("Teacher indexes created successfully");
  } catch (err) {
    console.error("Failed to create teacher indexes", err);
    process.exitCode = 1;
  } finally {
    await disconnectDatabase();
  }
}

main().catch((err) => {
  console.error("Unexpected error", err);
  process.exit(1);
});
