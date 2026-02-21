import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { Grade } from "@/models/Grade";
import { Student } from "@/models/Student";
import { TeacherAssignment } from "@/models/TeacherAssignment";

type PopulatedClassGroup = {
  _id: mongoose.Types.ObjectId;
  name: string;
  gradeId?: mongoose.Types.ObjectId | null;
  homeroomTeacherId?: mongoose.Types.ObjectId | null;
};

type PopulatedSubject = {
  _id: mongoose.Types.ObjectId;
  name: string;
};

type ScheduleSlot = {
  dayOfWeek?: number | null;
  startTime?: string | null;
  endTime?: string | null;
};

type TeacherClassAssignmentLean = {
  classGroupId?: PopulatedClassGroup | mongoose.Types.ObjectId | null;
  subjectId?: PopulatedSubject | mongoose.Types.ObjectId | null;
  schedules?: ScheduleSlot[];
  schedule?: ScheduleSlot | null;
};

type StudentCountRow = {
  _id: mongoose.Types.ObjectId;
  count: number;
};

type GradeNameRow = {
  _id: mongoose.Types.ObjectId;
  name: string;
};

function isPopulatedClassGroup(
  value: TeacherClassAssignmentLean["classGroupId"]
): value is PopulatedClassGroup {
  return Boolean(value && typeof value === "object" && "_id" in value && "name" in value);
}

function isPopulatedSubject(
  value: TeacherClassAssignmentLean["subjectId"]
): value is PopulatedSubject {
  return Boolean(value && typeof value === "object" && "_id" in value && "name" in value);
}

export async function GET() {
  try {
    const context = await requireTeacher();
    await connectToDatabase();

    const period = await AcademicPeriod.findOne({
      schoolId: context.schoolId,
      isCurrent: true,
    })
      .select("_id")
      .lean();

    if (!period) {
      return Response.json({ success: true, data: { classes: [] } });
    }

    const assignments = await TeacherAssignment.find({
      schoolId: context.schoolId,
      teacherId: context.teacherId,
      academicPeriodId: period._id,
      status: "active",
    })
      .populate("classGroupId", "name gradeId homeroomTeacherId")
      .populate("subjectId", "name")
      .lean<TeacherClassAssignmentLean[]>();

    const classGroupIds = Array.from(
      new Set(
        assignments
          .map((assignment) => assignment.classGroupId)
          .filter(Boolean)
          .map((group) =>
            isPopulatedClassGroup(group) ? String(group._id) : String(group)
          )
      )
    ).map((id) => new mongoose.Types.ObjectId(id));

    const gradeIds = Array.from(
      new Set(
        assignments
          .map((assignment) => assignment.classGroupId)
          .map((group) =>
            isPopulatedClassGroup(group) && group.gradeId
              ? String(group.gradeId)
              : null
          )
          .filter(Boolean)
      )
    ).map((id) => new mongoose.Types.ObjectId(String(id)));

    const [studentCounts, grades] = await Promise.all([
      classGroupIds.length
        ? Student.aggregate([
            {
              $match: {
                schoolId: context.schoolId,
                classGroupId: { $in: classGroupIds },
                status: "active",
              },
            },
            { $group: { _id: "$classGroupId", count: { $sum: 1 } } },
          ])
        : Promise.resolve([]),
      gradeIds.length
        ? Grade.find({
            _id: { $in: gradeIds },
          })
            .select("name")
            .lean()
        : Promise.resolve([]),
    ]);

    const studentCountMap = new Map(
      studentCounts.map((entry: StudentCountRow) => [
        String(entry._id),
        entry.count,
      ])
    );

    const gradeMap = new Map(
      grades.map((grade: GradeNameRow) => [
        String(grade._id),
        grade.name,
      ])
    );

    const classes = assignments.map((assignment) => {
      const classGroup = isPopulatedClassGroup(assignment.classGroupId)
        ? assignment.classGroupId
        : undefined;
      const subject = isPopulatedSubject(assignment.subjectId)
        ? assignment.subjectId
        : undefined;

      const gradeName = classGroup ? gradeMap.get(String(classGroup.gradeId)) : undefined;
      const className = classGroup
        ? `${gradeName ? gradeName + " " : ""}${classGroup.name}`.trim()
        : "";

      const schedule = assignment.schedules
        ? assignment.schedules
        : assignment.schedule
          ? [assignment.schedule]
          : [];

      return {
        _id: classGroup?._id ? String(classGroup._id) : "",
        name: className,
        gradeName: gradeName || "",
        subjectName: subject?.name || "",
        subjectId: subject?._id ? String(subject._id) : "",
        studentCount: classGroup
          ? studentCountMap.get(String(classGroup._id)) || 0
          : 0,
        schedule: schedule.map((slot) => ({
          dayOfWeek: slot.dayOfWeek ?? null,
          startTime: slot.startTime ?? null,
          endTime: slot.endTime ?? null,
        })),
        isHomeroom: classGroup?.homeroomTeacherId
          ? String(classGroup.homeroomTeacherId) === String(context.teacherId)
          : false,
      };
    });

    return Response.json({ success: true, data: { classes } });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to fetch teacher classes:", e);
    const message = e instanceof Error ? e.message : "Failed to fetch classes";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
