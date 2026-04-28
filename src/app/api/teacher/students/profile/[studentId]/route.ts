import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { Activity } from "@/models/Activity";
import { ClassGroup } from "@/models/ClassGroup";
import { Grade } from "@/models/Grade";
import { Guardian } from "@/models/Guardian";
import { Student } from "@/models/Student";
import { StudentAttendance } from "@/models/StudentAttendance";
import { Subject } from "@/models/Subject";
import { SubjectGrade } from "@/models/SubjectGrade";
import { TeacherAssignment } from "@/models/TeacherAssignment";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ studentId: string }> }
) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();

    const { studentId } = await ctx.params;
    const studentObjId = toObjectIdOrNull(studentId);

    if (!studentObjId) {
      return Response.json(
        { success: false, error: "Invalid student ID" },
        { status: 400 }
      );
    }

    const student = await Student.findOne({
      _id: studentObjId,
      schoolId: context.schoolId,
    })
      .select(
        "_id admissionNo firstName middleName lastName sex dateOfBirth photoUrl status enrolledAt gradeId classGroupId"
      )
      .lean();

    if (!student) {
      return Response.json(
        { success: false, error: "Student not found" },
        { status: 404 }
      );
    }

    const classGroupObjId = toObjectIdOrNull(String(student.classGroupId));
    if (!classGroupObjId) {
      return Response.json(
        { success: false, error: "Student class assignment is invalid" },
        { status: 400 }
      );
    }

    const isHomeroom = context.homeroomClassGroupId
      ? String(context.homeroomClassGroupId) === String(classGroupObjId)
      : false;

    if (!context.isAdmin && !isHomeroom) {
      const assignment = await TeacherAssignment.findOne({
        schoolId: context.schoolId,
        teacherId: context.teacherId,
        classGroupId: classGroupObjId,
        status: "active",
      })
        .select("_id")
        .lean();

      if (!assignment) {
        return Response.json(
          { success: false, error: "Forbidden" },
          { status: 403 }
        );
      }
    }

    const currentPeriod = await AcademicPeriod.findOne({
      schoolId: context.schoolId,
      isCurrent: true,
    })
      .select("_id yearLabel term")
      .lean();

    let teacherSubjectIds: mongoose.Types.ObjectId[] = [];
    if (!context.isAdmin) {
      const assignmentQuery: Record<string, unknown> = {
        schoolId: context.schoolId,
        teacherId: context.teacherId,
        classGroupId: classGroupObjId,
        status: "active",
      };
      if (currentPeriod?._id) {
        assignmentQuery.academicPeriodId = currentPeriod._id;
      }

      const subjectIdsRaw = await TeacherAssignment.find(assignmentQuery)
        .distinct("subjectId");

      teacherSubjectIds = subjectIdsRaw
        .map((id) => toObjectIdOrNull(String(id)))
        .filter((id): id is mongoose.Types.ObjectId => Boolean(id));
    }

    const [grade, classGroup, guardians, attendanceRecords, subjectGrades, recentActivitiesRaw] = await Promise.all([
      Grade.findById(student.gradeId).select("_id name code").lean(),
      ClassGroup.findById(student.classGroupId)
        .select("_id name fullLabel")
        .lean(),
      Guardian.find({ studentId: studentObjId })
        .populate("userId", "firstName lastName email avatarUrl")
        .sort({ isPrimary: -1, createdAt: 1 })
        .lean(),
      StudentAttendance.find({
        schoolId: context.schoolId,
        studentId: studentObjId,
      })
        .select("_id date type status periodNumber lateMinutes reason")
        .sort({ date: -1, updatedAt: -1 })
        .limit(40)
        .lean(),
      (() => {
        const query: Record<string, unknown> = {
          schoolId: context.schoolId,
          studentId: studentObjId,
        };

        if (currentPeriod?._id) {
          query.academicPeriodId = currentPeriod._id;
        }

        if (!context.isAdmin) {
          query.teacherId = context.teacherId;
          if (teacherSubjectIds.length > 0) {
            query.subjectId = { $in: teacherSubjectIds };
          } else {
            query.subjectId = { $in: [] };
          }
        }

        return SubjectGrade.find(query)
          .select("subjectId totalScore gradeLetter isPassed lastUpdated")
          .lean();
      })(),
      Activity.find({
        schoolId: context.schoolId,
        entityId: studentObjId,
        entityType: { $in: ["student", "Student"] },
      })
        .sort({ createdAt: -1 })
        .limit(20)
        .populate("userId", "firstName lastName email")
        .lean(),
    ]);

    const subjectIds = Array.from(
      new Set(subjectGrades.map((gradeRow) => String(gradeRow.subjectId)))
    )
      .map((id) => toObjectIdOrNull(id))
      .filter((id): id is mongoose.Types.ObjectId => Boolean(id));

    const subjects = subjectIds.length
      ? await Subject.find({
          schoolId: context.schoolId,
          _id: { $in: subjectIds },
        })
          .select("_id name")
          .lean()
      : [];

    const subjectNameById = new Map(
      subjects.map((subject) => [String(subject._id), subject.name])
    );

    const subjectPerformance = subjectGrades
      .map((row) => ({
        subjectId: String(row.subjectId),
        subjectName: subjectNameById.get(String(row.subjectId)) || "Subject",
        totalScore: Number((row.totalScore || 0).toFixed(1)),
        gradeLetter: row.gradeLetter || "",
        isPassed: Boolean(row.isPassed),
        lastUpdated: row.lastUpdated
          ? new Date(row.lastUpdated).toISOString()
          : null,
      }))
      .sort((a, b) => b.totalScore - a.totalScore);

    const overallAverage =
      subjectPerformance.length > 0
        ? Number(
            (
              subjectPerformance.reduce((sum, item) => sum + item.totalScore, 0) /
              subjectPerformance.length
            ).toFixed(1)
          )
        : null;

    const topSubject = subjectPerformance[0]?.subjectName || null;
    const lowestSubject =
      subjectPerformance.length > 0
        ? subjectPerformance[subjectPerformance.length - 1]?.subjectName || null
        : null;

    const recentActivity = recentActivitiesRaw.map((item) => {
      const user = item.userId as
        | {
            _id?: mongoose.Types.ObjectId | string;
            firstName?: string | null;
            lastName?: string | null;
            email?: string | null;
          }
        | string
        | null;

      const userDto =
        user && typeof user === "object"
          ? {
              id: user._id ? String(user._id) : "",
              firstName: user.firstName ?? null,
              lastName: user.lastName ?? null,
              email: user.email ?? null,
            }
          : null;

      return {
        id: String(item._id),
        type: String(item.type || "activity"),
        description: String(item.description || "Student activity"),
        createdAt: item.createdAt
          ? new Date(item.createdAt).toISOString()
          : new Date().toISOString(),
        metadata: (item.metadata ?? {}) as Record<string, unknown>,
        user: userDto,
      };
    });

    const summary = {
      total: attendanceRecords.length,
      present: 0,
      absent: 0,
      late: 0,
      excused: 0,
    };

    for (const record of attendanceRecords) {
      switch (record.status) {
        case "present":
          summary.present += 1;
          break;
        case "absent":
          summary.absent += 1;
          break;
        case "late":
          summary.late += 1;
          break;
        case "excused":
          summary.excused += 1;
          break;
      }
    }

    const attended = summary.present + summary.late + summary.excused;
    const attendanceRate =
      summary.total > 0
        ? Number(((attended / summary.total) * 100).toFixed(1))
        : null;

    const gradeName = grade?.name || null;
    const classGroupName = classGroup?.name || null;

    const fullName = [student.firstName, student.middleName, student.lastName]
      .filter(Boolean)
      .join(" ");

    const dto = {
      id: String(student._id),
      admissionNo: student.admissionNo || null,
      firstName: student.firstName,
      middleName: student.middleName || null,
      lastName: student.lastName,
      fullName,
      sex: student.sex || null,
      dateOfBirth: student.dateOfBirth
        ? new Date(student.dateOfBirth).toISOString()
        : null,
      photoUrl: student.photoUrl || null,
      status: student.status,
      enrolledAt: student.enrolledAt
        ? new Date(student.enrolledAt).toISOString()
        : null,
      grade: grade
        ? {
            id: String(grade._id),
            name: grade.name,
            code: grade.code || null,
          }
        : null,
      classGroup: classGroup
        ? {
            id: String(classGroup._id),
            name: classGroup.name,
            label:
              (classGroup as { fullLabel?: string }).fullLabel ||
              [gradeName, classGroupName].filter(Boolean).join(" "),
          }
        : null,
      guardians: guardians.map((guardian) => {
        const user = guardian.userId as
          | {
              firstName?: string;
              lastName?: string;
              email?: string;
              avatarUrl?: string;
            }
          | string
          | null;

        const userFirstName =
          user && typeof user === "object" ? user.firstName || "" : "";
        const userLastName =
          user && typeof user === "object" ? user.lastName || "" : "";
        const userEmail =
          user && typeof user === "object" ? user.email || null : null;
        const userAvatar =
          user && typeof user === "object" ? user.avatarUrl || null : null;

        const guardianName = [userFirstName, userLastName]
          .filter(Boolean)
          .join(" ")
          .trim();

        return {
          id: String(guardian._id),
          fullName: guardianName || guardian.email,
          relationship: guardian.relationship,
          phone: guardian.phone || null,
          email: guardian.email || userEmail,
          isPrimary: guardian.isPrimary,
          photoUrl: guardian.photoUrl || userAvatar,
        };
      }),
      attendanceSummary: {
        ...summary,
        attendanceRate,
      },
      academicSummary: {
        periodLabel: currentPeriod
          ? `${currentPeriod.yearLabel} ${currentPeriod.term}`
          : null,
        overallAverage,
        subjectsCount: subjectPerformance.length,
        passedCount: subjectPerformance.filter((item) => item.isPassed).length,
        topSubject,
        lowestSubject,
      },
      subjectPerformance,
      recentAttendance: attendanceRecords.map((record) => ({
        id: String(record._id),
        date: new Date(record.date).toISOString(),
        type: record.type,
        status: record.status,
        periodNumber: record.periodNumber ?? null,
        lateMinutes: record.lateMinutes ?? null,
        reason: record.reason ?? null,
      })),
      recentActivity,
    };

    return Response.json({ success: true, data: dto });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to fetch teacher student detail:", e);
    const message =
      e instanceof Error ? e.message : "Failed to fetch student detail";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

function toObjectIdOrNull(id: string) {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}
