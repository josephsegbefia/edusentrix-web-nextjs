import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { Types } from "mongoose";
import { stubServerOnly } from "./regression/helpers/stub-server-only";

stubServerOnly();

describe("BI.1 shared import intelligence", () => {
  test("Import Leo access is independent of the normal Leo entitlement", async () => {
    const { resolveImportLeoAccess } = await import("@/lib/import-intelligence/access");
    const schoolId = new Types.ObjectId();
    assert.deepEqual(await resolveImportLeoAccess({ schoolId, authorized: true, providerConfigured: true, platform: { enabled: true } }), {
      available: true,
      reasonCode: "available",
      retryable: false,
    });
    assert.equal((await resolveImportLeoAccess({ schoolId, authorized: false, providerConfigured: true, platform: { enabled: true } })).reasonCode, "unauthorized");
    assert.equal((await resolveImportLeoAccess({ schoolId, authorized: true, providerConfigured: true, platform: { enabled: false } })).reasonCode, "platform_disabled");
    assert.equal((await resolveImportLeoAccess({ schoolId, authorized: true, providerConfigured: false, platform: { enabled: true } })).reasonCode, "provider_not_configured");
    assert.equal((await resolveImportLeoAccess({ schoolId, authorized: true, providerConfigured: true, privacyOptOut: true, platform: { enabled: true } })).reasonCode, "privacy_disabled");
  });

  test("active drafts are application-level and scoped to school, admin, and domain model", async () => {
    const { assertNoActiveImportDraft, findActiveImportDraft, ActiveImportDraftError } = await import("@/lib/import-intelligence/active-draft");
    const calls: unknown[] = [];
    const model = {
      findOne(filter: unknown) {
        calls.push(filter);
        return { sort: async () => ({ _id: "draft-1" }) };
      },
    } as never;
    const schoolId = new Types.ObjectId();
    const createdByUserId = new Types.ObjectId();
    const found = await findActiveImportDraft({ model, schoolId, createdByUserId });
    assert.equal(found?._id, "draft-1");
    assert.deepEqual(calls[0], {
      schoolId,
      createdByUserId,
      status: { $in: ["uploaded", "analyzing", "review_ready", "failed"] },
    });
    await assert.rejects(
      () => assertNoActiveImportDraft({ model, schoolId, createdByUserId }),
      (error: unknown) => error instanceof ActiveImportDraftError && error.importJobId === "draft-1"
    );
  });

  test("the shared boundary validates structured provider output", async () => {
    const { runLeoImportIntelligence } = await import("@/lib/import-intelligence/leo");
    const { z } = await import("zod");
    const schoolId = new Types.ObjectId();
    const schema = z.object({ ok: z.boolean() }).strict();
    const valid = await runLeoImportIntelligence({
      domain: "teacher", task: "map_columns", schoolId, authorized: true,
      context: JSON.stringify({ headers: ["Mobile"] }), responseSchema: schema, inputCount: 1,
    }, { platform: { enabled: true }, provider: { provider: "test", completeJson: async () => JSON.stringify({ ok: true }) } });
    assert.equal(valid.ok, true);
    const invalid = await runLeoImportIntelligence({
      domain: "student", task: "interpret_vocabulary", schoolId, authorized: true,
      context: "{}", responseSchema: schema, inputCount: 0,
    }, { platform: { enabled: true }, provider: { provider: "test", completeJson: async () => "{bad" } });
    assert.equal(invalid.ok, false);
    if (!invalid.ok) assert.equal(invalid.metadata.lastErrorCode, "IMPORT_AI_INVALID_RESPONSE");
  });

  test("proposal validation rejects unknown actions, row references, catalog keys, and ObjectIds", async () => {
    const { validateImportProposal } = await import("@/lib/import-intelligence/actions");
    const base = { explanation: "Review", confirmationText: "I understood that you want to…", requiresConfirmation: true };
    const valid = validateImportProposal({ proposal: { ...base, proposedActions: [{ actionId: "action_map_01", type: "select_catalog_item", issueId: null, rowRefs: ["T001"], fieldKey: "subject", catalogKey: "SUBJECT_001" }] }, allowedRowRefs: ["T001"], allowedCatalogKeys: ["SUBJECT_001"] });
    assert.equal(valid.ok, true);
    const unknownRow = validateImportProposal({ proposal: { ...base, proposedActions: [{ actionId: "action_map_02", type: "select_catalog_item", issueId: null, rowRefs: ["T999"], fieldKey: "subject", catalogKey: "SUBJECT_001" }] }, allowedRowRefs: ["T001"], allowedCatalogKeys: ["SUBJECT_001"] });
    assert.equal(unknownRow.ok, false);
    const mongoId = validateImportProposal({ proposal: { ...base, proposedActions: [{ actionId: "action_map_03", type: "select_catalog_item", issueId: null, rowRefs: ["T001"], fieldKey: "subject", catalogKey: "SUBJECT_001", extra: "507f1f77bcf86cd799439011" }] }, allowedRowRefs: ["T001"], allowedCatalogKeys: ["SUBJECT_001"] });
    assert.equal(mongoId.ok, false);
  });

  test("column contracts support one-to-one, many-to-one, and one-to-many interpretation", async () => {
    const { importColumnInterpretationSchema } = await import("@/lib/import-intelligence/schemas");
    assert.equal(importColumnInterpretationSchema.safeParse({ sourceColumn: "Mobile", sourceColumnKey: "mobile", proposedCanonicalField: "phone", source: "deterministic_alias", confidenceBand: "high", requiresConfirmation: false, explanation: "Known alias", transformation: "none" }).success, true);
    assert.equal(importColumnInterpretationSchema.safeParse({ sourceColumn: "Course 1", sourceColumnKey: "course_1", proposedCanonicalField: "subjects", source: "structural", confidenceBand: "medium", requiresConfirmation: true, explanation: "Contributes to repeated subject values", contributesTo: ["subjects"], transformation: "expand_list" }).success, true);
    assert.equal(importColumnInterpretationSchema.safeParse({ sourceColumn: "P4 A", sourceColumnKey: "form", proposedCanonicalField: null, source: "leo", confidenceBand: "low", requiresConfirmation: true, explanation: "Contains grade and class context", contributesTo: ["grade", "classGroup"], transformation: "associate_context" }).success, true);
  });

  test("student AI context excludes representative PII and remains bounded/grouped", async () => {
    const { buildStudentImportAiContext, boundContext } = await import("@/lib/import-intelligence/privacy");
    const context = buildStudentImportAiContext({
      task: "interpret_vocabulary",
      unresolvedGrades: [{ value: "Basic One", rowRef: "S001" }],
      unresolvedClasses: [{ value: "Stream A", rowRef: "S001" }],
      sexValues: ["F"], statusValues: ["Current"],
      gradeCatalog: [{ catalogKey: "GRADE_001", label: "Basic One" }],
      classCatalog: [{ catalogKey: "CLASS_001", label: "Stream A", gradeKey: "GRADE_001" }],
    });
    assert.doesNotMatch(context, /Ama Mensah|1998-02-03|ADM-001|guardian@example.com|0240000000|GES-001/);
    assert.ok(context.length < 24_000);
    assert.match(context, /affectedRowRefs/);
    assert.ok(boundContext({ values: Array.from({ length: 100000 }, () => "x") }).length < 24_000);
  });

  test("stable issue identity and admin precedence survive review serialization", async () => {
    const { createImportIssue, applyIssueResolution } = await import("@/lib/import-intelligence/issues");
    const { buildImportReviewDto } = await import("@/lib/import-intelligence/serialize");
    const issue = createImportIssue({ domain: "teacher", issueType: "ambiguous_subject", scope: "row", rowRefs: ["T001"], fieldKey: "subject", sourceValues: ["Creative Arts"], severity: "blocking", resolutionClass: "BLOCKING", explanation: "Choose an offering" });
    const sameIssue = createImportIssue({ domain: "teacher", issueType: "ambiguous_subject", scope: "row", rowRefs: ["T001"], fieldKey: "subject", sourceValues: ["Creative Arts"], severity: "blocking", resolutionClass: "BLOCKING", explanation: "Changed explanation" });
    assert.equal(issue.issueId, sameIssue.issueId);
    const action = { actionId: "action_choose_01", type: "select_catalog_item" as const, rowRefs: ["T001"], issueId: issue.issueId, fieldKey: "subject", catalogKey: "SUBJECT_001" };
    const resolved = applyIssueResolution({ issue, action, source: "admin" });
    const dto = buildImportReviewDto({ domain: "teacher", job: { status: "review_ready", analysisIssues: [resolved], analysisSummary: {} } });
    assert.equal(dto.currentIssues[0]?.status, "resolved");
    assert.equal(dto.currentIssues[0]?.resolvedBy, "admin");
  });

  test("natural-language proposals remain unconfirmed and V1 compatibility is explicit", async () => {
    const { createPendingNaturalLanguageResolution, validateNaturalLanguageResolution } = await import("@/lib/import-intelligence/actions");
    const { compatibilityForImportJob } = await import("@/lib/import-intelligence/versioning");
    const pending = createPendingNaturalLanguageResolution({ issueId: "issue_123456", instructionText: "She also teaches Primary 6.", submittedBy: "admin-1" });
    assert.equal(pending.interpretationStatus, "pending");
    assert.equal(pending.confirmedAt, null);
    assert.equal(validateNaturalLanguageResolution(pending).success, true);
    assert.equal(compatibilityForImportJob({ importSchemaVersion: 2, analysisVersion: "v2" }).outcome, "compatible");
    assert.equal(compatibilityForImportJob({ fileBytes: Buffer.from("csv") }).outcome, "reanalysis_required");
    assert.equal(compatibilityForImportJob({}).outcome, "restart_required");
  });

  test("teacher and student import domains contain no direct provider SDK coupling", () => {
    for (const path of ["src/lib/teachers/teacher-import-leo.ts", "src/lib/students/student-import-leo.ts"]) {
      assert.doesNotMatch(readFileSync(path, "utf8"), /from ["']openai["']/);
      assert.doesNotMatch(readFileSync(path, "utf8"), /new OpenAI/);
    }
  });
});
