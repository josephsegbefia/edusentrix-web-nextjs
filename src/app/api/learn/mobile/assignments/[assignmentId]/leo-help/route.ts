import { NextRequest } from "next/server";
import { z } from "zod";
import { requireLearnMobileStudent } from "@/lib/learn/mobile-auth";
import {
  buildLeoHelpResponse,
  buildMobileAssignmentDetail,
} from "@/lib/learn/mobile-assignments";
import { recordLearnMobileActivity } from "@/lib/learn/mobile-activity";
import { mobileApiFailure, mobileApiSuccess } from "@/lib/learn/mobile-api-response";

const BodySchema = z.object({
  message: z.string().trim().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ assignmentId: string }> }
) {
  try {
    const auth = await requireLearnMobileStudent(request);
    if (!auth.ok) return auth.response;

    BodySchema.parse(await request.json().catch(() => ({})));
    const { assignmentId } = await params;

    const detail = await buildMobileAssignmentDetail(
      auth.context,
      decodeURIComponent(assignmentId)
    );

    if (!detail.ok) {
      return mobileApiFailure({
        code: detail.code,
        message: detail.message,
        status: detail.status,
      });
    }

    await recordLearnMobileActivity({
      schoolId: auth.context.schoolId,
      studentId: auth.context.studentId,
      accountId: auth.context.accountId,
      gradeId: auth.context.gradeId,
      classGroupId: auth.context.classGroupId,
      eventType: "assignment_help",
      topic: detail.data.title,
      metadata: { assignmentId },
    });

    return mobileApiSuccess(buildLeoHelpResponse(detail.data.title));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return mobileApiFailure({ code: "VALIDATION_ERROR", message: "Invalid request.", status: 400 });
    }
    console.error("[learn/mobile/assignments/leo-help]", error);
    return mobileApiFailure({ code: "UNKNOWN_ERROR", message: "Leo help failed.", status: 500 });
  }
}
