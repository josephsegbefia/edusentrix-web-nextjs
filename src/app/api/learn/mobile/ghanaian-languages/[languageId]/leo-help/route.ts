import { NextRequest } from "next/server";
import { z } from "zod";
import { requireLearnMobileStudent } from "@/lib/learn/mobile-auth";
import { buildMobileGhanaianLeoHelp } from "@/lib/learn/mobile-ghanaian-languages";
import { mobileApiFailure, mobileApiSuccess } from "@/lib/learn/mobile-api-response";

const BodySchema = z.object({
  message: z.string().trim().optional(),
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

    const result = await buildMobileGhanaianLeoHelp(
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
      return mobileApiFailure({ code: "VALIDATION_ERROR", message: "Invalid request.", status: 400 });
    }
    console.error("[learn/mobile/ghanaian-languages/leo-help]", error);
    return mobileApiFailure({ code: "UNKNOWN_ERROR", message: "Leo help failed.", status: 500 });
  }
}
