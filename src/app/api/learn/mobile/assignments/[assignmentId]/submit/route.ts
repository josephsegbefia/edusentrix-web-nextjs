import { NextRequest } from "next/server";
import { z } from "zod";
import { requireLearnMobileStudent } from "@/lib/learn/mobile-auth";
import { submitMobileAssignment } from "@/lib/learn/mobile-assignments";
import { mobileApiFailure, mobileApiSuccess } from "@/lib/learn/mobile-api-response";

const BodySchema = z.object({
  answerText: z.string().optional(),
  completedChecklistItemIds: z.array(z.string()).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ assignmentId: string }> }
) {
  try {
    const auth = await requireLearnMobileStudent(request);
    if (!auth.ok) return auth.response;

    const body = BodySchema.parse(await request.json());
    const { assignmentId } = await params;

    const result = await submitMobileAssignment(
      auth.context,
      decodeURIComponent(assignmentId),
      body
    );

    if (!result.ok) {
      return mobileApiFailure({
        code: result.code,
        message: result.message,
        status: result.status,
      });
    }

    return mobileApiSuccess(result.data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return mobileApiFailure({
        code: "VALIDATION_ERROR",
        message: "Invalid submission.",
        status: 400,
      });
    }
    console.error("[learn/mobile/assignments/submit]", error);
    return mobileApiFailure({ code: "UNKNOWN_ERROR", message: "Submit failed.", status: 500 });
  }
}
