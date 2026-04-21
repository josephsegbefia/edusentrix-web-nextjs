/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";
import mongoose from "mongoose";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Grade } from "@/models/Grade";
import { Subject } from "@/models/Subject";
import { ClassGroup } from "@/models/ClassGroup";
import { formatClassGroupLabel } from "@/lib/utils/formatClassGroupLabel";

const BodySchema = z.object({
  hint: z.string().trim().min(3).max(2000),
});

function norm(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Compare labels with spaces ignored: "jhs 2" ≈ "jhs2" */
function compactNorm(s: string) {
  return norm(s).replace(/\s+/g, "");
}

function bestSubjectMatch(
  name: string,
  subjectByNorm: Map<string, { id: string; name: string }>
): { id: string; name: string } | null {
  const n = norm(name);
  if (subjectByNorm.has(n)) return subjectByNorm.get(n)!;
  const c = compactNorm(name);
  for (const [k, v] of subjectByNorm) {
    if (compactNorm(k) === c) return v;
  }
  for (const [k, v] of subjectByNorm) {
    if (k.includes(n) || n.includes(k)) return v;
  }
  // "math" → "mathematics"
  if (c.length >= 3) {
    for (const [k, v] of subjectByNorm) {
      if (compactNorm(k).startsWith(c) || c.startsWith(compactNorm(k))) return v;
    }
  }
  // Informal names → official catalogue
  if (c === "math" || c === "maths") {
    for (const [, v] of subjectByNorm) {
      const kn = compactNorm(v.name);
      if (kn.includes("math")) return v;
    }
  }
  if (c === "science" || c === "sci") {
    for (const [, v] of subjectByNorm) {
      const kn = compactNorm(v.name);
      if (kn.includes("science")) return v;
    }
  }
  if (c === "english" || c === "eng") {
    for (const [, v] of subjectByNorm) {
      if (compactNorm(v.name).includes("english")) return v;
    }
  }
  return null;
}

function bestGradeMatch(
  name: string,
  gradeByNorm: Map<string, { id: string; name: string }>
): { id: string; name: string } | null {
  const n = norm(name);
  if (gradeByNorm.has(n)) return gradeByNorm.get(n)!;
  const c = compactNorm(name);
  for (const [k, v] of gradeByNorm) {
    if (compactNorm(k) === c) return v;
  }
  for (const [k, v] of gradeByNorm) {
    if (k.includes(n) || n.includes(k)) return v;
  }
  return null;
}

/**
 * Match a class group within a grade. School data often stores full names
 * ("JHS 2 A") while the model returns stream only ("A") or fused ("JHS2A").
 */
function findClassGroupForGrade(
  gr: { id: string; name: string },
  streamRaw: string,
  classGroups: any[]
): any | null {
  const streamN = norm(streamRaw);
  const gradeN = norm(gr.name);
  const gCompact = compactNorm(gr.name);
  const sCompact = compactNorm(streamRaw);

  const candidates = classGroups.filter((c) => {
    const gid = c.gradeId?._id ? String(c.gradeId._id) : String(c.gradeId);
    return gid === gr.id;
  });
  if (candidates.length === 0) return null;

  // 1. Exact name match (stream is full class group name)
  let hit = candidates.find((c) => norm(c.name) === streamN);
  if (hit) return hit;

  // 2. "Grade Stream" e.g. jhs 2 + a → jhs 2 a
  hit = candidates.find((c) => norm(c.name) === `${gradeN} ${streamN}`);
  if (hit) return hit;

  // 3. No space between grade and stream: JHS2A
  hit = candidates.find((c) => compactNorm(c.name) === gCompact + sCompact);
  if (hit) return hit;

  // 4. Class name starts with grade; remainder is stream (most common)
  for (const c of candidates) {
    const cn = norm(c.name);
    if (cn.startsWith(`${gradeN} `)) {
      const rest = cn.slice(gradeN.length + 1).trim();
      if (rest === streamN) return c;
    }
    // Tighter prefix: "jhs2 " vs grade "jhs 2"
    if (cn.startsWith(gCompact) && cn.length > gCompact.length) {
      const rest = cn.slice(gCompact.length).trim().replace(/^[\s\-–—]+/, "");
      if (rest === streamN || norm(rest) === streamN) return c;
    }
  }

  // 5. Last token equals stream (e.g. name "JHS 2 A", stream "A")
  if (streamN.length <= 8) {
    hit = candidates.find((c) => {
      const cn = norm(c.name);
      const parts = cn.split(/\s+/).filter(Boolean);
      const last = parts[parts.length - 1] ?? "";
      return last === streamN;
    });
    if (hit) return hit;
  }

  // 6. Stream letter only: single-character or "stream a" style
  if (/^[a-z0-9]{1,3}$/i.test(streamRaw.trim())) {
    hit = candidates.find((c) => {
      const cn = norm(c.name);
      return cn.endsWith(` ${streamN}`) || cn === `${gradeN} ${streamN}`;
    });
    if (hit) return hit;
  }

  return null;
}

export async function POST(req: NextRequest) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    await connectToDatabase();
    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));

    const json = await req.json();
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Describe what they teach in a few words (3–2000 characters).",
        },
        { status: 400 }
      );
    }
    const { hint } = parsed.data;

    const [grades, subjects, classGroups] = await Promise.all([
      Grade.find({ schoolId: schoolIdObj, isActive: true })
        .select("_id name")
        .sort({ order: 1, name: 1 })
        .lean(),
      Subject.find({ schoolId: schoolIdObj, isActive: true })
        .select("_id name")
        .sort({ name: 1 })
        .lean(),
      ClassGroup.find({ schoolId: schoolIdObj, isActive: true })
        .select("_id name gradeId")
        .populate({ path: "gradeId", select: "name", model: Grade })
        .lean(),
    ]);

    if (!subjects.length || !grades.length || !classGroups.length) {
      return NextResponse.json({
        success: true,
        confirmationText: null as string | null,
        leoSummary:
          "Add active grades, class groups, and subjects first—then I can map your description to real classes.",
        suggestions: [] as Array<{
          subjectId: string;
          classGroupId: string;
          gradeId: string;
          label: string;
        }>,
        unmatched: [] as string[],
        fallback: true,
      });
    }

    const ctx = {
      grades: grades.map((g: any) => ({ id: String(g._id), name: g.name })),
      subjects: subjects.map((s: any) => ({ id: String(s._id), name: s.name })),
      classGroups: (classGroups as any[]).map((cg) => ({
        id: String(cg._id),
        stream: cg.name,
        gradeName: cg.gradeId?.name ? String(cg.gradeId.name) : "",
      })),
    };

    let leoSummary =
      "I parsed your note and matched it to your school’s subjects and classes where possible.";

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({
        success: true,
        confirmationText: null as string | null,
        leoSummary:
          "OpenAI isn’t configured, so I can’t interpret free text yet. Add OPENAI_API_KEY to your environment, or pick subject, grade, and class manually.",
        suggestions: [],
        unmatched: [],
        fallback: true,
      });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.35,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are Leo, assisting a Ghanaian school admin. The user describes what a teacher teaches (often informal: "Math in JHS 2A and B", "Science in JHS 1", "P4 A and B").

Return ONLY valid JSON with this shape:
{
  "confirmationText": string,
  "leoSummary": string,
  "assignments": [ { "subject": string, "grade": string, "stream": string } ]
}

confirmationText (required): One clear sentence the admin can confirm, e.g. "This teacher will be assigned to Mathematics in JHS 2 streams A and B, and Science in JHS 1 streams A, B, and C." Use the user’s wording where it helps; be explicit about each subject and grade/stream.

leoSummary: Brief note on anything you assumed (e.g. expanded "Science in JHS 1" to all streams listed in context).

assignments rules:
- "grade": use the closest grade NAME from context (e.g. "JHS 2", "JHS 1", "Primary 6"). Shorthand like "JHS2" or "jhs 2" should map to the real grade name from context.
- "stream": prefer the stream letter or suffix only: "A", "B", "C", "1", "Rose". If the user writes "JHS2A" or "2A", output grade "JHS 2" and stream "A".
- "subject": match a subject from context; treat Math/Mathematics, Science/Integrated Science as the same if only one exists.
- Expand lists: "A and B" → two rows; "2A and B" under JHS 2 → streams A and B for that grade.
- If the user names a grade and subject but NO streams (e.g. "Science in JHS 1"), output one assignment row per class group in context for that grade (every stream).
- If a grade/subject in the text cannot be matched to context, omit those rows (do not invent).
- Never invent class group IDs; only describe grade/stream so the server can match names.`,
        },
        {
          role: "user",
          content: JSON.stringify({ hint, context: ctx }),
        },
      ],
    });

    const text = completion.choices[0]?.message?.content;
    if (!text) {
      return NextResponse.json(
        { success: false, error: "Leo returned an empty response" },
        { status: 502 }
      );
    }

    let data: {
      leoSummary?: string;
      confirmationText?: string;
      assignments?: unknown;
    };
    try {
      data = JSON.parse(text);
    } catch {
      return NextResponse.json(
        { success: false, error: "Leo returned invalid JSON" },
        { status: 502 }
      );
    }

    if (typeof data.leoSummary === "string" && data.leoSummary.trim()) {
      leoSummary = data.leoSummary.trim();
    }

    let confirmationText =
      typeof data.confirmationText === "string"
        ? data.confirmationText.trim()
        : "";

    const arr = Array.isArray(data.assignments) ? data.assignments : [];

    const gradeByNorm = new Map<string, { id: string; name: string }>();
    for (const g of grades as any[]) {
      gradeByNorm.set(norm(g.name), {
        id: String(g._id),
        name: String(g.name),
      });
    }

    const subjectByNorm = new Map<string, { id: string; name: string }>();
    for (const s of subjects as any[]) {
      subjectByNorm.set(norm(s.name), {
        id: String(s._id),
        name: String(s.name),
      });
    }

    const suggestions: Array<{
      subjectId: string;
      classGroupId: string;
      gradeId: string;
      label: string;
    }> = [];
    const unmatched: string[] = [];

    for (const row of arr) {
      const subjectStr = typeof row?.subject === "string" ? row.subject : "";
      const gradeStr = typeof row?.grade === "string" ? row.grade : "";
      const streamStr = typeof row?.stream === "string" ? row.stream : "";
      if (!subjectStr || !gradeStr || !streamStr) continue;

      const subj = bestSubjectMatch(subjectStr, subjectByNorm);
      if (!subj) {
        unmatched.push(`Subject “${subjectStr}”`);
        continue;
      }

      const gr = bestGradeMatch(gradeStr, gradeByNorm);
      if (!gr) {
        unmatched.push(`Grade “${gradeStr}”`);
        continue;
      }

      const cg = findClassGroupForGrade(gr, streamStr, classGroups as any[]);

      if (!cg) {
        unmatched.push(`${gr.name} stream “${streamStr}”`);
        continue;
      }

      const label = `${subj.name} · ${formatClassGroupLabel(gr.name, String(cg.name))}`;
      suggestions.push({
        subjectId: subj.id,
        classGroupId: String(cg._id),
        gradeId: gr.id,
        label,
      });
    }

    const seen = new Set<string>();
    const deduped = suggestions.filter((s) => {
      const k = `${s.subjectId}|${s.classGroupId}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    if (!confirmationText && deduped.length > 0) {
      confirmationText = `This teacher will be assigned to ${deduped
        .map((s) => s.label.replace(" · ", " in "))
        .join("; ")}.`;
    }
    if (!confirmationText) {
      confirmationText = leoSummary;
    }

    return NextResponse.json({
      success: true,
      leoSummary,
      confirmationText,
      suggestions: deduped,
      unmatched: [...new Set(unmatched)],
      fallback: false,
    });
  } catch (e: unknown) {
    console.error("leo-suggest-assignments", e);
    const message = e instanceof Error ? e.message : "Failed";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
