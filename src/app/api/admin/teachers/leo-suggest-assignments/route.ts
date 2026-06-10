/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";
import mongoose from "mongoose";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Grade } from "@/models/Grade";
import { SubjectOffering } from "@/models/SubjectOffering";
import { ClassGroup } from "@/models/ClassGroup";
import { formatClassGroupLabel } from "@/lib/utils/formatClassGroupLabel";
import {
  bestGradeMatch,
  bestOfferingForGrade,
  buildConfirmationText,
  buildGradeStreamConstraints,
  expandAllStreamAssignments,
  rowMatchesStreamConstraint,
  tryDeterministicAssignments,
  type OfferingMatchLite,
} from "@/lib/leo/parse-teacher-assignment-hint";

const BodySchema = z.object({
  hint: z.string().trim().min(3).max(2000),
});

function classGroupGradeId(cg: any): string {
  return cg.gradeId?._id ? String(cg.gradeId._id) : String(cg.gradeId);
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
  const streamN = streamRaw.trim().toLowerCase().replace(/\s+/g, " ");
  const gradeN = gr.name.trim().toLowerCase().replace(/\s+/g, " ");
  const gCompact = gradeN.replace(/\s+/g, "");
  const sCompact = streamRaw.trim().toLowerCase().replace(/\s+/g, "");

  const candidates = classGroups.filter((c) => classGroupGradeId(c) === gr.id);
  if (candidates.length === 0) return null;

  let hit = candidates.find(
    (c) => c.name.trim().toLowerCase().replace(/\s+/g, " ") === streamN
  );
  if (hit) return hit;

  hit = candidates.find(
    (c) =>
      c.name.trim().toLowerCase().replace(/\s+/g, " ") === `${gradeN} ${streamN}`
  );
  if (hit) return hit;

  hit = candidates.find(
    (c) =>
      c.name.trim().toLowerCase().replace(/\s+/g, "") === gCompact + sCompact
  );
  if (hit) return hit;

  for (const c of candidates) {
    const cn = c.name.trim().toLowerCase().replace(/\s+/g, " ");
    if (cn.startsWith(`${gradeN} `)) {
      const rest = cn.slice(gradeN.length + 1).trim();
      if (rest === streamN) return c;
    }
    if (cn.startsWith(gCompact) && cn.length > gCompact.length) {
      const rest = cn
        .slice(gCompact.length)
        .trim()
        .replace(/^[\s\-–—]+/, "");
      if (rest === streamN) return c;
    }
  }

  if (streamN.length <= 8) {
    hit = candidates.find((c) => {
      const cn = c.name.trim().toLowerCase().replace(/\s+/g, " ");
      const parts = cn.split(/\s+/).filter(Boolean);
      const last = parts[parts.length - 1] ?? "";
      return last === streamN;
    });
    if (hit) return hit;
  }

  if (/^[a-z0-9]{1,3}$/i.test(streamRaw.trim())) {
    hit = candidates.find((c) => {
      const cn = c.name.trim().toLowerCase().replace(/\s+/g, " ");
      return cn.endsWith(` ${streamN}`) || cn === `${gradeN} ${streamN}`;
    });
    if (hit) return hit;
  }

  return null;
}

function rowsToSuggestions(args: {
  rows: Array<{ subject: string; grade: string; stream: string }>;
  grades: Array<{ id: string; name: string }>;
  offerings: OfferingMatchLite[];
  classGroups: any[];
  constraints: ReturnType<typeof buildGradeStreamConstraints>;
}) {
  const gradeByNorm = new Map<string, { id: string; name: string }>();
  for (const g of args.grades) {
    gradeByNorm.set(g.name.trim().toLowerCase().replace(/\s+/g, " "), g);
  }

  const suggestions: Array<{
    subjectId: string;
    subjectOfferingId: string;
    classGroupId: string;
    gradeId: string;
    label: string;
  }> = [];
  const unmatched: string[] = [];

  for (const row of args.rows) {
    const gr = bestGradeMatch(row.grade, gradeByNorm);
    if (!gr) {
      unmatched.push(`Grade “${row.grade}”`);
      continue;
    }

    const offering = bestOfferingForGrade(
      row.subject,
      gr.id,
      gr.name,
      args.offerings
    );
    if (!offering) {
      unmatched.push(`Subject “${row.subject}” for ${gr.name}`);
      continue;
    }

    const cg = findClassGroupForGrade(gr, row.stream, args.classGroups);
    if (!cg) {
      unmatched.push(`${gr.name} stream “${row.stream}”`);
      continue;
    }

    if (
      !rowMatchesStreamConstraint({
        gradeId: gr.id,
        streamRaw: row.stream,
        classGroupName: String(cg.name),
        gradeName: gr.name,
        constraints: args.constraints,
      })
    ) {
      continue;
    }

    const label = `${offering.displayName} · ${formatClassGroupLabel(
      gr.name,
      String(cg.name)
    )}`;
    suggestions.push({
      subjectId: offering.subjectId,
      subjectOfferingId: offering.id,
      classGroupId: String(cg._id),
      gradeId: gr.id,
      label,
    });
  }

  const seen = new Set<string>();
  return {
    suggestions: suggestions.filter((s) => {
      const k = `${s.subjectOfferingId}|${s.classGroupId}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    }),
    unmatched,
  };
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

    const [grades, subjectOfferings, classGroups] = await Promise.all([
      Grade.find({ schoolId: schoolIdObj, isActive: true })
        .select("_id name")
        .sort({ order: 1, name: 1 })
        .lean(),
      SubjectOffering.find({ schoolId: schoolIdObj, isActive: true })
        .select(
          "_id subjectId displayName shortName code subjectFamily gradeIds gradeBand"
        )
        .sort({ gradeBand: 1, displayName: 1 })
        .lean(),
      ClassGroup.find({ schoolId: schoolIdObj, isActive: true })
        .select("_id name gradeId")
        .populate({ path: "gradeId", select: "name", model: Grade })
        .lean(),
    ]);

    const gradeRows = (grades as any[]).map((g) => ({
      id: String(g._id),
      name: String(g.name),
    }));

    const gradeNameById = new Map<string, string>(
      gradeRows.map((g) => [g.id, g.name])
    );

    const offerings: OfferingMatchLite[] = (subjectOfferings as any[]).map(
      (row) => ({
        id: String(row._id),
        subjectId: String(row.subjectId),
        displayName: String(row.displayName || ""),
        shortName: String(row.shortName || ""),
        code: String(row.code || ""),
        subjectFamily: String(row.subjectFamily || ""),
        gradeBand: String(row.gradeBand || ""),
        gradeIds: Array.isArray(row.gradeIds)
          ? row.gradeIds.map((id: unknown) => String(id))
          : [],
      })
    );

    const classGroupRows = (classGroups as any[]).map((cg) => ({
      _id: cg._id,
      name: String(cg.name),
      gradeId: classGroupGradeId(cg),
    }));

    const missing: string[] = [];
    if (!gradeRows.length) missing.push("grades");
    if (!classGroupRows.length) missing.push("class groups");
    if (!offerings.length) missing.push("subject offerings");

    if (missing.length > 0) {
      let leoSummary =
        "Add active grades, class groups, and subject offerings first—then I can map your description to real classes.";
      if (
        gradeRows.length > 0 &&
        classGroupRows.length > 0 &&
        offerings.length === 0
      ) {
        leoSummary =
          "Set up subject offerings for your grades under Admin → Subjects, then I can map your description to real classes.";
      } else if (missing.length < 3) {
        leoSummary = `Add active ${missing.join(" and ")} first—then I can map your description to real classes.`;
      }

      return NextResponse.json({
        success: true,
        confirmationText: null as string | null,
        leoSummary,
        suggestions: [],
        unmatched: [],
        fallback: true,
      });
    }

    const streamConstraints = buildGradeStreamConstraints(hint, gradeRows);

    const ctx = {
      grades: gradeRows,
      subjectOfferings: offerings.map((o) => ({
        id: o.id,
        name: o.displayName,
        shortName: o.shortName,
        code: o.code,
        gradeBand: o.gradeBand,
        gradeNames: o.gradeIds
          .map((id) => gradeNameById.get(id))
          .filter((name): name is string => Boolean(name)),
      })),
      classGroups: classGroupRows.map((cg) => ({
        id: String(cg._id),
        stream: cg.name,
        gradeName: gradeNameById.get(cg.gradeId) || "",
      })),
    };

    let assignmentRows = [
      ...tryDeterministicAssignments(hint, gradeRows, streamConstraints),
      ...expandAllStreamAssignments(
        hint,
        gradeRows,
        streamConstraints,
        classGroupRows
      ),
    ];

    let leoSummary =
      "I matched your note to the closest subject offerings and class groups in your school.";

    if (assignmentRows.length === 0) {
      if (!process.env.OPENAI_API_KEY) {
        return NextResponse.json({
          success: true,
          confirmationText: null as string | null,
          leoSummary:
            "OpenAI isn’t configured, so I can’t interpret free text yet. Add OPENAI_API_KEY to your environment, or pick subject offerings, grade, and class manually.",
          suggestions: [],
          unmatched: [],
          fallback: true,
        });
      }

      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.15,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You are Leo, assisting a Ghanaian school admin. Parse what a teacher teaches from informal text. Matching is CASE-INSENSITIVE ("math", "Math", "MATH" are the same).

Return ONLY valid JSON:
{
  "leoSummary": string,
  "assignments": [ { "subjectOfferingId": string | null, "subject": string, "grade": string, "stream": string } ]
}

Rules:
- Use ONLY grades, class streams, and subjectOfferings from context. Never invent IDs.
- Prefer subjectOfferingId from context when the offering clearly matches the grade + subject. Otherwise set subjectOfferingId to null and put the best subject offering name in "subject".
- "stream" must be the stream suffix ONLY: "A", "B", "1", "Rose" — not the full class name.
- If the user names ONE stream (e.g. "JHS 1 A", "jhs1a", "JHS 1 stream A"), output EXACTLY ONE row for that stream. Do NOT add other streams.
- Only output multiple streams when the user explicitly lists them ("A and B", "A, B") OR when they name a grade + subject with NO stream at all — then one row per class group in context for that grade.
- "math"/"maths" → Mathematics offering for that grade. "science" → Science / Integrated Science offering for that grade.
- Shorthand like "JHS2A" → grade from context + stream "A".
- Omit anything you cannot match to context; do not guess.`,
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

      const arr = Array.isArray(data.assignments) ? data.assignments : [];
      assignmentRows = arr
        .map((row: any) => {
          const offeringId =
            typeof row?.subjectOfferingId === "string"
              ? row.subjectOfferingId.trim()
              : "";
          const offering = offeringId
            ? offerings.find((item) => item.id === offeringId)
            : null;
          return {
            subject: offering
              ? offering.displayName
              : typeof row?.subject === "string"
                ? row.subject
                : "",
            grade: typeof row?.grade === "string" ? row.grade : "",
            stream: typeof row?.stream === "string" ? row.stream : "",
          };
        })
        .filter((row) => row.subject && row.grade && row.stream);
    }

    const { suggestions: deduped, unmatched } = rowsToSuggestions({
      rows: assignmentRows,
      grades: gradeRows,
      offerings,
      classGroups,
      constraints: streamConstraints,
    });

    const confirmationText = buildConfirmationText(
      deduped.map((s) => s.label),
      unmatched
    );

    if (deduped.length > 0 && assignmentRows.length > deduped.length) {
      leoSummary =
        "I kept only the class streams that match your note and the subject offerings scoped to each grade.";
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
