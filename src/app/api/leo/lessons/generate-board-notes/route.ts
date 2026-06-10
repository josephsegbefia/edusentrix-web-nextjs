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

    const systemPrompt = `You are Leo, an expert educator assistant for Ghanaian schools. Generate NOTES FOR STUDENTS' NOTEBOOKS — structured revision notes the teacher can write on the board and students copy into their exercise books.

IMPORTANT RULES:
- Write only what students will copy. No teacher directions, no "explain to the class", no meta commentary.
- Language must be grade-appropriate (${gradeName || "the class level"}) — clear, direct, and concise enough to copy quickly.
- Cover the session's teachable content: definitions, key facts, worked examples (with steps), and a short summary.
- Prefer short sections students can scan: "Definition", "Key facts", "Worked example", "Steps", "Remember".
- Use numbered lists and bullets; avoid long paragraphs. One idea per line where possible.
- Format as HTML only: <h3> section headings, <ol>/<ul>/<li>, <p>, <strong> for key terms. No CSS or inline styles.
- Minimum 350 words of student-facing content — enough for 1–2 exercise-book pages.
- Be factually accurate. Use only the provided lesson material.
- End with <h3>Summary</h3> and 3–5 bullet points of what they learned.
- Output valid JSON only. No markdown, no code fences.

${LESSONS_LEO_DISCLAIMER}`;

    const userPrompt = `Generate notebook notes for this lesson session.

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
