import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { Types } from "mongoose";
import { stubServerOnly } from "./regression/helpers/stub-server-only";

stubServerOnly();

describe("teacher import API serialization", () => {
  test("serializes hydrated rows with top-level arrays and flattened source values", async () => {
    const { serializeTeacherImportJob } = await import("@/lib/teachers/teacher-import-workflow");
    const { TeacherImportJob } = await import("@/models/TeacherImportJob");
    const hydrated = new TeacherImportJob({
      _id: new Types.ObjectId(),
      schoolId: new Types.ObjectId(),
      createdByUserId: new Types.ObjectId(),
      status: "review_ready",
      fileName: "teachers.csv",
      invitationMode: "send_now",
      parsedRows: [{
        sourceRowNumber: 2,
        sourceValues: { Subjects: "Creative Arts - Primary" },
        firstName: "Ama",
        lastName: "Mensah",
        email: "ama@example.com",
        subjects: ["Creative Arts - Primary"],
        subjectOfferingIds: ["offering-id"],
        subjectIds: ["subject-id"],
        resolutionStatus: "resolved",
        rowState: "ready",
        issues: [],
      }],
      subjectResolutions: [{
        resolutionKey: "creative-arts-primary::grade-1",
        sourceValue: "Creative Arts - Primary",
        subjectOfferingIds: ["offering-id"],
        resolvedNames: ["Creative Arts - Lower Primary"],
        source: "leo",
        status: "resolved",
        affectedRows: [2],
      }],
      classResolutions: [],
      columnMappings: [],
      analysisWarnings: [],
      analysisErrors: [],
      availableSheets: [],
      sheetSelectionRequired: false,
    });

    const result = serializeTeacherImportJob(hydrated as never);
    const row = result.parsedRows[0];

    assert.deepEqual(row.subjects, ["Creative Arts - Primary"]);
    assert.equal((row as Record<string, unknown>)._doc, undefined);
    assert.deepEqual(row.sourceValues, { Subjects: "Creative Arts - Primary" });
    assert.equal(Array.isArray(row.issues), true);
    assert.equal(Array.isArray(row.subjectOfferingIds), true);
    assert.equal(Array.isArray(row.subjectIds), true);
    assert.equal(result.subjectResolutions[0]?.resolutionKey, "creative-arts-primary::grade-1");
    assert.doesNotMatch(JSON.stringify(result), /\$__|_doc|\$isNew/);
  });

  test("hydrated and lean representations serialize equivalently", async () => {
    const { serializeTeacherImportJob } = await import("@/lib/teachers/teacher-import-workflow");
    const { TeacherImportJob } = await import("@/models/TeacherImportJob");
    const hydrated = new TeacherImportJob({
      _id: new Types.ObjectId(),
      schoolId: new Types.ObjectId(),
      createdByUserId: new Types.ObjectId(),
      status: "review_ready",
      fileName: "teachers.csv",
      invitationMode: "send_now",
      parsedRows: [{
        sourceRowNumber: 2,
        sourceValues: { Email: "ama@example.com" },
        firstName: "Ama",
        lastName: "Mensah",
        email: "ama@example.com",
        subjects: [],
        subjectOfferingIds: [],
        subjectIds: [],
        resolutionStatus: "needs_review",
        rowState: "pending",
        issues: [{ code: "not_found", message: "Review subject", field: "subjects", value: "Arts" }],
      }],
      subjectResolutions: [],
      classResolutions: [],
      columnMappings: [],
      analysisWarnings: [],
      analysisErrors: [],
      availableSheets: [],
      sheetSelectionRequired: false,
    });

    const hydratedResult = serializeTeacherImportJob(hydrated as never);
    const leanResult = serializeTeacherImportJob(hydrated.toObject({ flattenMaps: true }) as never);
    assert.deepEqual(leanResult, hydratedResult);
  });

  test("normalizes legacy rows with missing arrays without marking them ready", async () => {
    const { serializeTeacherImportJob } = await import("@/lib/teachers/teacher-import-workflow");
    const result = serializeTeacherImportJob({
      _id: new Types.ObjectId(),
      status: "review_ready",
      fileName: "legacy.csv",
      parsedRows: [{
        sourceRowNumber: 2,
        sourceValues: { Name: "Ama Mensah" },
        firstName: "Ama",
        lastName: "Mensah",
        email: "ama@example.com",
        resolutionStatus: "needs_review",
        rowState: "pending",
      }],
    } as never);

    const row = result.parsedRows[0];
    assert.deepEqual(row.subjects, []);
    assert.deepEqual(row.subjectOfferingIds, []);
    assert.deepEqual(row.subjectIds, []);
    assert.deepEqual(row.issues, []);
    assert.equal(row.resolutionStatus, "needs_review");
    assert.equal(row.rowState, "pending");
  });

  test("marks imports missing analysis state for re-analysis", async () => {
    const { serializeTeacherImportJob } = await import("@/lib/teachers/teacher-import-workflow");
    const result = serializeTeacherImportJob({
      _id: new Types.ObjectId(),
      status: "review_ready",
      fileName: "older.csv",
      parsedRows: [{ sourceRowNumber: 2, firstName: "Ama", lastName: "Mensah", email: "ama@example.com" }],
    } as never);

    assert.equal(result.parsedRows[0]?.rowState, "pending");
    assert.equal(result.parsedRows[0]?.resolutionStatus, "needs_review");
    assert.match(result.parsedRows[0]?.issues[0]?.message || "", /older import version/);
    assert.match(result.analysisWarnings[0]?.message || "", /re-analysed\/re-uploaded/);
  });
});
