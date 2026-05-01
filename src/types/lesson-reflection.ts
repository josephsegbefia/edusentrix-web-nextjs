import type { LessonObjectivesMet } from "@/models/LessonReflection";

export type LessonReflectionDto = {
  id: string;
  lessonId: string;
  completed: boolean;
  objectivesMet: LessonObjectivesMet;
  notes: string | null;
  studentsWhoStruggled: string[];
  followUpRequired: boolean;
  followUpNotes: string | null;
  nextStep: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type TeacherLessonReflectionResponse = {
  success: boolean;
  data: { reflection: LessonReflectionDto | null };
  error?: string;
};

export type LessonReflectionUpsertPayload = {
  completed?: boolean;
  objectivesMet?: LessonObjectivesMet;
  notes?: string | null;
  studentsWhoStruggled?: string[];
  followUpRequired?: boolean;
  followUpNotes?: string | null;
  nextStep?: string | null;
};
