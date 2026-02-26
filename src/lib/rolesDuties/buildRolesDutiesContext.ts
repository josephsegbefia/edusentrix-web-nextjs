// src/lib/rolesDuties/buildRolesDutiesContext.ts
/**
 * Builds a compact string summary of roles/duties data for LLM prompts.
 * Keeps output under ~800 tokens to minimize cost.
 */
import mongoose from "mongoose";
import {
  SchoolRoleDefinition,
  SchoolStudentRole,
} from "@/models/SchoolStudentRole";
import {
  DutyDefinition,
  TeacherDutyAssignment,
} from "@/models/TeacherDutyAssignment";
import { ClassRoleDefinition } from "@/models/ClassRoleDefinition";
import { StudentClassRole } from "@/models/StudentClassRole";
import { AcademicPeriod } from "@/models/AcademicPeriod";

export type RolesDutiesTab = "student-roles" | "teacher-duties" | "class-roles";

export async function buildRolesDutiesContext(
  schoolId: string | mongoose.Types.ObjectId,
  tab: RolesDutiesTab
): Promise<string> {
  const schoolIdObj =
    schoolId instanceof mongoose.Types.ObjectId
      ? schoolId
      : new mongoose.Types.ObjectId(String(schoolId));

  const period = await AcademicPeriod.findOne({
    schoolId: schoolIdObj,
    isCurrent: true,
  })
    .select("_id yearLabel term")
    .lean();

  const periodId = period?._id ?? null;
  const periodLabel = period ? `${period.yearLabel} ${period.term}` : "No current period";

  if (tab === "student-roles") {
    return buildStudentRolesContext(schoolIdObj, periodId, periodLabel);
  }
  if (tab === "teacher-duties") {
    return buildTeacherDutiesContext(schoolIdObj, periodId, periodLabel);
  }
  return buildClassRolesContext(schoolIdObj, periodId, periodLabel);
}

async function buildStudentRolesContext(
  schoolId: mongoose.Types.ObjectId,
  periodId: mongoose.Types.ObjectId | null,
  periodLabel: string
): Promise<string> {
  const [defs, assignments] = await Promise.all([
    SchoolRoleDefinition.find({ schoolId, isActive: true })
      .select("_id name code maxPerSchool category")
      .lean(),
    periodId
      ? SchoolStudentRole.find({
          schoolId,
          academicPeriodId: periodId,
          isActive: true,
        })
          .select("roleDefinitionId studentId")
          .lean()
      : [],
  ]);

  const assignByRole = new Map<string, number>();
  for (const a of assignments) {
    const rid = String(a.roleDefinitionId);
    assignByRole.set(rid, (assignByRole.get(rid) ?? 0) + 1);
  }

  const overCap: string[] = [];
  const unused: string[] = [];
  const roleLines: string[] = [];

  for (const r of defs) {
    const rid = String(r._id);
    const count = assignByRole.get(rid) ?? 0;
    const max = r.maxPerSchool ?? null;
    const status =
      max != null && count > max
        ? `OVER (${count}/${max})`
        : max != null
          ? `${count}/${max}`
          : `${count}`;
    roleLines.push(`${r.name}(${r.code}): ${status}`);
    if (max != null && count > max) overCap.push(r.name);
    if (count === 0) unused.push(r.name);
  }

  const parts: string[] = [
    `[Student Roles] Period: ${periodLabel}`,
    `Definitions: ${defs.length} | Assignments: ${assignments.length}`,
    `Roles: ${roleLines.join("; ")}`,
  ];
  if (overCap.length) parts.push(`Over-capacity: ${overCap.join(", ")}`);
  if (unused.length) parts.push(`Unused: ${unused.join(", ")}`);
  return parts.join("\n");
}

async function buildTeacherDutiesContext(
  schoolId: mongoose.Types.ObjectId,
  periodId: mongoose.Types.ObjectId | null,
  periodLabel: string
): Promise<string> {
  const [defs, assignments] = await Promise.all([
    DutyDefinition.find({ schoolId, isActive: true })
      .select("_id name code minTeachersRequired maxTeachersAllowed category")
      .lean(),
    periodId
      ? TeacherDutyAssignment.find({
          schoolId,
          academicPeriodId: periodId,
          isActive: true,
        })
          .select("dutyDefinitionId teacherId")
          .lean()
      : [],
  ]);

  const assignByDuty = new Map<string, number>();
  const assignByTeacher = new Map<string, number>();
  for (const a of assignments) {
    const did = String(a.dutyDefinitionId);
    const tid = String(a.teacherId);
    assignByDuty.set(did, (assignByDuty.get(did) ?? 0) + 1);
    assignByTeacher.set(tid, (assignByTeacher.get(tid) ?? 0) + 1);
  }

  const underStaffed: string[] = [];
  const overCap: string[] = [];
  const unused: string[] = [];
  const dutyLines: string[] = [];

  for (const d of defs) {
    const did = String(d._id);
    const count = assignByDuty.get(did) ?? 0;
    const min = d.minTeachersRequired ?? 1;
    const max = d.maxTeachersAllowed ?? null;
    let status = `${count}`;
    if (min > 0) status += ` (min ${min})`;
    if (max != null) status += count > max ? ` OVER/${max}` : `/${max}`;
    dutyLines.push(`${d.name}(${d.code}): ${status}`);
    if (count < min) underStaffed.push(d.name);
    if (max != null && count > max) overCap.push(d.name);
    if (count === 0) unused.push(d.name);
  }

  const teacherCounts = [...assignByTeacher.values()];
  const maxDuties = teacherCounts.length ? Math.max(...teacherCounts) : 0;
  const overloadedCount =
    teacherCounts.length > 0
      ? teacherCounts.filter((c) => c >= 5).length
      : 0;

  const parts: string[] = [
    `[Teacher Duties] Period: ${periodLabel}`,
    `Definitions: ${defs.length} | Assignments: ${assignments.length} | Teachers with duties: ${assignByTeacher.size}`,
    `Duties: ${dutyLines.join("; ")}`,
  ];
  if (underStaffed.length) parts.push(`Under-staffed: ${underStaffed.join(", ")}`);
  if (overCap.length) parts.push(`Over-capacity: ${overCap.join(", ")}`);
  if (unused.length) parts.push(`Unused: ${unused.join(", ")}`);
  if (overloadedCount > 0)
    parts.push(`Overloaded teachers (≥5 duties): ${overloadedCount}`);
  return parts.join("\n");
}

async function buildClassRolesContext(
  schoolId: mongoose.Types.ObjectId,
  periodId: mongoose.Types.ObjectId | null,
  periodLabel: string
): Promise<string> {
  const [defs, assignments] = await Promise.all([
    ClassRoleDefinition.find({ schoolId, isActive: true })
      .select("_id name code maxPerClass category")
      .lean(),
    periodId
      ? StudentClassRole.find({
          schoolId,
          academicPeriodId: periodId,
          isActive: true,
        })
          .select("roleDefinitionId classGroupId")
          .lean()
      : [],
  ]);

  const assignByRole = new Map<string, Map<string, number>>();
  for (const a of assignments) {
    const rid = String(a.roleDefinitionId);
    const cid = String(a.classGroupId);
    if (!assignByRole.has(rid)) assignByRole.set(rid, new Map());
    const classMap = assignByRole.get(rid)!;
    classMap.set(cid, (classMap.get(cid) ?? 0) + 1);
  }

  const overCap: string[] = [];
  const unused: string[] = [];
  const roleLines: string[] = [];

  for (const r of defs) {
    const rid = String(r._id);
    const classCounts = assignByRole.get(rid);
    const totalAssignments = classCounts
      ? [...classCounts.values()].reduce((s, c) => s + c, 0)
      : 0;
    const max = r.maxPerClass ?? null;
    const classesOver =
      max != null && classCounts
        ? [...classCounts.values()].filter((c) => c > max).length
        : 0;
    const status =
      max != null
        ? `${totalAssignments} total, ${classesOver} classes over max ${max}`
        : `${totalAssignments}`;
    roleLines.push(`${r.name}(${r.code}): ${status}`);
    if (classesOver > 0) overCap.push(r.name);
    if (totalAssignments === 0) unused.push(r.name);
  }

  const parts: string[] = [
    `[Class Roles] Period: ${periodLabel}`,
    `Definitions: ${defs.length} | Assignments: ${assignments.length}`,
    `Roles: ${roleLines.join("; ")}`,
  ];
  if (overCap.length) parts.push(`Over-capacity (by class): ${overCap.join(", ")}`);
  if (unused.length) parts.push(`Unused: ${unused.join(", ")}`);
  return parts.join("\n");
}
