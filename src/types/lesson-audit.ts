import type { LessonAuditAction } from "@/models/LessonAuditLog";

export type AdminLessonAuditRow = {
  id: string;
  lessonId: string;
  actorId: string;
  /** When loaded with actor enrichment (admin API default). */
  actorLabel?: string;
  action: LessonAuditAction;
  metadata: Record<string, unknown>;
  createdAt: string;
};
