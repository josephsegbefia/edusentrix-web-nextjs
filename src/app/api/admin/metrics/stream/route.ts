/* eslint-disable @typescript-eslint/no-explicit-any */
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Student } from "@/models/Student";
import { UserMembership } from "@/models/UserMembership";
import { Subject } from "@/models/Subject";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { Guardian } from "@/models/Guardian";
import type { NextRequest } from "next/server";

export const runtime = "nodejs"; // ensure node runtime for stream

export async function GET(req: NextRequest) {
  const { schoolId } = await requireSchoolAdmin();
  await connectToDatabase();

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (event: string, data: any) => {
        controller.enqueue(enc.encode(`event: ${event}\n`));
        controller.enqueue(enc.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      // Initial push (optional): client already has some data to display

      // watchers scoped to school
      const pipeline = [{ $match: { "fullDocument.schoolId": schoolId } }];

      const studentWatch = Student.watch(pipeline, {
        fullDocument: "updateLookup",
      });
      const teacherWatch = UserMembership.watch(pipeline, {
        fullDocument: "updateLookup",
      });
      const subjectWatch = Subject.watch(pipeline, {
        fullDocument: "updateLookup",
      });
      const periodWatch = AcademicPeriod.watch(pipeline, {
        fullDocument: "updateLookup",
      });

      // Watch for guardian changes
      // We'll filter by student's schoolId in the change handler
      const guardianWatch = Guardian.watch([], {
        fullDocument: "updateLookup",
      });

      const pushCounts = async () => {
        const [students, teachers, subjects] = await Promise.all([
          Student.countDocuments({ schoolId }),
          UserMembership.countDocuments({
            schoolId,
            roles: { $in: ["teacher"] },
          }),
          Subject.countDocuments({ schoolId }),
        ]);
        send("students.updated", { total: students });
        send("teachers.updated", { total: teachers });
        send("subjects.updated", { total: subjects });
      };

      const pushPeriod = async () => {
        const p = await AcademicPeriod.findOne({ schoolId, isCurrent: true })
          .select("yearLabel term startDate endDate isCurrent")
          .lean();
        send("period.updated", { period: p || null });
      };

      const onChangeCounts = () => void pushCounts();
      const onChangePeriod = () => void pushPeriod();

      studentWatch.on("change", onChangeCounts);
      teacherWatch.on("change", onChangeCounts);
      subjectWatch.on("change", onChangeCounts);
      periodWatch.on("change", onChangePeriod);

      // Handle guardian changes - filter by student's schoolId
      guardianWatch.on("change", async (change: any) => {
        try {
          const studentIdObj = change.fullDocument?.studentId || change.documentKey?.studentId;
          if (!studentIdObj) return;

          // Verify the student belongs to this school
          const student = await Student.findById(studentIdObj)
            .select("schoolId")
            .lean();

          if (student && String(student.schoolId) === String(schoolId)) {
            send("guardians.updated", {
              studentId: String(studentIdObj),
              operationType: change.operationType,
            });
          }
        } catch (err) {
          console.error("Error processing guardian change:", err);
        }
      });

      // TODO: Add document watching when Document model is created
      // const documentWatch = Document.watch([...], { fullDocument: "updateLookup" });
      // documentWatch.on("change", async (change: any) => {
      //   // Filter by student's schoolId and send "documents.updated" event
      // });

      const abort = req.signal;
      abort.addEventListener("abort", () => {
        studentWatch.close();
        teacherWatch.close();
        subjectWatch.close();
        periodWatch.close();
        guardianWatch.close();
        controller.close();
      });

      // Keep alive ping (30s)
      const ping = setInterval(
        () => controller.enqueue(enc.encode(`:\n\n`)),
        30000
      );
      abort.addEventListener("abort", () => clearInterval(ping));
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transfrom",
      Connection: "keep-alive",
    },
  });
}
