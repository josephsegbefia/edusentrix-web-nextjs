import "server-only";

import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { ClassGroup } from "@/models/ClassGroup";
import { FeeStructure } from "@/models/FeeStructure";
import { Grade } from "@/models/Grade";
import { Guardian } from "@/models/Guardian";
import { InternalTestDataGenerationJob } from "@/models/InternalTestDataGenerationJob";
import { Invoice } from "@/models/Invoice";
import { InvoiceLineItem } from "@/models/InvoiceLineItem";
import { Notice } from "@/models/Notice";
import { Student } from "@/models/Student";
import { Subject } from "@/models/Subject";
import { Teacher } from "@/models/Teacher";
import { TeacherAssignment } from "@/models/TeacherAssignment";
import { User } from "@/models/User";
import { UserMembership } from "@/models/UserMembership";
import { calculateInvoiceTotals, generateInvoiceNumber } from "@/lib/fees/invoice-utils";
import { toMinorUnits } from "@/lib/fees/money";
import { CORE_V1_STEP_DEFS } from "./core-v1-step-defs";
import type { GenerationCtx } from "./registry";
import { registerGenerated } from "./registry";
import {
  allDistinctSubjectNames,
  GRADE_NAMES,
  subjectNamesForTier,
  tierForGradeName,
} from "./subject-catalog";

function batchSlug(batchId: string) {
  return batchId.replace(/[^a-z0-9]/gi, "").slice(0, 12) || "batch";
}

function seedEmail(slug: string, tag: string, n: number) {
  return `edutest.${slug}.${tag}.${n}@seed.internal.edusentrix`.toLowerCase();
}

async function patchStep(
  jobId: mongoose.Types.ObjectId,
  key: string,
  patch: Record<string, unknown>
) {
  const doc = await InternalTestDataGenerationJob.findById(jobId);
  if (!doc) return;
  const i = doc.steps.findIndex((s) => s.key === key);
  if (i === -1) return;
  Object.assign(doc.steps[i], patch);
  await doc.save();
}

export async function executeCoreV1Job(jobId: mongoose.Types.ObjectId) {
  await connectToDatabase();

  const job = await InternalTestDataGenerationJob.findById(jobId);
  if (!job) throw new Error("Generation job not found");

  const ctx: GenerationCtx = {
    schoolId: job.schoolId,
    jobId: job._id as mongoose.Types.ObjectId,
    batchId: job.testDataBatchId,
  };
  const slug = batchSlug(job.testDataBatchId);

  const failJob = async (message: string, step?: string) => {
    await InternalTestDataGenerationJob.updateOne(
      { _id: jobId },
      {
        $set: { status: "failed", completedAt: new Date() },
        $push: { errors: { step: step ?? "unknown", message } },
      }
    );
  };

  await InternalTestDataGenerationJob.updateOne(
    { _id: jobId },
    { $set: { status: "running", startedAt: new Date() } }
  );

  let currentPeriodId: mongoose.Types.ObjectId | null = null;
  const gradeByName = new Map<string, mongoose.Types.ObjectId>();
  const classGroupByGrade = new Map<string, mongoose.Types.ObjectId>();
  const subjectByName = new Map<string, mongoose.Types.ObjectId>();
  const teachers: mongoose.Types.ObjectId[] = [];
  const students: mongoose.Types.ObjectId[] = [];
  const parentUsers: mongoose.Types.ObjectId[] = [];

  try {
    for (const def of CORE_V1_STEP_DEFS) {
      await patchStep(jobId, def.key, {
        status: "running",
        startedAt: new Date(),
      });

      try {
        if (def.key === "academic_periods") {
          let idx = 0;
          for (const p of job.academicPeriods) {
            const yearLabel = `${p.startDate.getFullYear()}-${String(idx + 1)}`;
            const ap = await AcademicPeriod.create({
              schoolId: job.schoolId,
              yearLabel,
              term: p.termLabel,
              startDate: p.startDate,
              endDate: p.endDate,
              isCurrent: p.isCurrent,
            });
            await registerGenerated(ctx, AcademicPeriod.modelName, ap._id as mongoose.Types.ObjectId, def.key);
            if (p.isCurrent) currentPeriodId = ap._id as mongoose.Types.ObjectId;
            idx++;
          }
          if (!currentPeriodId) throw new Error("No current academic period");
          await patchStep(jobId, def.key, {
            status: "completed",
            completedAt: new Date(),
            createdCount: job.academicPeriods.length,
          });
          continue;
        }

        if (def.key === "grades") {
          let order = 0;
          for (const name of GRADE_NAMES) {
            const g = await Grade.create({
              schoolId: job.schoolId,
              name,
              order,
              isActive: true,
              stage: tierForGradeName(name) === "jhs" ? "JHS" : "Basic",
            });
            order++;
            gradeByName.set(name, g._id as mongoose.Types.ObjectId);
            await registerGenerated(ctx, Grade.modelName, g._id as mongoose.Types.ObjectId, def.key);
          }
          await patchStep(jobId, def.key, {
            status: "completed",
            completedAt: new Date(),
            createdCount: GRADE_NAMES.length,
          });
          continue;
        }

        if (def.key === "class_groups") {
          for (const name of GRADE_NAMES) {
            const gradeId = gradeByName.get(name);
            if (!gradeId) throw new Error(`Missing grade ${name}`);
            const cg = await ClassGroup.create({
              schoolId: job.schoolId,
              gradeId,
              name: "A",
              subjectIds: [],
              isActive: true,
            });
            classGroupByGrade.set(name, cg._id as mongoose.Types.ObjectId);
            await registerGenerated(ctx, ClassGroup.modelName, cg._id as mongoose.Types.ObjectId, def.key);
          }
          await patchStep(jobId, def.key, {
            status: "completed",
            completedAt: new Date(),
            createdCount: GRADE_NAMES.length,
          });
          continue;
        }

        if (def.key === "subjects") {
          for (const subjName of allDistinctSubjectNames()) {
            const sub = await Subject.create({
              schoolId: job.schoolId,
              name: subjName,
              category: "core",
              isActive: true,
            });
            subjectByName.set(subjName, sub._id as mongoose.Types.ObjectId);
            await registerGenerated(ctx, Subject.modelName, sub._id as mongoose.Types.ObjectId, def.key);
          }
          for (const name of GRADE_NAMES) {
            const tier = tierForGradeName(name);
            const names = subjectNamesForTier(tier);
            const ids = names
              .map((n) => subjectByName.get(n))
              .filter((id): id is mongoose.Types.ObjectId => Boolean(id));
            const cgId = classGroupByGrade.get(name);
            if (cgId) {
              await ClassGroup.updateOne({ _id: cgId }, { $set: { subjectIds: ids } });
            }
          }
          await patchStep(jobId, def.key, {
            status: "completed",
            completedAt: new Date(),
            createdCount: subjectByName.size,
          });
          continue;
        }

        if (def.key === "staff_users") {
          const u = await User.create({
            email: seedEmail(slug, "staff", 1),
            firstName: "Seed",
            lastName: "Staff",
            role: "staff",
            schoolId: job.schoolId,
            isTestUser: true,
            testUserSource: "seeded_test_school",
            pendingOnboarding: false,
          });
          await registerGenerated(ctx, User.modelName, u._id as mongoose.Types.ObjectId, def.key);
          const m = await UserMembership.create({
            userId: u._id,
            schoolId: job.schoolId,
            roles: ["staff"],
            status: "active",
          });
          await registerGenerated(ctx, UserMembership.modelName, m._id as mongoose.Types.ObjectId, def.key);
          await patchStep(jobId, def.key, {
            status: "completed",
            completedAt: new Date(),
            createdCount: 1,
          });
          continue;
        }

        if (def.key === "teachers") {
          const nTeachers = Math.max(1, Math.min(job.counts.teachers, 20));
          const subjIds = Array.from(subjectByName.values()).slice(0, 40);
          for (let i = 0; i < nTeachers; i++) {
            const u = await User.create({
              email: seedEmail(slug, "teacher", i + 1),
              firstName: "Test",
              lastName: `Teacher ${i + 1}`,
              role: "teacher",
              schoolId: job.schoolId,
              isTestUser: true,
              testUserSource: "seeded_test_school",
              pendingOnboarding: false,
            });
            await registerGenerated(ctx, User.modelName, u._id as mongoose.Types.ObjectId, def.key);
            const mem = await UserMembership.create({
              userId: u._id,
              schoolId: job.schoolId,
              roles: ["teacher"],
              status: "active",
            });
            await registerGenerated(ctx, UserMembership.modelName, mem._id as mongoose.Types.ObjectId, def.key);
            const t = await Teacher.create({
              schoolId: job.schoolId,
              userId: u._id,
              subjectIds: subjIds.slice(i * 3, i * 3 + 8),
              status: "active",
            });
            teachers.push(t._id as mongoose.Types.ObjectId);
            await registerGenerated(ctx, Teacher.modelName, t._id as mongoose.Types.ObjectId, def.key);
          }
          await patchStep(jobId, def.key, {
            status: "completed",
            completedAt: new Date(),
            createdCount: nTeachers,
          });
          continue;
        }

        if (def.key === "teacher_assignments") {
          if (!currentPeriodId) throw new Error("Missing academic period");
          let assignCount = 0;
          const classIds = Array.from(classGroupByGrade.values());
          const firstSubjects = Array.from(subjectByName.values());
          for (let i = 0; i < teachers.length; i++) {
            const teacherId = teachers[i];
            const cgId = classIds[(i * 13 + 5) % classIds.length];
            const sid = firstSubjects[(i * 17 + 3) % Math.max(1, firstSubjects.length)];
            const ta = await TeacherAssignment.create({
              teacherId,
              schoolId: job.schoolId,
              academicPeriodId: currentPeriodId,
              subjectId: sid,
              classGroupId: cgId,
              status: "active",
              assignedAt: new Date(),
            });
            await registerGenerated(
              ctx,
              TeacherAssignment.modelName,
              ta._id as mongoose.Types.ObjectId,
              def.key
            );
            assignCount++;
          }
          await patchStep(jobId, def.key, {
            status: "completed",
            completedAt: new Date(),
            createdCount: assignCount,
          });
          continue;
        }

        if (def.key === "students") {
          const perClass = Math.max(1, Math.min(job.counts.studentsPerClassGroup, 30));
          let created = 0;
          for (const gradeName of GRADE_NAMES) {
            const gradeId = gradeByName.get(gradeName);
            const cgId = classGroupByGrade.get(gradeName);
            if (!gradeId || !cgId) continue;
            for (let i = 0; i < perClass; i++) {
              const st = await Student.create({
                schoolId: job.schoolId,
                firstName: "Student",
                lastName: `${gradeName.replace(/\s+/g, "")}-${i + 1}`,
                gradeId,
                classGroupId: cgId,
                status: "active",
              });
              students.push(st._id as mongoose.Types.ObjectId);
              await registerGenerated(ctx, Student.modelName, st._id as mongoose.Types.ObjectId, def.key);
              created++;
            }
          }
          await patchStep(jobId, def.key, {
            status: "completed",
            completedAt: new Date(),
            createdCount: created,
          });
          continue;
        }

        if (def.key === "parents") {
          const ratio = Math.max(1, Math.min(job.counts.parentsPerStudentRatio, 3));
          let n = 0;
          for (const stId of students) {
            for (let r = 0; r < ratio; r++) {
              n++;
              const u = await User.create({
                email: seedEmail(slug, `parent`, n),
                firstName: "Parent",
                lastName: `${n}`,
                role: "parent",
                schoolId: job.schoolId,
                isTestUser: true,
                testUserSource: "seeded_test_school",
                pendingOnboarding: false,
              });
              await registerGenerated(ctx, User.modelName, u._id as mongoose.Types.ObjectId, def.key);
              const mem = await UserMembership.create({
                userId: u._id,
                schoolId: job.schoolId,
                roles: ["parent"],
                status: "active",
              });
              await registerGenerated(ctx, UserMembership.modelName, mem._id as mongoose.Types.ObjectId, def.key);
              parentUsers.push(u._id as mongoose.Types.ObjectId);
            }
          }
          await patchStep(jobId, def.key, {
            status: "completed",
            completedAt: new Date(),
            createdCount: parentUsers.length,
          });
          continue;
        }

        if (def.key === "guardian_links") {
          let gi = 0;
          const ratio = Math.max(1, Math.min(job.counts.parentsPerStudentRatio, 3));
          for (const stId of students) {
            for (let r = 0; r < ratio; r++) {
              const uid = parentUsers[gi];
              gi++;
              if (!uid) break;
              const pUser = await User.findById(uid).select("email").lean<{ email?: string } | null>();
              const g = await Guardian.create({
                studentId: stId,
                userId: uid,
                relationship: r === 0 ? "father" : "mother",
                isPrimary: r === 0,
                email: (pUser?.email || seedEmail(slug, "guardian-email", gi)).toLowerCase(),
              });
              await registerGenerated(ctx, Guardian.modelName, g._id as mongoose.Types.ObjectId, def.key);
            }
          }
          await patchStep(jobId, def.key, {
            status: "completed",
            completedAt: new Date(),
            createdCount: gi,
          });
          continue;
        }

        if (def.key === "fee_structures") {
          const fs = await FeeStructure.create({
            schoolId: job.schoolId,
            name: "Tuition (seed)",
            code: `T-${slug.slice(0, 17).toUpperCase()}`.slice(0, 20),
            category: "tuition",
            isActive: true,
            defaultAmountMinor: toMinorUnits(500),
            allowsInstallments: false,
          });
          await registerGenerated(ctx, FeeStructure.modelName, fs._id as mongoose.Types.ObjectId, def.key);
          await patchStep(jobId, def.key, {
            status: "completed",
            completedAt: new Date(),
            createdCount: 1,
          });
          continue;
        }

        if (def.key === "invoices") {
          if (!currentPeriodId) throw new Error("Missing academic period");
          const fs = await FeeStructure.findOne({ schoolId: job.schoolId })
            .sort({ createdAt: -1 })
            .select("_id")
            .lean();
          const feeStructureId = fs?._id as mongoose.Types.ObjectId | undefined;
          let invCount = 0;
          const year = new Date().getFullYear();
          const baseCount = await Invoice.countDocuments({ schoolId: job.schoolId });
          let seq = baseCount + 1;
          for (const stId of students) {
            const existing = await Invoice.findOne({
              schoolId: job.schoolId,
              studentId: stId,
              academicPeriodId: currentPeriodId,
            }).select("_id");
            if (existing) continue;
            const invoiceNumber = generateInvoiceNumber(year, seq);
            seq++;
            const inv = await Invoice.create({
              schoolId: job.schoolId,
              studentId: stId,
              academicPeriodId: currentPeriodId,
              invoiceNumber,
              status: "issued",
              totalAmountMinor: 0,
              totalPaidMinor: 0,
              totalOutstandingMinor: 0,
              totalCreditAppliedMinor: 0,
              version: 1,
              dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
              issueDate: new Date(),
            });
            await registerGenerated(ctx, Invoice.modelName, inv._id as mongoose.Types.ObjectId, def.key);
            const amountMinor = toMinorUnits(120);
            const li = await InvoiceLineItem.create({
              invoiceId: inv._id,
              feeStructureId: feeStructureId ?? null,
              name: "Tuition",
              description: "Seeded invoice line",
              amountMinor,
              displayOrder: 1,
              allowsInstallments: false,
              amountPaidMinor: 0,
              amountOutstandingMinor: amountMinor,
              isFullyPaid: false,
              status: "pending",
              isAdjustment: false,
            });
            await registerGenerated(
              ctx,
              InvoiceLineItem.modelName,
              li._id as mongoose.Types.ObjectId,
              def.key
            );
            const totals = calculateInvoiceTotals([{ amountMinor, amountPaidMinor: 0 }]);
            inv.totalAmountMinor = totals.totalAmountMinor;
            inv.totalOutstandingMinor = totals.totalOutstandingMinor;
            await inv.save();
            invCount++;
          }
          await patchStep(jobId, def.key, {
            status: "completed",
            completedAt: new Date(),
            createdCount: invCount,
          });
          continue;
        }

        if (def.key === "sample_payments") {
          await patchStep(jobId, def.key, {
            status: "skipped",
            completedAt: new Date(),
            skipReason: "Record sample payments via Finance after seed if needed.",
          });
          continue;
        }

        if (def.key === "notices") {
          let noticeCount = 0;
          if (teachers[0]) {
            const notice = await Notice.create({
              schoolId: job.schoolId,
              teacherId: teachers[0],
              title: "Welcome (seed)",
              message: "This is a seeded notice for internal testing.",
              audience: "school",
              status: "published",
              publishedAt: new Date(),
            });
            await registerGenerated(ctx, Notice.modelName, notice._id as mongoose.Types.ObjectId, def.key);
            noticeCount = 1;
          }
          await patchStep(jobId, def.key, {
            status: "completed",
            completedAt: new Date(),
            createdCount: noticeCount,
          });
          continue;
        }

        if (def.key === "library_placeholder") {
          await patchStep(jobId, def.key, {
            status: "skipped",
            completedAt: new Date(),
            skipReason:
              "Lessons, flashcards, and library loans are handled in extended generators (Phase 6 / follow-up).",
          });
          continue;
        }

        await patchStep(jobId, def.key, {
          status: "skipped",
          completedAt: new Date(),
          skipReason: "Unknown step key",
        });
      } catch (stepErr) {
        const msg = stepErr instanceof Error ? stepErr.message : String(stepErr);
        await patchStep(jobId, def.key, {
          status: "failed",
          completedAt: new Date(),
          error: msg,
        });
        await failJob(msg, def.key);
        return;
      }
    }

    if (job.scope === "extended_v2") {
      const { executeExtendedV2Steps } = await import("./run-extended-v2-steps");
      await executeExtendedV2Steps(jobId);
    }

    const createdCounts: Record<string, number> = {};
    const finished = await InternalTestDataGenerationJob.findById(jobId).lean();
    if (finished?.steps) {
      for (const s of finished.steps) {
        if (s.status === "completed" && typeof s.createdCount === "number") {
          createdCounts[s.key] = s.createdCount;
        }
      }
    }

    await InternalTestDataGenerationJob.updateOne(
      { _id: jobId },
      {
        $set: {
          status: "completed",
          completedAt: new Date(),
          createdCounts,
        },
      }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await failJob(msg);
  }
}
