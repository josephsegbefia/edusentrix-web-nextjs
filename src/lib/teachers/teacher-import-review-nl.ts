/** Route facade for the bounded, confirm-before-apply teacher relationship interpreter. */
import type { ITeacherImportJob } from "@/models/TeacherImportJob";
import { confirmTeacherRelationshipPlan, interpretTeacherRelationshipInstruction, type TeacherRelationshipInterpreterDependencies } from "@/lib/teachers/teacher-relationship-plan";

export function interpretTeacherImportReviewInstruction(input: {
  job: ITeacherImportJob; issueId: string; instructionText: string; submittedBy: string;
}, dependencies?: TeacherRelationshipInterpreterDependencies) {
  return interpretTeacherRelationshipInstruction(input, dependencies);
}

export function confirmTeacherImportReviewInstruction(input: {
  job: ITeacherImportJob; instructionId: string; confirmedBy: string;
}) {
  return confirmTeacherRelationshipPlan({ job: input.job, proposalId: input.instructionId, confirmedBy: input.confirmedBy });
}
