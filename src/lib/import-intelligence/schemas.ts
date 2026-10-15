import { z } from "zod";

const opaqueCatalogKey = z.string().regex(/^(SUBJECT|GRADE|CLASS|FIELD|OPTION)_[A-Z0-9_]+$/);
const rowRef = z.string().regex(/^[TS][0-9]{3,8}$/);
const actionId = z.string().regex(/^action_[a-zA-Z0-9_-]{6,80}$/);

const actionBase = {
  actionId,
  issueId: z.string().regex(/^issue_[a-zA-Z0-9_-]{6,100}$/).nullable().optional(),
  rowRefs: z.array(rowRef).max(200),
};

export const importProposedActionSchema = z.discriminatedUnion("type", [
  z.object({ ...actionBase, type: z.literal("map_column"), sourceColumnKey: z.string().min(1).max(120), proposedCanonicalField: z.string().min(1).max(120) }).strict(),
  z.object({ ...actionBase, type: z.literal("select_catalog_item"), fieldKey: z.string().min(1).max(120), catalogKey: opaqueCatalogKey }).strict(),
  z.object({ ...actionBase, type: z.literal("ignore_source_value"), sourceValue: z.string().min(1).max(300) }).strict(),
  z.object({ ...actionBase, type: z.literal("set_field_value"), fieldKey: z.string().min(1).max(120), value: z.string().max(500) }).strict(),
  z.object({ ...actionBase, type: z.literal("split_name"), sourceColumnKey: z.string().min(1).max(120), targetFields: z.array(z.enum(["firstName", "middleName", "lastName", "fullName"])).min(1).max(4) }).strict(),
  z.object({ ...actionBase, type: z.literal("associate_context"), contextType: z.enum(["subject", "grade", "class"]), catalogKey: opaqueCatalogKey }).strict(),
  z.object({ ...actionBase, type: z.literal("remove_association"), fieldKey: z.string().min(1).max(120), catalogKey: opaqueCatalogKey.nullable().optional() }).strict(),
  z.object({ ...actionBase, type: z.literal("keep_existing"), fieldKey: z.string().min(1).max(120) }).strict(),
  z.object({ ...actionBase, type: z.literal("flag_for_manual_entry"), fieldKey: z.string().min(1).max(120), explanation: z.string().min(1).max(500) }).strict(),
  z.object({ ...actionBase, type: z.literal("choose_homeroom"), teacherRef: rowRef, classGroupKey: opaqueCatalogKey }).strict(),
  z.object({ ...actionBase, type: z.literal("replace_homeroom"), teacherRef: rowRef, classGroupKey: opaqueCatalogKey }).strict(),
  z.object({ ...actionBase, type: z.literal("clear_homeroom"), teacherRef: rowRef }).strict(),
  z.object({ ...actionBase, type: z.literal("add_subject_profile"), teacherRef: rowRef, subjectOfferingKey: opaqueCatalogKey }).strict(),
  z.object({ ...actionBase, type: z.literal("remove_subject_profile"), teacherRef: rowRef, subjectOfferingKey: opaqueCatalogKey }).strict(),
  z.object({ ...actionBase, type: z.literal("add_grade_context"), teacherRef: rowRef, gradeKey: opaqueCatalogKey }).strict(),
  z.object({ ...actionBase, type: z.literal("remove_grade_context"), teacherRef: rowRef, gradeKey: opaqueCatalogKey }).strict(),
  z.object({ ...actionBase, type: z.literal("add_class_context"), teacherRef: rowRef, classGroupKey: opaqueCatalogKey }).strict(),
  z.object({ ...actionBase, type: z.literal("remove_class_context"), teacherRef: rowRef, classGroupKey: opaqueCatalogKey }).strict(),
  z.object({ ...actionBase, type: z.literal("add_assignment_proposal"), teacherRef: rowRef, subjectOfferingKey: opaqueCatalogKey, classGroupKey: opaqueCatalogKey, academicPeriodKey: opaqueCatalogKey.optional() }).strict(),
  z.object({ ...actionBase, type: z.literal("remove_assignment_proposal"), teacherRef: rowRef, subjectOfferingKey: opaqueCatalogKey, classGroupKey: opaqueCatalogKey }).strict(),
  z.object({ ...actionBase, type: z.literal("confirm_coteaching"), teacherRef: rowRef, subjectOfferingKey: opaqueCatalogKey, classGroupKey: opaqueCatalogKey }).strict(),
]);

export const importProposalSchema = z.object({
  explanation: z.string().max(1200),
  confirmationText: z.string().max(1200),
  requiresConfirmation: z.boolean(),
  proposedActions: z.array(importProposedActionSchema).max(200),
}).strict();

export const naturalLanguageResolutionSchema = z.object({
  instructionId: z.string().regex(/^instruction_[a-zA-Z0-9_-]{6,100}$/),
  issueId: z.string().regex(/^issue_[a-zA-Z0-9_-]{6,100}$/),
  instructionText: z.string().min(1).max(2000),
  submittedBy: z.string().min(1).max(120),
  submittedAt: z.string().datetime(),
  interpretationStatus: z.enum(["pending", "interpreted", "invalid", "failed"]),
  proposedActions: z.array(importProposedActionSchema).max(200),
  explanation: z.string().max(1200).nullable(),
  confirmationText: z.string().max(1200).nullable(),
  confirmedAt: z.string().datetime().nullable(),
  confirmedBy: z.string().max(120).nullable(),
}).strict();

export const importColumnInterpretationSchema = z.object({
  sourceColumn: z.string().min(1).max(200),
  sourceColumnKey: z.string().min(1).max(120),
  proposedCanonicalField: z.string().max(120).nullable(),
  source: z.enum(["exact", "deterministic_alias", "structural", "leo", "admin"]),
  confidenceBand: z.enum(["high", "medium", "low"]),
  requiresConfirmation: z.boolean(),
  explanation: z.string().max(500),
  contributesTo: z.array(z.string().max(120)).max(20).optional(),
  transformation: z.enum(["none", "split_name", "expand_list", "associate_context", "normalize_value"]).optional(),
}).strict();

export const importIssueSchema = z.object({
  issueId: z.string().regex(/^issue_[a-zA-Z0-9_-]{6,100}$/),
  domain: z.enum(["teacher", "student"]),
  scope: z.enum(["file", "sheet", "column", "row", "group"]),
  rowRefs: z.array(rowRef).max(200),
  fieldKey: z.string().max(120).nullable().optional(),
  issueType: z.string().min(1).max(120),
  severity: z.enum(["info", "warning", "blocking"]),
  sourceValues: z.array(z.string().max(500)).max(100),
  explanation: z.string().max(1200),
  recommendedAction: z.string().max(500).nullable().optional(),
  candidateActions: z.array(importProposedActionSchema).max(100),
  resolutionClass: z.enum(["AUTO", "REVIEW", "BLOCKING"]),
  requiresHumanConfirmation: z.boolean(),
  status: z.enum(["open", "resolved", "ignored"]),
  resolvedAction: importProposedActionSchema.nullable().optional(),
  resolvedBy: z.enum(["deterministic", "leo", "admin", "admin_via_leo"]).nullable().optional(),
  context: z.object({
    gradeBand: z.string().max(120).nullable().optional(),
    gradeIds: z.array(z.string().max(120)).max(100).optional(),
    candidateOfferingIds: z.array(z.string().max(120)).max(100).optional(),
  }).strict().nullable().optional(),
  affectedCount: z.number().int().min(0).max(100000).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).strict();

export { opaqueCatalogKey, rowRef };
