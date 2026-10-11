import mongoose from "mongoose";
import { Student } from "@/models/Student";
import { Grade } from "@/models/Grade";
import { ClassGroup } from "@/models/ClassGroup";
import { Subject, type ISubject } from "@/models/Subject";
import { School } from "@/models/School";
import { SchoolSettings } from "@/models/SchoolSettings";
import { enforceSchoolLimit } from "@/lib/auth/checkLimit";
import { requireSchoolWriteAccess } from "@/lib/billing/require-school-write-access";
import { trackUsage } from "@/lib/billing/trackUsage";
import { assertAssignableStudentPhoto, linkStudentPhoto } from "@/lib/storage/student-photo";
import { resolvePersistedPhotoUrl } from "@/lib/storage/resolve-photo-url";
import {
  buildDefaultStudentIdPattern,
  buildStudentIdPatternDraft,
  generateAdmissionNoFromPattern,
  missingFieldsForPattern,
} from "@/lib/students/student-id-pattern";

export type CreateStudentForSchoolInput = {
  schoolId: mongoose.Types.ObjectId;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  gradeId: string | mongoose.Types.ObjectId;
  classGroupId: string | mongoose.Types.ObjectId;
  admissionNo?: string | null;
  sex?: "male" | "female" | null;
  dateOfBirth?: Date | null;
  photoUrl?: string | null;
  status: "active" | "inactive" | "withdrawn" | "graduated";
  enrolledAt?: Date | null;
  gesIndexNumber?: string | null;
  gesSchoolCode?: string | null;
  subjectAddIds?: string[];
  subjectRemoveIds?: string[];
  actorId?: mongoose.Types.ObjectId | null;
  enforceLimit?: boolean;
  enforceCapacity?: boolean;
  trackUsage?: boolean;
  usageNotes?: string;
};

export class StudentCreationError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "INVALID_INPUT"
      | "DUPLICATE_ADMISSION"
      | "LIMIT_REACHED"
      | "CAPACITY_REACHED"
  ) {
    super(message);
    this.name = "StudentCreationError";
  }
}

function objectId(value: string | mongoose.Types.ObjectId, field: string) {
  if (value instanceof mongoose.Types.ObjectId) return value;
  if (!mongoose.isValidObjectId(value)) {
    throw new StudentCreationError(`${field} is invalid.`, "INVALID_INPUT");
  }
  return new mongoose.Types.ObjectId(value);
}

function dateOrNull(value?: Date | null) {
  if (!value) return null;
  if (Number.isNaN(value.getTime())) {
    throw new StudentCreationError("A supplied date is invalid.", "INVALID_INPUT");
  }
  return value;
}

export async function createStudentForSchool(input: CreateStudentForSchoolInput) {
  const firstName = input.firstName.trim();
  const middleName = input.middleName?.trim() || null;
  const lastName = input.lastName.trim();
  if (!firstName || !lastName) {
    throw new StudentCreationError("First name and last name are required.", "INVALID_INPUT");
  }

  const gradeId = objectId(input.gradeId, "Grade");
  const classGroupId = objectId(input.classGroupId, "Class group");
  const dateOfBirth = dateOrNull(input.dateOfBirth);
  const enrolledAt = dateOrNull(input.enrolledAt);
  if (dateOfBirth && enrolledAt && dateOfBirth >= enrolledAt) {
    throw new StudentCreationError("Date of birth must be before enrolment date.", "INVALID_INPUT");
  }

  await requireSchoolWriteAccess({ schoolId: input.schoolId, action: "students.create" });
  if (input.enforceLimit !== false) {
    const limit = await enforceSchoolLimit({
      schoolId: input.schoolId,
      limitKey: "maxStudents",
      increment: 1,
    });
    if (!limit.allowed) {
      throw new StudentCreationError(limit.reason, "LIMIT_REACHED");
    }
  }

  const [grade, classGroup] = await Promise.all([
    Grade.findOne({ _id: gradeId, schoolId: input.schoolId, isActive: true })
      .select("_id name schoolId")
      .lean(),
    ClassGroup.findOne({
      _id: classGroupId,
      schoolId: input.schoolId,
      gradeId,
      isActive: true,
    })
      .select("_id name gradeId schoolId capacity")
      .lean(),
  ]);
  if (!grade) throw new StudentCreationError("Grade not found or not active.", "INVALID_INPUT");
  if (!classGroup) {
    throw new StudentCreationError(
      "Class group not found, not active, or does not belong to the selected grade.",
      "INVALID_INPUT"
    );
  }

  if (input.enforceCapacity !== false && classGroup.capacity != null) {
    const currentCount = await Student.countDocuments({ schoolId: input.schoolId, classGroupId });
    if (currentCount >= classGroup.capacity) {
      throw new StudentCreationError(
        `Class is at full capacity (${classGroup.capacity} students).`,
        "CAPACITY_REACHED"
      );
    }
  }

  const subjectAddIds = await validateSubjectIds(input.subjectAddIds, input.schoolId);
  const subjectRemoveIds = await validateSubjectIds(input.subjectRemoveIds, input.schoolId);
  const addSet = new Set(subjectAddIds.map(String));
  if (subjectRemoveIds.some((id) => addSet.has(String(id)))) {
    throw new StudentCreationError("A subject cannot be both added and excluded.", "INVALID_INPUT");
  }

  const suppliedAdmissionNo = input.admissionNo?.trim() || null;
  if (suppliedAdmissionNo) {
    const duplicate = await Student.findOne({ schoolId: input.schoolId, admissionNo: suppliedAdmissionNo })
      .select("_id")
      .lean();
    if (duplicate) {
      throw new StudentCreationError("Admission number already exists in this school.", "DUPLICATE_ADMISSION");
    }
  }

  const schoolIdObj = input.schoolId;
  const photo = await assertAssignableStudentPhoto({
    schoolId: schoolIdObj,
    studentId: null,
    photoUrl: await resolvePersistedPhotoUrl({ schoolId: schoolIdObj, photoUrl: input.photoUrl }),
  });
  const student = new Student({
    schoolId: schoolIdObj,
    firstName,
    middleName,
    lastName,
    gradeId,
    classGroupId,
    admissionNo: suppliedAdmissionNo,
    sex: input.sex ?? null,
    dateOfBirth,
    photoUrl: photo.photoUrl,
    status: input.status,
    enrolledAt,
    subjectAddIds: subjectAddIds.length ? subjectAddIds : undefined,
    subjectRemoveIds: subjectRemoveIds.length ? subjectRemoveIds : undefined,
    gesIndexNumber: input.gesIndexNumber?.trim() || null,
    gesSchoolCode: input.gesSchoolCode?.trim() || null,
  });

  if (!student.admissionNo) {
    const [school, settings] = await Promise.all([
      School.findById(schoolIdObj).select("name").lean(),
      SchoolSettings.findOne({ schoolId: schoolIdObj }).select("studentIdGeneration.defaultPattern").lean(),
    ]);
    const savedPatternRaw = (settings as { studentIdGeneration?: { defaultPattern?: unknown } } | null)?.studentIdGeneration?.defaultPattern;
    const pattern = savedPatternRaw && typeof savedPatternRaw === "object"
      ? buildStudentIdPatternDraft(savedPatternRaw as Record<string, unknown>)
      : buildDefaultStudentIdPattern();
    const missing = missingFieldsForPattern(pattern, {
      firstName,
      lastName,
      dateOfBirth,
      enrolledAt,
      gradeName: grade.name,
      classGroupName: classGroup.name,
    });
    if (!missing.length) {
      const generated = await generateAdmissionNoFromPattern(pattern, {
        schoolId: schoolIdObj,
        schoolName: school?.name || "School",
        firstName,
        lastName,
        dateOfBirth,
        enrolledAt,
        gradeName: grade.name,
        classGroupName: classGroup.name,
      });
      student.admissionNo = generated.admissionNo;
    }
  }

  if (student.admissionNo) {
    const duplicate = await Student.findOne({ schoolId: schoolIdObj, admissionNo: student.admissionNo })
      .select("_id")
      .lean();
    if (duplicate) {
      throw new StudentCreationError("Admission number already exists in this school.", "DUPLICATE_ADMISSION");
    }
  }
  await student.save();
  if (photo.pendingLinkAssetId) {
    await linkStudentPhoto({ schoolId: schoolIdObj, studentId: student._id, assetId: photo.pendingLinkAssetId });
  }
  if (input.trackUsage !== false) {
    await trackUsage({
      schoolId: schoolIdObj,
      provider: "internal",
      metricKey: "student_records_created",
      quantity: 1,
      unitLabel: "students",
      allocationMethod: "manual",
      sourceType: "manual",
      actorId: input.actorId || null,
      entityType: "Student",
      entityId: student._id,
      notes: input.usageNotes || "Student created through admin workflow.",
    });
  }
  return student;
}

async function validateSubjectIds(values: string[] | undefined, schoolId: mongoose.Types.ObjectId) {
  if (!values?.length) return [] as mongoose.Types.ObjectId[];
  const ids = values.map((value) => objectId(value, "Subject"));
  const subjects = (await Subject.find({ _id: { $in: ids }, schoolId, isActive: true }).select("_id").lean()) as Array<Pick<ISubject, "_id">>;
  const valid = new Set(subjects.map((subject) => String(subject._id)));
  if (ids.some((id) => !valid.has(String(id)))) {
    throw new StudentCreationError("One or more subject IDs are invalid.", "INVALID_INPUT");
  }
  return ids;
}
