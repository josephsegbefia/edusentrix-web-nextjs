import "server-only";

import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { can } from "@/lib/auth/can";
import { PERMISSIONS } from "@/lib/rbac";
import { LessonSession } from "@/models/LessonSession";
import { LessonDelivery } from "@/models/LessonDelivery";
import { gateLessonsFeature, gateLessonsModule } from "@/lib/lessons/lesson-gates";
import { canTeachLessonSession } from "@/lib/lessons/session-access";

function toObjectId(id: string): mongoose.Types.ObjectId | null {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

export async function requireSessionTeachContext(
  sessionId: string,
  classGroupId?: string | null,
) {
  const context = await requireTeacher();
  await connectToDatabase();

  const moduleGate = await gateLessonsModule(context.schoolId);
  if (!moduleGate.ok) {
    return { error: Response.json({ success: false, error: moduleGate.error }, { status: moduleGate.status }) };
  }

  const teachingGate = gateLessonsFeature(
    moduleGate.settings,
    "enableTeachingMode",
    "Teaching mode",
  );
  if (!teachingGate.ok) {
    return { error: Response.json({ success: false, error: teachingGate.error }, { status: teachingGate.status }) };
  }

  if (!can(context.permissions, PERMISSIONS.lessonsRead)) {
    return { error: Response.json({ success: false, error: "Forbidden" }, { status: 403 }) };
  }

  const sessionOid = toObjectId(sessionId);
  if (!sessionOid) {
    return { error: Response.json({ success: false, error: "Invalid session ID" }, { status: 400 }) };
  }

  const session = await LessonSession.findOne({
    _id: sessionOid,
    schoolId: context.schoolId,
  });

  if (!session) {
    return { error: Response.json({ success: false, error: "Session not found" }, { status: 404 }) };
  }

  const classGroupOid = classGroupId ? toObjectId(classGroupId) : null;
  const deliveries = await LessonDelivery.find({
    sessionId: session._id,
    schoolId: context.schoolId,
  });

  const delivery =
    (classGroupOid
      ? deliveries.find((d) => String(d.classGroupId) === String(classGroupOid))
      : null) ??
    deliveries.find((d) => String(d.classGroupId) === String(session.classGroupId)) ??
    deliveries[0] ??
    null;

  if (!delivery) {
    return { error: Response.json({ success: false, error: "Delivery not found" }, { status: 404 }) };
  }

  if (
    !canTeachLessonSession({
      session,
      delivery,
      teacherId: context.teacherId,
      isAdmin: context.isAdmin,
    })
  ) {
    return { error: Response.json({ success: false, error: "Forbidden" }, { status: 403 }) };
  }

  return {
    context,
    session,
    delivery,
    settings: moduleGate.settings,
    canManageTeaching: can(context.permissions, PERMISSIONS.lessonTeachingModeManage),
  };
}
