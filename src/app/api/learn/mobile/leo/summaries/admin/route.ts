import { NextRequest } from "next/server";
import { z } from "zod";
import { requireLearnMobileStudent } from "@/lib/learn/mobile-auth";
import { getMobileLeoUsageSummary } from "@/lib/learn/mobile-leo-summaries";
import { mobileApiFailure, mobileApiSuccess } from "@/lib/learn/mobile-api-response";

const QuerySchema = z.object({
  periodDays: z.coerce.number().int().min(1).max(90).optional(),
});

/** Student-scoped admin-style usage stats until dedicated admin auth is wired for Learn mobile. */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireLearnMobileStudent(request);
    if (!auth.ok) return auth.response;

    const query = QuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    const data = await getMobileLeoUsageSummary({
      context: auth.context,
      audience: "admin",
      periodDays: query.periodDays,
    });

    return mobileApiSuccess(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return mobileApiFailure({ code: "VALIDATION_ERROR", message: "Invalid query.", status: 400 });
    }
    console.error("[learn/mobile/leo/summaries/admin]", error);
    return mobileApiFailure({ code: "UNKNOWN_ERROR", message: "Summary failed.", status: 500 });
  }
}
