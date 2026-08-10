#!/usr/bin/env node
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-require-imports */

const crypto = require("node:crypto");
const mongoose = require("mongoose");

const MARKER = "demo-trial-v1";
const EXPECTED_DEMO_DB = process.env.DEMO_MONGO_DB_NAME || process.env.MONGO_DB_NAME;

function oid(input) {
  return new mongoose.Types.ObjectId(
    crypto.createHash("md5").update(`${MARKER}:${input}`).digest("hex").slice(0, 24)
  );
}

function dayOffset(days, hour = 9, minute = 0) {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  d.setDate(d.getDate() + days);
  return d;
}

function gradeFor(score) {
  if (score >= 80) return ["A", 4, "Excellent"];
  if (score >= 70) return ["B", 3, "Very good"];
  if (score >= 60) return ["C", 2.5, "Good"];
  if (score >= 50) return ["D", 2, "Satisfactory"];
  return ["E", 1, "Needs support"];
}

async function bulk(collection, ops) {
  if (!ops.length) return { matched: 0, modified: 0, upserted: 0 };
  const result = await collection.bulkWrite(ops, { ordered: false });
  return {
    matched: result.matchedCount || 0,
    modified: result.modifiedCount || 0,
    upserted: result.upsertedCount || 0,
  };
}

function add(stats, key, result) {
  stats[key] ||= { matched: 0, modified: 0, upserted: 0 };
  stats[key].matched += result.matched || 0;
  stats[key].modified += result.modified || 0;
  stats[key].upserted += result.upserted || 0;
}

async function seedSchool(db, schoolId, index) {
  const stats = {};
  const now = new Date();
  const school = await db.collection("schools").findOne({ _id: schoolId });
  const [students, parents, teachers, classGroups, grades, subjects, admin] = await Promise.all([
    db.collection("students").find({ schoolId }).sort({ admissionNo: 1, createdAt: 1 }).limit(30).toArray(),
    db.collection("users").find({ schoolId, role: "parent" }).sort({ email: 1 }).limit(30).toArray(),
    db.collection("teachers").find({ schoolId }).sort({ employeeId: 1, createdAt: 1 }).limit(12).toArray(),
    db.collection("classgroups").find({ schoolId }).sort({ name: 1 }).toArray(),
    db.collection("grades").find({ schoolId }).sort({ order: 1, name: 1 }).toArray(),
    db.collection("subjects").find({ schoolId }).sort({ name: 1 }).limit(8).toArray(),
    db.collection("users").findOne({ schoolId, role: "school_admin" }),
  ]);

  if (!school || !students.length || !classGroups.length || !teachers.length || !subjects.length) {
    return { skipped: true, reason: "missing core school data", schoolId: String(schoolId) };
  }

  const actorUserId = admin?._id || teachers[0].userId || parents[0]?._id || null;
  const period =
    (await db.collection("academicperiods").findOne({ schoolId, isCurrent: true })) ||
    (await db.collection("academicperiods").findOne({ schoolId }));
  const academicPeriodId = period?._id || oid(`${schoolId}:period`);

  if (!period) {
    add(
      stats,
      "academicperiods",
      await bulk(db.collection("academicperiods"), [
        {
          updateOne: {
            filter: { _id: academicPeriodId },
            update: {
              $setOnInsert: {
                _id: academicPeriodId,
                schoolId,
                yearLabel: "2025/2026",
                term: "Term 1",
                startDate: new Date("2025-09-01"),
                endDate: new Date("2025-12-20"),
                isCurrent: true,
                createdAt: now,
              },
              $set: { updatedAt: now },
            },
            upsert: true,
          },
        },
      ])
    );
  }

  const gradingPolicyId = oid(`${schoolId}:grading-policy`);
  add(
    stats,
    "academicgradingpolicies",
    await bulk(db.collection("academicgradingpolicies"), [
      {
        updateOne: {
          filter: { _id: gradingPolicyId },
          update: {
            $setOnInsert: {
              _id: gradingPolicyId,
              schoolId,
              name: "Demo Trial Basic Grading Policy",
              gradeLabelMode: "letters",
              appliesToGradeIds: grades.map((g) => g._id),
              appliesToGradeBandCodes: [],
              isDefault: true,
              status: "active",
              passMark: 50,
              roundingRule: "nearest_integer",
              showClassPosition: true,
              showSubjectPosition: true,
              showGradeKey: true,
              allowTeacherContributionSelection: true,
              requireAdminApprovalForPolicyChanges: false,
              scoreComponents: [
                { key: "classwork", label: "Classwork", weight: 40, order: 1, required: true },
                { key: "exam", label: "Exam", weight: 60, order: 2, required: true },
              ],
              gradeBoundaries: [
                { minPercentage: 80, maxPercentage: 100, gradeLabel: "A", gradePoint: 4, descriptor: "Excellent", isPassing: true },
                { minPercentage: 70, maxPercentage: 79, gradeLabel: "B", gradePoint: 3, descriptor: "Very good", isPassing: true },
                { minPercentage: 60, maxPercentage: 69, gradeLabel: "C", gradePoint: 2.5, descriptor: "Good", isPassing: true },
                { minPercentage: 50, maxPercentage: 59, gradeLabel: "D", gradePoint: 2, descriptor: "Satisfactory", isPassing: true },
                { minPercentage: 0, maxPercentage: 49, gradeLabel: "E", gradePoint: 1, descriptor: "Needs support", isPassing: false },
              ],
              createdBy: actorUserId,
              createdAt: now,
            },
            $set: { updatedAt: now },
          },
          upsert: true,
        },
      },
    ])
  );

  const planByGrade = new Map();
  const assessmentOps = grades.map((grade) => {
    const id = oid(`${schoolId}:assessment-plan:${grade._id}`);
    planByGrade.set(String(grade._id), id);
    return {
      updateOne: {
        filter: { _id: id },
        update: {
          $setOnInsert: {
            _id: id,
            schoolId,
            name: `Demo Assessment Plan - ${grade.name || "Grade"}`,
            academicPeriodId,
            gradingPolicyId,
            appliesToGradeId: grade._id,
            appliesToGradeIds: [grade._id],
            appliesToClassGroupIds: classGroups.filter((cg) => String(cg.gradeId) === String(grade._id)).map((cg) => cg._id),
            status: "active",
            componentRules: [
              { componentKey: "classwork", contributionMode: "average_all", minItems: 1 },
              { componentKey: "exam", contributionMode: "average_all", minItems: 1 },
            ],
            teacherCanCreateReportItems: true,
            teacherCanMarkItemsAsReportContributing: true,
            allowOfflineMarks: true,
            allowAppAssignmentImport: true,
            allowCsvImport: false,
            minimumCompletionRules: [],
            createdBy: actorUserId,
            approvedBy: actorUserId,
            approvedAt: now,
            createdAt: now,
          },
          $set: { updatedAt: now },
        },
        upsert: true,
      },
    };
  });
  add(stats, "assessmentplans", await bulk(db.collection("assessmentplans"), assessmentOps));

  const guardianOps = [];
  for (let i = 0; i < Math.min(parents.length, students.length); i += 1) {
    const parent = parents[i];
    const student = students[i];
    guardianOps.push({
      updateOne: {
        filter: { userId: parent._id, studentId: student._id },
        update: {
          $setOnInsert: {
            _id: oid(`${schoolId}:guardian:${parent._id}:${student._id}`),
            userId: parent._id,
            studentId: student._id,
            relationship: i % 2 === 0 ? "mother" : "father",
            createdAt: now,
          },
          $set: {
            isPrimary: true,
            email: parent.email,
            phone: parent.phone || `+23324${String(1000000 + i + index * 1000).slice(-7)}`,
            occupation: ["Accountant", "Trader", "Nurse", "Engineer", "Public servant"][i % 5],
            updatedAt: now,
          },
        },
        upsert: true,
      },
    });
  }
  add(stats, "guardians", await bulk(db.collection("guardians"), guardianOps));

  const feeDefs = [
    ["TUITION", "Tuition Fee", "tuition", 420000],
    ["ICT", "ICT and e-Learning Fee", "other", 65000],
    ["LIBRARY", "Library Fee", "library", 45000],
    ["SPORTS", "Sports and Clubs Fee", "sports", 35000],
  ];
  const feeIds = new Map();
  add(
    stats,
    "feestructures",
    await bulk(
      db.collection("feestructures"),
      feeDefs.map(([code, name, category, amount]) => {
        const id = oid(`${schoolId}:fee:${code}`);
        feeIds.set(code, id);
        return {
          updateOne: {
            filter: { schoolId, code },
            update: {
              $setOnInsert: { _id: id, schoolId, code, createdAt: now },
              $set: {
                name,
                category,
                description: `${name} seeded for demo trials only.`,
                isActive: true,
                defaultAmountMinor: amount,
                allowsInstallments: code === "TUITION",
                maxInstallments: code === "TUITION" ? 3 : null,
                updatedAt: now,
              },
            },
            upsert: true,
          },
        };
      })
    )
  );

  const invoiceOps = [];
  const lineOps = [];
  const paymentOps = [];
  const allocationOps = [];
  const subjectResultOps = [];
  const termResultOps = [];
  const reportCardOps = [];
  const reportRunOps = [];
  const runIdsByClass = new Map();

  for (const cg of classGroups) {
    const runId = oid(`${schoolId}:report-run:${academicPeriodId}:${cg._id}`);
    runIdsByClass.set(String(cg._id), runId);
    reportRunOps.push({
      updateOne: {
        filter: { _id: runId },
        update: {
          $setOnInsert: {
            _id: runId,
            schoolId,
            academicPeriodId,
            classGroupId: cg._id,
            gradeId: cg.gradeId,
            homeroomTeacherId: cg.homeroomTeacherId || teachers[0]._id,
            gradingPolicyId,
            assessmentPlanId: planByGrade.get(String(cg.gradeId)) || [...planByGrade.values()][0],
            status: "released",
            openedBy: actorUserId,
            openedAt: dayOffset(-21),
            compiledBy: actorUserId,
            compiledAt: dayOffset(-14),
            submittedBy: actorUserId,
            submittedAt: dayOffset(-10),
            approvedBy: actorUserId,
            approvedAt: dayOffset(-7),
            releasedBy: actorUserId,
            releasedAt: dayOffset(-5),
            releaseVisibility: { parents: true, students: true, marker: MARKER },
            readinessSnapshot: {
              subjectsExpected: 4,
              subjectsSubmitted: 4,
              subjectsApproved: 4,
              studentsExpected: 30,
              studentsComplete: 30,
              missingSubjectResults: [],
              missingExamScores: [],
              missingRequiredComponents: [],
              attendanceReady: true,
              commentsReady: true,
              headteacherCommentReady: true,
            },
            issueSummary: [],
            createdAt: now,
          },
          $set: { updatedAt: now },
        },
        upsert: true,
      },
    });
  }

  for (let i = 0; i < students.length; i += 1) {
    const student = students[i];
    const invoiceId = oid(`${schoolId}:invoice:${academicPeriodId}:${student._id}`);
    const scenario = i % 4;
    const total = feeDefs.reduce((sum, fee) => sum + Number(fee[3]), 0);
    const paid = scenario === 0 ? total : scenario === 1 ? 280000 : scenario === 2 ? 120000 : 0;
    const status = paid >= total ? "paid" : paid > 0 ? "partially_paid" : scenario === 3 ? "overdue" : "issued";
    invoiceOps.push({
      updateOne: {
        filter: { _id: invoiceId },
        update: {
          $setOnInsert: {
            _id: invoiceId,
            schoolId,
            studentId: student._id,
            academicPeriodId,
            invoiceNumber: `DEMO-${String(schoolId).slice(-4)}-${String(student._id).slice(-6)}`,
            version: 1,
            totalCreditAppliedMinor: 0,
            createdAt: now,
          },
          $set: {
            status,
            totalAmountMinor: total,
            totalPaidMinor: paid,
            totalOutstandingMinor: total - paid,
            issueDate: dayOffset(-30),
            dueDate: dayOffset(scenario === 3 ? -3 : 21),
            paidDate: paid >= total ? dayOffset(-8) : null,
            terms: "Demo invoice for trial exploration only.",
            notes: MARKER,
            updatedAt: now,
          },
        },
        upsert: true,
      },
    });

    let paidRemaining = paid;
    feeDefs.forEach(([code, name, , amount], order) => {
      const amountMinor = Number(amount);
      const paidForLine = Math.min(paidRemaining, amountMinor);
      paidRemaining -= paidForLine;
      const lineId = oid(`${invoiceId}:line:${code}`);
      lineOps.push({
        updateOne: {
          filter: { _id: lineId },
          update: {
            $setOnInsert: { _id: lineId, invoiceId, feeStructureId: feeIds.get(code), createdAt: now },
            $set: {
              name,
              description: `${name} for Term 1 demo invoice.`,
              amountMinor,
              displayOrder: order + 1,
              allowsInstallments: code === "TUITION",
              numberOfInstallments: code === "TUITION" ? 3 : null,
              amountPaidMinor: paidForLine,
              amountOutstandingMinor: amountMinor - paidForLine,
              isFullyPaid: paidForLine >= amountMinor,
              status: paidForLine >= amountMinor ? "paid" : paidForLine > 0 ? "partially_paid" : status === "overdue" ? "overdue" : "pending",
              isAdjustment: false,
              updatedAt: now,
            },
          },
          upsert: true,
        },
      });
      if (paidForLine > 0) {
        const paymentId = oid(`${invoiceId}:payment`);
        allocationOps.push({
          updateOne: {
            filter: { _id: oid(`${paymentId}:alloc:${lineId}`) },
            update: {
              $setOnInsert: { _id: oid(`${paymentId}:alloc:${lineId}`), paymentId, invoiceLineItemId: lineId, createdAt: now },
              $set: { amountMinor: paidForLine, installmentScheduleId: null, installmentNumber: null, notes: MARKER },
            },
            upsert: true,
          },
        });
      }
    });
    if (paid > 0) {
      const paymentId = oid(`${invoiceId}:payment`);
      paymentOps.push({
        updateOne: {
          filter: { _id: paymentId },
          update: {
            $setOnInsert: {
              _id: paymentId,
              schoolId,
              studentId: student._id,
              invoiceId,
              idempotencyKey: `${MARKER}:${invoiceId}`,
              internalReference: `RCP-${String(schoolId).slice(-4)}-${String(i + 1).padStart(4, "0")}`,
              receiptNumber: `DEMO-RCT-${String(student._id).slice(-6)}`,
              createdAt: now,
            },
            $set: {
              amountMinor: paid,
              platformFeeMinor: 0,
              processorFeeMinor: Math.round(paid * 0.015),
              netSchoolAmountMinor: paid - Math.round(paid * 0.015),
              paymentDate: dayOffset(-8 - (i % 9)),
              paymentMethod: i % 3 === 0 ? "mobile_money" : i % 3 === 1 ? "bank_transfer" : "cash",
              reconciliationStatus: i % 3 === 0 ? "gateway_verified" : "fully_reconciled",
              gatewayVerifiedAt: i % 3 === 0 ? dayOffset(-7) : null,
              bankMatchedAt: i % 3 === 0 ? null : dayOffset(-6),
              receivedBy: actorUserId,
              externalReference: `DEMO-PAY-${String(student._id).slice(-6)}`,
              notes: "Fake payment for demo trials only.",
              attachments: [],
              status: "completed",
              approvalStatus: "not_required",
              reviewedBy: actorUserId,
              reviewedAt: dayOffset(-6),
              updatedAt: now,
            },
          },
          upsert: true,
        },
      });
    }

    const classSubjectIds =
      classGroups.find((cg) => String(cg._id) === String(student.classGroupId))?.subjectIds || [];
    const studentSubjects = (classSubjectIds.length ? classSubjectIds : subjects.map((s) => s._id)).slice(0, 4);
    let totalScore = 0;
    const subjectSnapshots = [];
    studentSubjects.forEach((subjectId, subjectIndex) => {
      const subject = subjects.find((s) => String(s._id) === String(subjectId)) || subjects[subjectIndex % subjects.length];
      const teacher = teachers[(i + subjectIndex) % teachers.length];
      const score = Math.max(45, Math.min(96, 62 + ((i * 7 + subjectIndex * 9 + index) % 31)));
      totalScore += score;
      const [label, point, descriptor] = gradeFor(score);
      const resultId = oid(`${schoolId}:subject-result:${academicPeriodId}:${student._id}:${subject._id}`);
      const components = [
        { componentKey: "classwork", label: "Classwork", weight: 40, rawScore: Math.round(score * 0.4), rawMaxScore: 40, rawPercentage: score, weightedScore: Math.round(score * 0.4), includedAssessmentItemIds: [], excludedAssessmentItemIds: [], calculationMode: "average_all" },
        { componentKey: "exam", label: "Exam", weight: 60, rawScore: Math.round(score * 0.6), rawMaxScore: 60, rawPercentage: score, weightedScore: Math.round(score * 0.6), includedAssessmentItemIds: [], excludedAssessmentItemIds: [], calculationMode: "average_all" },
      ];
      subjectResultOps.push({
        updateOne: {
          filter: { _id: resultId },
          update: {
            $setOnInsert: { _id: resultId, schoolId, academicPeriodId, classGroupId: student.classGroupId, gradeId: student.gradeId, subjectId: subject._id, studentId: student._id, createdAt: now },
            $set: {
              assessmentPlanId: planByGrade.get(String(student.gradeId)) || [...planByGrade.values()][0],
              gradingPolicyId,
              teacherId: teacher._id,
              components,
              finalScore: score,
              roundedFinalScore: score,
              gradeLabel: label,
              gradePoint: point,
              descriptor,
              isPassed: score >= 50,
              subjectPosition: (i % 10) + 1,
              totalStudentsForSubject: 30,
              subjectRemark: `${descriptor}. ${student.firstName || "Student"} is making steady progress in ${subject.name}.`,
              missingRequiredItems: [],
              sourceAssessmentItemIds: [],
              calculationSnapshot: { marker: MARKER },
              status: "approved",
              submittedBy: teacher.userId || actorUserId,
              submittedAt: dayOffset(-12),
              approvedBy: actorUserId,
              approvedAt: dayOffset(-7),
              lockedAt: dayOffset(-6),
              updatedAt: now,
            },
          },
          upsert: true,
        },
      });
      subjectSnapshots.push({
        subjectId: String(subject._id),
        subjectName: subject.name,
        teacherName: [teacher.firstName, teacher.lastName].filter(Boolean).join(" "),
        finalScore: score,
        gradeLabel: label,
        descriptor,
        remark: `${descriptor}. Keep practicing weekly review questions.`,
      });
    });
    const average = Math.round(totalScore / Math.max(1, studentSubjects.length));
    termResultOps.push({
      updateOne: {
        filter: { studentId: student._id, academicPeriodId },
        update: {
          $setOnInsert: { _id: oid(`${schoolId}:term-result:${academicPeriodId}:${student._id}`), schoolId, academicPeriodId, studentId: student._id, createdAt: now },
          $set: {
            classGroupId: student.classGroupId,
            totalSubjects: studentSubjects.length,
            totalScore,
            averageScore: average,
            classPosition: (i % 12) + 1,
            totalStudents: 30,
            performanceTier: average >= 80 ? "top" : average >= 70 ? "above_average" : average >= 55 ? "average" : "at_risk",
            gpa: Number((average / 25).toFixed(2)),
            isPromoted: average >= 50,
            calculatedAt: now,
            updatedAt: now,
          },
        },
        upsert: true,
      },
    });
    reportCardOps.push({
      updateOne: {
        filter: { reportCardRunId: runIdsByClass.get(String(student.classGroupId)), studentId: student._id },
        update: {
          $setOnInsert: {
            _id: oid(`${schoolId}:report-card:${academicPeriodId}:${student._id}`),
            reportCardRunId: runIdsByClass.get(String(student.classGroupId)),
            studentId: student._id,
            schoolId,
            academicPeriodId,
            createdAt: now,
          },
          $set: {
            classGroupId: student.classGroupId,
            gradeId: student.gradeId,
            gradingPolicySnapshot: { name: "Demo Trial Basic Grading Policy", marker: MARKER },
            assessmentPlanSnapshot: { name: "Demo Assessment Plan", marker: MARKER },
            reportTemplateSnapshot: { name: "Demo Report Card", marker: MARKER },
            studentSnapshot: { name: [student.firstName, student.lastName].filter(Boolean).join(" "), admissionNo: student.admissionNo || null },
            schoolSnapshot: { name: school.name },
            attendanceSnapshot: { present: 54, absent: i % 3, late: i % 4, total: 60 },
            subjectResultsSnapshot: subjectSnapshots,
            termSummarySnapshot: { averageScore: average, totalScore, classPosition: (i % 12) + 1, totalStudents: 30, performanceTier: average >= 80 ? "top" : average >= 70 ? "above_average" : average >= 55 ? "average" : "at_risk" },
            commentsSnapshot: { classTeacher: "A focused learner with strong classroom participation.", headteacher: "Promoted to continue building confidence and consistency." },
            conductSnapshot: { conduct: "Very good", attitude: "Positive" },
            promotionSnapshot: { promoted: average >= 50, decision: average >= 50 ? "Promoted" : "Review required" },
            pdfUrl: null,
            status: "released",
            compiledAt: dayOffset(-14),
            approvedAt: dayOffset(-7),
            releasedAt: dayOffset(-5),
            updatedAt: now,
          },
        },
        upsert: true,
      },
    });
  }

  add(stats, "reportcardruns", await bulk(db.collection("reportcardruns"), reportRunOps));
  add(stats, "invoices", await bulk(db.collection("invoices"), invoiceOps));
  add(stats, "invoicelineitems", await bulk(db.collection("invoicelineitems"), lineOps));
  add(stats, "payments", await bulk(db.collection("payments"), paymentOps));
  add(stats, "paymentallocations", await bulk(db.collection("paymentallocations"), allocationOps));
  add(stats, "subjectresults", await bulk(db.collection("subjectresults"), subjectResultOps));
  add(stats, "termresults", await bulk(db.collection("termresults"), termResultOps));
  add(stats, "studentreportcards", await bulk(db.collection("studentreportcards"), reportCardOps));

  const attendanceOps = [];
  const activityOps = [];
  const weekdays = [-4, -3, -2, -1, 0];
  teachers.forEach((teacher, teacherIndex) => {
    weekdays.forEach((offset, dayIndex) => {
      const date = dayOffset(offset, 0, 0);
      const status = dayIndex === 3 && teacherIndex % 5 === 0 ? "late" : dayIndex === 2 && teacherIndex % 7 === 0 ? "on_leave" : "present";
      attendanceOps.push({
        updateOne: {
          filter: { teacherId: teacher._id, date },
          update: {
            $setOnInsert: { _id: oid(`${schoolId}:teacher-attendance:${teacher._id}:${date.toISOString().slice(0, 10)}`), teacherId: teacher._id, schoolId, date, createdAt: now },
            $set: {
              status,
              checkInTime: status === "on_leave" ? null : dayOffset(offset, status === "late" ? 8 : 7, status === "late" ? 22 : 42),
              checkOutTime: status === "on_leave" ? null : dayOffset(offset, 15, 30),
              minutesLate: status === "late" ? 22 : 0,
              leaveType: status === "on_leave" ? "professional" : null,
              reason: status === "on_leave" ? "Professional development workshop" : null,
              notes: "Seeded for demo trials only.",
              recordedBy: actorUserId,
              updatedAt: now,
            },
          },
          upsert: true,
        },
      });
    });
    [
      ["attendance.marked", "Attendance marked", "Daily staff attendance was recorded."],
      ["assignment.created", "Class assignment updated", "Teacher assignment was reviewed for the demo timetable."],
      ["note.added", "Planning note added", "Weekly teaching note prepared for class delivery."],
    ].forEach(([type, title, description], activityIndex) => {
      activityOps.push({
        updateOne: {
          filter: { _id: oid(`${schoolId}:teacher-activity:${teacher._id}:${type}`) },
          update: {
            $setOnInsert: { _id: oid(`${schoolId}:teacher-activity:${teacher._id}:${type}`), teacherId: teacher._id, schoolId, type, createdAt: dayOffset(-activityIndex - 1) },
            $set: { title, description, metadata: { marker: MARKER }, createdBy: actorUserId, updatedAt: now },
          },
          upsert: true,
        },
      });
    });
  });
  add(stats, "teacherattendances", await bulk(db.collection("teacherattendances"), attendanceOps));
  add(stats, "teacheractivities", await bulk(db.collection("teacheractivities"), activityOps));

  const noticeTeacher = teachers[0];
  const noticeOps = [
    ["fees", "Term 1 fee reminders", "Parents can review invoices and fake payment history in this demo account."],
    ["academics", "Released demo report cards", "End-of-term report cards have been released for parent and student demo review."],
  ].map(([key, title, message]) => ({
    updateOne: {
      filter: { _id: oid(`${schoolId}:notice:${key}`) },
      update: {
        $setOnInsert: { _id: oid(`${schoolId}:notice:${key}`), schoolId, teacherId: noticeTeacher._id, createdAt: now },
        $set: {
          title,
          message,
          audience: "school",
          classGroupIds: [],
          subjectIds: [],
          targetStudentIds: [],
          attachments: [],
          status: "published",
          publishedAt: dayOffset(-2),
          updatedAt: now,
        },
      },
      upsert: true,
    },
  }));
  add(stats, "notices", await bulk(db.collection("notices"), noticeOps));

  return { skipped: false, schoolId: String(schoolId), schoolName: school.name, stats };
}

async function main() {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required");
  if (!EXPECTED_DEMO_DB) throw new Error("DEMO_MONGO_DB_NAME or MONGO_DB_NAME is required");
  if (EXPECTED_DEMO_DB !== "test" && process.env.ALLOW_NON_TEST_DEMO_DB !== "true") {
    throw new Error(`Refusing to seed database "${EXPECTED_DEMO_DB}". Set ALLOW_NON_TEST_DEMO_DB=true only if this is a demo DB.`);
  }

  await mongoose.connect(process.env.MONGODB_URI, {
    dbName: EXPECTED_DEMO_DB,
    serverSelectionTimeoutMS: 10000,
  });
  const db = mongoose.connection.db;
  console.log(`[demo-seed] connected db=${db.databaseName}`);

  const sandboxSchoolIds = await db.collection("demosandboxes").distinct("schoolId", {
    schoolId: { $exists: true, $ne: null },
  });
  const limit = Number(process.env.DEMO_SEED_SCHOOL_LIMIT || 0);
  const targetSchoolIds = limit > 0 ? sandboxSchoolIds.slice(0, limit) : sandboxSchoolIds;
  console.log(`[demo-seed] target sandbox schools=${targetSchoolIds.length}`);

  const results = [];
  for (let i = 0; i < targetSchoolIds.length; i += 1) {
    const result = await seedSchool(db, targetSchoolIds[i], i);
    results.push(result);
    console.log(
      `[demo-seed] ${i + 1}/${targetSchoolIds.length} ${result.schoolName || result.schoolId} ${result.skipped ? `skipped: ${result.reason}` : "seeded"}`
    );
  }

  const totals = {};
  for (const result of results) {
    if (result.skipped) continue;
    for (const [key, value] of Object.entries(result.stats)) add(totals, key, value);
  }

  console.log(JSON.stringify({ db: db.databaseName, schools: results.length, totals }, null, 2));
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(`[demo-seed] failed: ${error instanceof Error ? error.message : String(error)}`);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
