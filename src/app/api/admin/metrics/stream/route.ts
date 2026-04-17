/* eslint-disable @typescript-eslint/no-explicit-any */
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Student } from "@/models/Student";
import { UserMembership } from "@/models/UserMembership";
import { Subject } from "@/models/Subject";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { Guardian } from "@/models/Guardian";
import { Payment } from "@/models/Payment";
import { Invoice } from "@/models/Invoice";
import { StudentAttendance } from "@/models/StudentAttendance";
import mongoose from "mongoose";
import type { NextRequest } from "next/server";

export const runtime = "nodejs"; // ensure node runtime for stream

export async function GET(req: NextRequest) {
  const { schoolId } = await requireSchoolAdmin();
  await connectToDatabase();

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      let closed = false;
      let ping: ReturnType<typeof setInterval> | null = null;
      const closeables: Array<{ close: () => Promise<unknown> | unknown }> = [];

      const cleanup = (closeController = true) => {
        if (closed) return;
        closed = true;

        if (ping) {
          clearInterval(ping);
          ping = null;
        }

        for (const closeable of closeables) {
          Promise.resolve(closeable.close()).catch(() => undefined);
        }

        if (closeController) {
          try {
            controller.close();
          } catch {
            // Stream is already closed.
          }
        }
      };

      const enqueue = (chunk: string) => {
        if (closed) return false;
        try {
          controller.enqueue(enc.encode(chunk));
          return true;
        } catch (error) {
          if (
            error instanceof TypeError &&
            /already closed/i.test(error.message)
          ) {
            cleanup(false);
            return false;
          }
          cleanup(false);
          console.error("Failed to write admin metrics stream chunk:", error);
          return false;
        }
      };

      const send = (event: string, data: any) => {
        if (!enqueue(`event: ${event}\n`)) return;
        enqueue(`data: ${JSON.stringify(data)}\n\n`);
      };

      const runTask = (
        label: string,
        task: () => Promise<void>
      ) => {
        void task().catch((error) => {
          if (closed) return;
          console.error(`Admin metrics stream task failed: ${label}`, error);
        });
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
      const attendanceWatch = StudentAttendance.watch(pipeline, {
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

      const onChangeCounts = () => runTask("pushCounts", pushCounts);
      const onChangePeriod = () => runTask("pushPeriod", pushPeriod);

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
            .lean<{ schoolId?: mongoose.Types.ObjectId } | null>();

          if (student?.schoolId && String(student.schoolId) === String(schoolId)) {
            send("guardians.updated", {
              studentId: String(studentIdObj),
              operationType: change.operationType,
            });
          }
        } catch (err) {
          console.error("Error processing guardian change:", err);
        }
      });

      attendanceWatch.on("change", (change: any) => {
        const studentId = change?.fullDocument?.studentId
          ? String(change.fullDocument.studentId)
          : null;
        send("attendance.updated", {
          studentId,
          operationType: change?.operationType || "update",
        });
      });

      // Watch for payment changes
      const paymentWatch = Payment.watch(pipeline, {
        fullDocument: "updateLookup",
      });

      // Watch for invoice changes
      const invoiceWatch = Invoice.watch(pipeline, {
        fullDocument: "updateLookup",
      });
      closeables.push(
        studentWatch,
        teacherWatch,
        subjectWatch,
        periodWatch,
        guardianWatch,
        attendanceWatch,
        paymentWatch,
        invoiceWatch
      );

      const pushFeeSummary = async () => {
        if (!schoolId) {
          throw new Error("Missing schoolId for fee summary");
        }

        const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));
        const [totalRevenueResult, totalOutstandingResult, overdueCount] = await Promise.all([
          Payment.aggregate([
            {
              $match: {
                schoolId: schoolIdObj,
                status: "completed",
              },
            },
            {
              $group: {
                _id: null,
                total: { $sum: "$amountMinor" },
              },
            },
          ]),
          Invoice.aggregate([
            {
              $match: {
                schoolId: schoolIdObj,
                status: { $in: ["issued", "partially_paid", "overdue"] },
              },
            },
            {
              $group: {
                _id: null,
                total: { $sum: "$totalOutstandingMinor" },
              },
            },
          ]),
          Invoice.countDocuments({
            schoolId: schoolIdObj,
            status: "overdue",
          }),
        ]);

        const totalRevenueMinor = totalRevenueResult[0]?.total || 0;
        const totalOutstandingMinor = totalOutstandingResult[0]?.total || 0;

        if (closed) return;
        send("fees.updated", {
          totalRevenueMinor,
          totalOutstandingMinor,
          overdueCount,
        });
      };

      paymentWatch.on("change", (change: any) => {
        runTask("pushFeeSummary.payment", pushFeeSummary);
        const studentId = change?.fullDocument?.studentId
          ? String(change.fullDocument.studentId)
          : null;
        send("payments.updated", {
          studentId,
          operationType: change?.operationType || "update",
        });
      });

      invoiceWatch.on("change", (change: any) => {
        runTask("pushFeeSummary.invoice", pushFeeSummary);
        const studentId = change?.fullDocument?.studentId
          ? String(change.fullDocument.studentId)
          : null;
        send("invoices.updated", {
          studentId,
          operationType: change?.operationType || "update",
        });
      });

      // Initial fee summary push
      runTask("pushFeeSummary.initial", pushFeeSummary);

      // TODO: Add document watching when Document model is created
      // const documentWatch = Document.watch([...], { fullDocument: "updateLookup" });
      // documentWatch.on("change", async (change: any) => {
      //   // Filter by student's schoolId and send "documents.updated" event
      // });

      const abort = req.signal;
      if (abort.aborted) {
        cleanup();
        return;
      }
      abort.addEventListener("abort", () => cleanup(), { once: true });

      // Keep alive ping (30s)
      ping = setInterval(() => {
        enqueue(`:\n\n`);
      }, 30000);
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
