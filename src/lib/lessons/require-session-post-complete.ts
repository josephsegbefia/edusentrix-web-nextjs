import "server-only";

import type mongoose from "mongoose";
import { LessonSession } from "@/models/LessonSession";
import { LessonDelivery } from "@/models/LessonDelivery";
import { loadLessonSessionForTeacher } from "@/lib/lessons/load-lesson-session";
import { canManageLessonSessionContent } from "@/lib/lessons/session-access";

export async function requireSessionPostCompleteForTeacher(input: {
  sessionId: mongoose.Types.ObjectId;
  schoolId: mongoose.Types.ObjectId;
  teacherId: mongoose.Types.ObjectId;
  isAdmin?: boolean;
  requireManageContent?: boolean;
}) {
  const loaded = await loadLessonSessionForTeacher({
    sessionId: input.sessionId,
    schoolId: input.schoolId,
    teacherId: input.teacherId,
    isAdmin: input.isAdmin,
  });

  if (loaded.kind === "not_found") {
    return { error: Response.json({ success: false, error: "Session not found" }, { status: 404 }) };
  }
  if (loaded.kind === "forbidden") {
    return { error: Response.json({ success: false, error: "Forbidden" }, { status: 403 }) };
  }

  if (
    input.requireManageContent &&
    !canManageLessonSessionContent({
      session: loaded.session,
      teacherId: input.teacherId,
      isAdmin: input.isAdmin,
    })
  ) {
    return { error: Response.json({ success: false, error: "Forbidden" }, { status: 403 }) };
  }

  if (!loaded.delivery) {
    return {
      error: Response.json({ success: false, error: "Delivery not found" }, { status: 404 }),
    };
  }

  if (loaded.delivery.status !== "completed") {
    return {
      error: Response.json(
        {
          success: false,
          error: "Create homework and practice tasks after you mark this session complete.",
        },
        { status: 400 },
      ),
    };
  }

  const session = await LessonSession.findById(loaded.session._id);
  const delivery = await LessonDelivery.findById(loaded.delivery._id);

  if (!session || !delivery) {
    return { error: Response.json({ success: false, error: "Session not found" }, { status: 404 }) };
  }

  return { session, delivery };
}
