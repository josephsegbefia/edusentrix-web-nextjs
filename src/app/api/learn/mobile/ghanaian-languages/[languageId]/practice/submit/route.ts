import { NextRequest } from "next/server";
import { z } from "zod";
import { requireLearnMobileStudent } from "@/lib/learn/mobile-auth";
import { submitMobileGhanaianPractice } from "@/lib/learn/mobile-ghanaian-languages";
import { mobileApiFailure, mobileApiSuccess } from "@/lib/learn/mobile-api-response";

const BodySchema = z.object({
  answers: z
    .array(
      z.object({
        itemId: z.string(),
        response: z.string(),
      })
    )
    .optional(),
  elapsedMinutes: z.number().int().min(1).max(60).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ languageId: string }> }
) {
  try {
    const auth = await requireLearnMobileStudent(request);
    if (!auth.ok) return auth.response;

    const body = BodySchema.parse(await request.json().catch(() => ({})));
    const { languageId } = await params;

    const result = await submitMobileGhanaianPractice(
      auth.context,
      decodeURIComponent(languageId),
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
        message: "Invalid practice submission.",
        status: 400,
      });
    }
    console.error("[learn/mobile/ghanaian-languages/submit]", error);
    return mobileApiFailure({ code: "UNKNOWN_ERROR", message: "Submit failed.", status: 500 });
  }
}
