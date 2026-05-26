import { z } from "zod";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import {
  LESSONS_LEO_DISCLAIMER,
  lessonNoteTeachingMetadata,
  requireLessonsLeoTeacherContext,
  runLessonsLeoCompletion,
} from "@/lib/leo/lessons-draft-shared";
import { LessonSession } from "@/models/LessonSession";
import { LessonNote } from "@/models/LessonNote";

function toObjectId(id: string): mongoose.Types.ObjectId | null {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

const BodySchema = z.object({
  sessionId: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const context = await requireLessonsLeoTeacherContext();
    if (context instanceof Response) return context;

    await connectToDatabase();

    const raw = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join(", ") || "Invalid body";
      return Response.json({ success: false, error: msg }, { status: 400 });
    }

    const sessionId = toObjectId(parsed.data.sessionId);
    if (!sessionId) {
      return Response.json({ success: false, error: "Invalid session ID" }, { status: 400 });
    }

    const session = await LessonSession.findOne({
      _id: sessionId,
      schoolId: context.schoolId,
    }).lean();

    if (!session) {
      return Response.json({ success: false, error: "Session not found" }, { status: 404 });
    }

    if (!session.contentBlocks || session.contentBlocks.length === 0) {
      return Response.json(
        { success: false, error: "Session has no content blocks. Generate session content first." },
        { status: 400 },
      );
    }

    // Load lesson note for topic/strand context
    const note = await LessonNote.findById(session.lessonNoteId).lean();

    // Load grade/subject info using the shared metadata helper
    const teachingMeta = note ? await lessonNoteTeachingMetadata(note) : {};
    const gradeName = (teachingMeta.gradeName as string) ?? "";
    const subjectName = (teachingMeta.subjectName as string) ?? "";
    const strand = note?.curriculum?.strand ?? "";
    const subStrand = note?.curriculum?.subStrand ?? "";

    const contentSummary = session.contentBlocks
      .filter((b) => b.type !== "teacher_note" && b.type !== "did_you_know")
      .slice(0, 14)
      .map(
        (b, i) =>
          `[${i + 1}] ${b.type.toUpperCase()} — ${b.title ?? "(untitled)"}: ${b.bodyHtml.replace(/<[^>]*>/g, "").substring(0, 400)}`,
      )
      .join("\n\n");

    const systemPrompt = `You are Leo, an expert educator assistant for Ghanaian schools. Your job is to generate BOARD NOTES — clear, structured notes for the teacher to dictate or write on the blackboard so students can copy them into their exercise books.

IMPORTANT RULES:
- These notes are for students to COPY into their exercise books — they must be clear, well-structured, and complete.
- Language must be grade-appropriate (${gradeName || "the class level"}) — simple, direct, and safe.
- Cover the full lesson content: definitions, key facts, worked examples, key steps, and summary points.
- Use numbered lists, subheadings (e.g. "Definition:", "Key Facts:", "Worked Example:", "Steps:", "Remember:"), and short bullet points that students can write quickly.
- Do NOT include teacher instructions or meta-text like "tell students" or "explain this". Write only what students will copy.
- Format as structured HTML: use <h3> for section headings, <ol>/<ul>/<li> for lists, <p> for paragraphs, <strong> for key terms. No CSS or inline styles.
- Minimum 400 words of student-facing content. Enough to fill 1–2 pages in an exercise book.
- Be factually accurate. Only use content from the provided lesson material.
- End with a "Summary / What You Learned" section of 3–5 bullet points.
- Output valid JSON only. No markdown, no code fences.

${LESSONS_LEO_DISCLAIMER}`;

    const userPrompt = `Generate comprehensive board notes for this lesson session.

**Session title:** ${session.title}
**Subject/Grade:** ${subjectName} | ${gradeName}
**Topic:** ${strand ? `${strand}${subStrand ? ` — ${subStrand}` : ""}` : note?.topic ?? ""}
**Duration:** ${session.durationMinutes} minutes

**Lesson content blocks:**
${contentSummary}

Return JSON in this exact shape:
{
  "boardNotes": {
    "contentHtml": "<h3>...</h3>...",
    "sectionCount": 4
  }
}

The contentHtml must be thorough, structured, and suitable for students to copy into their exercise books.`;

    const result = await runLessonsLeoCompletion({
      context,
      systemInstruction: systemPrompt,
      userPrompt,
      maxTokens: 4000,
      model: "gpt-4o",
    });

    if (!result.ok) {
      return Response.json({ success: false, error: result.error }, { status: 502 });
    }

    const parsed2 = result.data as {
      boardNotes?: {
        contentHtml?: string;
        sectionCount?: number;
      };
    };

    if (!parsed2.boardNotes?.contentHtml || typeof parsed2.boardNotes.contentHtml !== "string") {
      return Response.json(
        { success: false, error: "Leo returned an unexpected format. Please try again." },
        { status: 422 },
      );
    }

    const contentHtml = parsed2.boardNotes.contentHtml.trim();
    if (contentHtml.length < 200) {
      return Response.json(
        { success: false, error: "Generated board notes were too short. Please try again." },
        { status: 422 },
      );
    }

    return Response.json({
      success: true,
      data: {
        boardNotes: {
          contentHtml,
          generatedAt: new Date().toISOString(),
          aiGenerated: true,
        },
      },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("[generate-board-notes]", e);
    const message = e instanceof Error ? e.message : "Board notes generation failed";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
