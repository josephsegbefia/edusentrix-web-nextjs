/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import mongoose from "mongoose";
import { z } from "zod";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Grade } from "@/models/Grade";
import { Subject } from "@/models/Subject";

type Strategy =
  | { kind: "letters"; from: string; to: string }
  | { kind: "numbers"; from: number; to: number }
  | { kind: "custom"; names: string[] };

type GradeConfig = { gradeId: string; strategy: Strategy };

const BodySchema = z.object({
  namingPattern: z.enum(["letters", "numbers", "themed", "custom"]),
  /** Fallback when a grade is missing from streamsByGrade. */
  streamsPerGrade: z.number().int().min(1).max(26),
  streamsByGrade: z
    .record(z.string(), z.number().int().min(1).max(26))
    .optional(),
  customSuffixes: z.string().optional(),
  themedHint: z.string().optional(),
  gradeIds: z.array(z.string()).min(1),
  subjectMode: z.enum(["none", "all", "pick_shared", "per_grade"]),
  subjectIds: z.array(z.string()).optional(),
  subjectIdsByGrade: z.record(z.string(), z.array(z.string())).optional(),
  schoolType: z.enum(["Basic", "SHS"]).nullable().optional(),
});

function strategyLetters(count: number): Strategy {
  const from = "A";
  const to = String.fromCharCode("A".charCodeAt(0) + Math.min(count, 26) - 1);
  return { kind: "letters", from, to };
}

function strategyNumbers(count: number): Strategy {
  return { kind: "numbers", from: 1, to: count };
}

function strategyCustomFromList(names: string[], count: number): Strategy {
  const base = names.filter(Boolean).slice(0, count);
  const out = [...base];
  while (out.length < count) {
    out.push(`Group ${out.length + 1}`);
  }
  return { kind: "custom", names: out };
}

function streamCountFor(
  gradeId: string,
  streamsByGrade: Record<string, number> | undefined,
  fallback: number
): number {
  if (streamsByGrade && Object.prototype.hasOwnProperty.call(streamsByGrade, gradeId)) {
    return streamsByGrade[gradeId]!;
  }
  return fallback;
}

function deterministicConfigs(
  gradeIds: string[],
  namingPattern: "letters" | "numbers" | "custom",
  streamsByGrade: Record<string, number> | undefined,
  streamsFallback: number,
  customSuffixes?: string
): { leoSummary: string; gradeConfigs: GradeConfig[] } {
  const list =
    customSuffixes
      ?.split(/[,;\n]/)
      .map((s) => s.trim())
      .filter(Boolean) ?? [];

  const gradeConfigs: GradeConfig[] = gradeIds.map((gradeId) => {
    const n = streamCountFor(gradeId, streamsByGrade, streamsFallback);
    let strategy: Strategy;
    if (namingPattern === "letters") {
      strategy = strategyLetters(n);
    } else if (namingPattern === "numbers") {
      strategy = strategyNumbers(n);
    } else {
      strategy = strategyCustomFromList(list, n);
    }
    return { gradeId, strategy };
  });

  const varied =
    streamsByGrade &&
    new Set(gradeIds.map((g) => streamCountFor(g, streamsByGrade, streamsFallback)))
      .size > 1;

  const leoSummary = varied
    ? `I'll create the parallel class groups you set per grade (${gradeIds.length} level(s)), using ${namingPattern === "letters" ? "letter" : namingPattern === "numbers" ? "number" : "custom"} naming. Adjust anything on the review screen before saving.`
    : `I'll create ${streamCountFor(gradeIds[0]!, streamsByGrade, streamsFallback)} stream(s) per grade using ${namingPattern === "letters" ? "letter suffixes" : namingPattern === "numbers" ? "numbered streams" : "your custom names"}, for ${gradeIds.length} grade level(s).`;

  return { leoSummary, gradeConfigs };
}

async function resolveSubjectPayload(
  schoolOid: mongoose.Types.ObjectId,
  subjectMode: "none" | "all" | "pick_shared" | "per_grade",
  gradeIds: string[],
  pickedIds: string[] | undefined,
  subjectIdsByGradeInput: Record<string, string[]> | undefined
): Promise<{
  subjectIds: string[];
  subjectIdsByGrade: Record<string, string[]>;
  subjectLabels: Record<string, string>;
}> {
  const emptyMap = (): Record<string, string[]> =>
    Object.fromEntries(gradeIds.map((g) => [g, [] as string[]]));

  if (subjectMode === "none") {
    return { subjectIds: [], subjectIdsByGrade: emptyMap(), subjectLabels: {} };
  }

  if (subjectMode === "all") {
    const subs = await Subject.find({ schoolId: schoolOid, isActive: true })
      .select("_id name")
      .lean();
    const all = subs.map((s) => String(s._id));
    return {
      subjectIds: all,
      subjectIdsByGrade: Object.fromEntries(gradeIds.map((g) => [g, [...all]])),
      subjectLabels: Object.fromEntries(
        subs.map((s) => [String(s._id), String((s as { name?: string }).name || "Unnamed subject")])
      ),
    };
  }

  if (subjectMode === "pick_shared") {
    const pick = (pickedIds ?? []).filter((id) => mongoose.isValidObjectId(id));
    const subs = await Subject.find({
      _id: { $in: pick.map((id) => new mongoose.Types.ObjectId(id)) },
      schoolId: schoolOid,
      isActive: true,
    })
      .select("_id name")
      .lean();
    const ok = subs.map((s) => String(s._id));
    return {
      subjectIds: ok,
      subjectIdsByGrade: Object.fromEntries(gradeIds.map((g) => [g, [...ok]])),
      subjectLabels: Object.fromEntries(
        subs.map((s) => [String(s._id), String((s as { name?: string }).name || "Unnamed subject")])
      ),
    };
  }

  const raw = subjectIdsByGradeInput ?? {};
  const allIds = new Set<string>();
  for (const g of gradeIds) {
    for (const id of raw[g] ?? []) {
      if (mongoose.isValidObjectId(id)) allIds.add(String(id));
    }
  }
  const idArr = [...allIds];
  const subs =
    idArr.length > 0
      ? await Subject.find({
          _id: { $in: idArr.map((id) => new mongoose.Types.ObjectId(id)) },
          schoolId: schoolOid,
          isActive: true,
        })
          .select("_id name")
          .lean()
      : [];
  const valid = new Set(subs.map((s) => String(s._id)));
  const subjectLabels = Object.fromEntries(
    subs.map((s) => [String(s._id), String((s as { name?: string }).name || "Unnamed subject")])
  );
  const outMap: Record<string, string[]> = {};
  const union = new Set<string>();
  for (const g of gradeIds) {
    const ok = (raw[g] ?? []).filter((id) => valid.has(String(id)));
    outMap[g] = ok;
    ok.forEach((id) => union.add(id));
  }
  return { subjectIds: [...union], subjectIdsByGrade: outMap, subjectLabels };
}

export async function POST(req: NextRequest) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    const raw = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const {
      namingPattern,
      streamsPerGrade,
      streamsByGrade,
      customSuffixes,
      themedHint,
      gradeIds,
      subjectMode,
      subjectIds: pickedSubjectIds,
      subjectIdsByGrade: subjectIdsByGradeBody,
      schoolType,
    } = parsed.data;

    await connectToDatabase();

    const schoolOid =
      schoolId instanceof mongoose.Types.ObjectId
        ? schoolId
        : new mongoose.Types.ObjectId(String(schoolId));

    const oids = gradeIds
      .filter((id) => mongoose.isValidObjectId(id))
      .map((id) => new mongoose.Types.ObjectId(id));

    if (oids.length === 0) {
      return NextResponse.json({ error: "No valid grade IDs" }, { status: 400 });
    }

    const grades = await Grade.find({
      _id: { $in: oids },
      schoolId: schoolOid,
      isActive: true,
    })
      .select("_id name")
      .lean();

    if (grades.length !== oids.length) {
      return NextResponse.json(
        { error: "One or more grades are invalid for this school" },
        { status: 400 }
      );
    }

    const gradeMeta = grades.map((g: any) => ({
      gradeId: String(g._id),
      name: String(g.name ?? ""),
    }));

    const gidList = gradeMeta.map((g) => g.gradeId);

    const { subjectIds, subjectIdsByGrade, subjectLabels } = await resolveSubjectPayload(
      schoolOid,
      subjectMode,
      gidList,
      pickedSubjectIds,
      subjectIdsByGradeBody
    );

    if (namingPattern !== "themed") {
      const { leoSummary, gradeConfigs } = deterministicConfigs(
        gidList,
        namingPattern,
        streamsByGrade,
        streamsPerGrade,
        customSuffixes
      );
      return NextResponse.json({
        success: true,
        leoSummary,
        gradeConfigs,
        subjectIds,
        subjectIdsByGrade,
        subjectLabels,
      });
    }

    const gradesWithCounts = gradeMeta.map((g) => ({
      ...g,
      streamCount: streamCountFor(g.gradeId, streamsByGrade, streamsPerGrade),
    }));

    if (!process.env.OPENAI_API_KEY) {
      const gradeConfigs: GradeConfig[] = gradesWithCounts.map((g) => {
        const names = Array.from({ length: g.streamCount }, (_, i) => `Stream ${i + 1}`);
        return {
          gradeId: g.gradeId,
          strategy: strategyCustomFromList(names, g.streamCount),
        };
      });
      return NextResponse.json({
        success: true,
        leoSummary: `OpenAI isn’t configured, so I used simple placeholder stream names. Add OPENAI_API_KEY for themed Leo names, or use letters/numbers.`,
        gradeConfigs,
        subjectIds,
        subjectIdsByGrade,
        subjectLabels,
        fallback: true,
      });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.6,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are Leo, helping Ghanaian schools name class group streams.
Return ONLY valid JSON: { "leoSummary": string, "suffixesByGrade": { "<gradeId>": string[] } }.
For each grade in the input, suffixesByGrade[gradeId] must be an array whose length EXACTLY equals that grade's streamCount.
Each item is a SHORT suffix only (e.g. "Rose", "A") — not the full grade name. No markdown.`,
        },
        {
          role: "user",
          content: JSON.stringify({
            schoolType: schoolType ?? "unknown",
            themeHint: (themedHint || "balanced, age-appropriate class names").trim(),
            grades: gradesWithCounts,
          }),
        },
      ],
    });

    const text = completion.choices[0]?.message?.content;
    if (!text) {
      return NextResponse.json(
        { error: "Leo returned an empty response" },
        { status: 502 }
      );
    }

    let data: { leoSummary?: string; suffixesByGrade?: Record<string, string[]> };
    try {
      data = JSON.parse(text);
    } catch {
      return NextResponse.json(
        { error: "Leo returned invalid JSON" },
        { status: 502 }
      );
    }

    const leoSummary =
      typeof data.leoSummary === "string" && data.leoSummary.trim()
        ? data.leoSummary.trim()
        : `Themed stream names per your hint, with counts you chose for each grade.`;

    const gradeConfigs: GradeConfig[] = [];
    for (const g of gradesWithCounts) {
      const arr = data.suffixesByGrade?.[g.gradeId];
      const names = Array.isArray(arr)
        ? arr.map((x) => String(x).trim()).filter(Boolean)
        : [];
      gradeConfigs.push({
        gradeId: g.gradeId,
        strategy: strategyCustomFromList(names, g.streamCount),
      });
    }

    return NextResponse.json({
      success: true,
      leoSummary,
      gradeConfigs,
      subjectIds,
      subjectIdsByGrade,
      subjectLabels,
    });
  } catch (e: any) {
    console.error("leo-draft", e);
    return NextResponse.json(
      { error: e?.message ?? "Failed to build class group plan" },
      { status: 500 }
    );
  }
}
