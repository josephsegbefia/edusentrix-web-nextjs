import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";

const BodySchema = z.object({
  context: z.enum(["scope", "groups"]),
  scope: z.enum(["unified", "grouped"]).nullable(),
  gradeCount: z.number().int().min(0),
  groupCount: z.number().int().min(0),
});

function fallbackText(
  context: "scope" | "groups",
  scope: "unified" | "grouped" | null,
  gradeCount: number,
  groupCount: number
): string {
  if (context === "scope") {
    if (scope === "unified") {
      return "One school-wide schedule is simplest when bell times, breaks, and teaching periods match across grades. You can still tweak specific grades inside the editor if a band needs a slightly different start.";
    }
    if (scope === "grouped") {
      return "Grouped schedules fit schools where nursery or primary runs shorter days than JHS, or where staggered arrivals reduce congestion. Each group gets its own day template; classes pick up the schedule for their grade.";
    }
    return `You have ${gradeCount} grade(s). If everyone follows the same bells and period count, choose one schedule. If bands differ, create groups and assign every active grade to exactly one group — solo groups are fine.`;
  }
  if (groupCount <= 0) {
    return "Add at least one group, then drag each grade into a single group. Unassigned grades cannot save until every grade belongs somewhere.";
  }
  return `You’re splitting ${gradeCount} grade(s) across ${groupCount} group(s). Name bands clearly (for example “Lower primary”, “Upper primary”) so staff recognize them. Each group must include at least one grade, and no grade can appear in two groups.`;
}

export async function POST(req: NextRequest) {
  try {
    await requireSchoolAdmin();
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Invalid coach request." },
        { status: 400 }
      );
    }
    const { context, scope, gradeCount, groupCount } = parsed.data;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        success: true,
        data: { text: fallbackText(context, scope, gradeCount, groupCount) },
      });
    }

    const openai = new OpenAI({ apiKey });
    const model = process.env.OPENAI_TIMETABLE_COACH_MODEL || "gpt-4o-mini";

    const userPrompt =
      context === "scope"
        ? `School administrator is choosing how daily schedules work. They have ${gradeCount} grades configured.
Current selection: ${scope === null ? "not chosen yet" : scope === "unified" ? "one schedule for all grades" : "different schedules per grade group"}.

Reply with EXACTLY one short paragraph (2–4 sentences). Explain when unified vs grouped fits and remind that timetables resolve by class → grade → schedule. No bullets.`
        : `They are assigning grades to schedule groups. ${gradeCount} grades, ${groupCount} groups so far.

Reply with EXACTLY one short paragraph (2–4 sentences). Advise clear group naming, full assignment of grades, and that mixed-grade class groups are not used — grouping is by grade. No bullets.`;

    const completion = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content:
            "You are Leo, a concise assistant for school schedule setup in Edusentrix. Practical tone. No markdown.",
        },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.35,
      max_tokens: 220,
    });

    const text =
      completion.choices[0]?.message?.content?.trim() ||
      fallbackText(context, scope, gradeCount, groupCount);

    return NextResponse.json({ success: true, data: { text } });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("school-daily-schedule leo-coach error:", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Leo coach failed" },
      { status: 500 }
    );
  }
}
