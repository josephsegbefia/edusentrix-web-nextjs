/**
 * In-memory MongoDB plus raw-document seeders for student photo tests. Seeds
 * go straight to the collections so model hooks (grade and class checks) do
 * not get in the way; the code under test only reads the fields set here.
 */
import { randomUUID } from "node:crypto";
import mongoose, { Types } from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { disableAutoIndexing } from "../../regression/helpers/disable-auto-indexing";
import type { StorageActor } from "@/lib/storage/types";

export const SCHOOL_A = new Types.ObjectId("64b7f0c2a1d2e3f405060708");
export const SCHOOL_B = new Types.ObjectId("64b7f0c2a1d2e3f405060799");

let mongod: MongoMemoryServer | null = null;

const MODELS = [
  "@/models/StoredAsset",
  "@/models/Student",
  "@/models/Teacher",
  "@/models/ClassGroup",
  "@/models/TeacherAssignment",
  "@/models/Guardian",
  "@/models/Delegation",
  "@/models/LearnStudentSession",
  "@/models/LearnStudentAccount",
  "@/models/AdmissionApplication",
];

export async function startStorageDb(dbName: string) {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  process.env.MONGO_DB_NAME = dbName;
  for (const specifier of MODELS) {
    await import(specifier);
  }
  disableAutoIndexing();
  const { connectToDatabase } = await import("@/db/connectToDatabase");
  await connectToDatabase();
}

export async function stopStorageDb() {
  await mongoose.disconnect().catch(() => undefined);
  await mongod?.stop();
}

export async function resetStorageDb() {
  await mongoose.connection.db!.dropDatabase();
}

function collection(model: string) {
  return mongoose.model(model).collection;
}

export function actor(overrides: Partial<StorageActor> = {}): StorageActor {
  return {
    userId: new Types.ObjectId(),
    schoolId: SCHOOL_A,
    roles: ["teacher"],
    ...overrides,
  };
}

export async function seedClassGroup(input: { schoolId?: Types.ObjectId; homeroomTeacherId?: Types.ObjectId } = {}) {
  const _id = new Types.ObjectId();
  await collection("ClassGroup").insertOne({
    _id,
    schoolId: input.schoolId ?? SCHOOL_A,
    name: "Class",
    homeroomTeacherId: input.homeroomTeacherId ?? null,
    isActive: true,
  });
  return _id;
}

export async function seedStudent(input: {
  schoolId?: Types.ObjectId;
  classGroupId?: Types.ObjectId | null;
  photoUrl?: string | null;
  status?: string;
} = {}) {
  const _id = new Types.ObjectId();
  await collection("Student").insertOne({
    _id,
    schoolId: input.schoolId ?? SCHOOL_A,
    firstName: "Test",
    lastName: "Student",
    classGroupId: input.classGroupId ?? null,
    photoUrl: input.photoUrl ?? null,
    status: input.status ?? "active",
  });
  return _id;
}

export async function setStudentPhoto(studentId: Types.ObjectId, photoUrl: string | null) {
  await collection("Student").updateOne({ _id: studentId }, { $set: { photoUrl } });
}

export async function seedAsset(input: {
  schoolId?: Types.ObjectId;
  kind?: string;
  visibility?: "public" | "private";
  status?: "pending" | "ready" | "deleted" | "failed";
  association?: { type: string; id: Types.ObjectId } | null;
  uploadedByUserId?: Types.ObjectId | null;
  mimeType?: string;
} = {}) {
  const _id = new Types.ObjectId();
  const schoolId = input.schoolId ?? SCHOOL_A;
  const kind = input.kind ?? "student_avatar";
  await collection("StoredAsset").insertOne({
    _id,
    schoolId,
    ownerUserId: input.uploadedByUserId ?? null,
    uploadedByUserId: input.uploadedByUserId === undefined ? new Types.ObjectId() : input.uploadedByUserId,
    provider: "r2",
    storageKey: `schools/${schoolId}/pending/${kind}/${randomUUID()}.jpg`,
    fileName: "photo.jpg",
    extension: "jpg",
    mimeType: input.mimeType ?? "image/jpeg",
    sizeBytes: 12,
    kind,
    visibility: input.visibility ?? "private",
    status: input.status ?? "ready",
    association: input.association ?? null,
    deletedAt: null,
    purgeAfter: null,
  });
  return _id;
}

export function assetPath(assetId: Types.ObjectId | string) {
  return `/api/storage/assets/${String(assetId)}`;
}

export async function seedTeacher(input: {
  userId: Types.ObjectId;
  schoolId?: Types.ObjectId;
  homeroomClassGroupId?: Types.ObjectId | null;
}) {
  const _id = new Types.ObjectId();
  await collection("Teacher").insertOne({
    _id,
    userId: input.userId,
    schoolId: input.schoolId ?? SCHOOL_A,
    homeroomClassGroupId: input.homeroomClassGroupId ?? null,
  });
  return _id;
}

export async function seedAssignment(input: {
  teacherId: Types.ObjectId;
  classGroupId: Types.ObjectId;
  status?: string;
  schoolId?: Types.ObjectId;
}) {
  await collection("TeacherAssignment").insertOne({
    _id: new Types.ObjectId(),
    schoolId: input.schoolId ?? SCHOOL_A,
    teacherId: input.teacherId,
    classGroupId: input.classGroupId,
    status: input.status ?? "active",
  });
}

export async function seedGuardian(input: { userId: Types.ObjectId; studentId: Types.ObjectId }) {
  await collection("Guardian").insertOne({
    _id: new Types.ObjectId(),
    userId: input.userId,
    studentId: input.studentId,
  });
}

/** An admission application whose tracker token is a valid special link token. */
export async function seedApplicationWithTracker(input: { schoolId?: Types.ObjectId } = {}) {
  const _id = new Types.ObjectId();
  const token = `tracker-${randomUUID()}`;
  await collection("AdmissionApplication").insertOne({
    _id,
    schoolId: input.schoolId ?? SCHOOL_A,
    cycleId: new Types.ObjectId(),
    referenceCode: `REF-${randomUUID().slice(0, 8)}`,
    status: "submitted",
    tracker: { token },
    supplementalDocumentRequests: [],
  });
  return { applicationId: _id, token };
}

/** A supplemental document request on an application; its token is a valid special link token. */
export async function seedSupplementalRequest(input: { applicationId: Types.ObjectId }) {
  const requestId = new Types.ObjectId();
  const token = `supplemental-${randomUUID()}`;
  await collection("AdmissionApplication").updateOne(
    { _id: input.applicationId },
    {
      $push: {
        supplementalDocumentRequests: { _id: requestId, token, label: "Report card", fulfilledAt: null },
      },
    } as never
  );
  return { requestId, token };
}

/** A parent document request on a student; its token is a valid special link token. */
export async function seedParentDocumentRequest(input: {
  studentId: Types.ObjectId;
}) {
  const requestId = new Types.ObjectId();
  const token = `request-${randomUUID()}`;
  await collection("Student").updateOne(
    { _id: input.studentId },
    { $push: { parentDocumentRequests: { _id: requestId, token, label: "Birth certificate", fulfilledAt: null } } } as never
  );
  return { requestId, token };
}

export async function seedDelegation(input: {
  staffUserId: Types.ObjectId;
  permissions: string[];
  schoolId?: Types.ObjectId;
}) {
  await collection("Delegation").insertOne({
    _id: new Types.ObjectId(),
    schoolId: input.schoolId ?? SCHOOL_A,
    staffUserId: input.staffUserId,
    module: "students",
    preset: "custom",
    permissions: input.permissions,
    status: "active",
    startsAt: new Date(),
    expiresAt: null,
    grantedByUserId: new Types.ObjectId(),
  });
}
