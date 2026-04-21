import { NextResponse } from "next/server";
import OpenAI from "openai";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { getSchoolSetupReadiness } from "@/lib/admin/school-setup-readiness";

/**
 * POST /api/admin/setup-readiness/coach
 * Richer Leo coaching copy from the current checklist (optional OpenAI).
 */
export async function POST() {
  try {
    const { schoolId } = await requireSchoolAdmin();
    const readiness = await getSchoolSetupReadiness(schoolId);
    const incomplete = readiness.items.filter((i) => !i.done);

    if (incomplete.length === 0) {
      return NextResponse.json({
        success: true,
        coachMessage: readiness.coachMessage,
        fallback: false,
      });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({
        success: true,
        coachMessage: readiness.coachMessage,
        fallback: true,
      });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const payload = {
      incomplete: incomplete.map((i) => ({
        title: i.title,
        description: i.description,
        priority: i.priority,
        ctaLabel: i.ctaLabel,
      })),
      baselineHint: readiness.coachMessage,
    };

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.4,
      messages: [
        {
          role: "system",
          content: `You are Leo, a concise assistant for Ghanaian school administrators using EduSentrix.
The user sees a post-launch setup checklist. Reply with 2–4 short paragraphs or bullet sentences in plain language.
Prioritize "blocking" and "high" items. Be encouraging, specific, and mention what to do next (not generic platitudes).
Do not invent school data beyond what is provided. No markdown headings.`,
        },
        {
          role: "user",
          content: JSON.stringify(payload),
        },
      ],
    });

    const text = completion.choices[0]?.message?.content?.trim();
    if (!text) {
      return NextResponse.json({
        success: true,
        coachMessage: readiness.coachMessage,
        fallback: true,
      });
    }

    return NextResponse.json({
      success: true,
      coachMessage: text,
      fallback: false,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Coach request failed";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
