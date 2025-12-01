/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/admin/class-groups/bulk/route.ts
import { NextRequest } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Grade } from "@/models/Grade";
import { ClassGroup } from "@/models/ClassGroup";
import { Subject, type ISubject } from "@/models/Subject";
import mongoose from "mongoose";

type Strategy =
  | { kind: "letters"; from: string; to: string }
  | { kind: "numbers"; from: number; to: number }
  | { kind: "custom"; names: string[] };

type GradeConfig = {
  gradeId: string;
  strategy: Strategy;
};

type Body = {
  gradeConfigs: GradeConfig[];
  subjectIds?: string[];
  homeroomTeacherId?: string | null;
  capacity?: number | null;
};

function generateNames(strategy: Strategy): string[] {
  if (strategy.kind === "letters") {
    const start = strategy.from.toUpperCase().charCodeAt(0);
    const end = strategy.to.toUpperCase().charCodeAt(0);
    if (isNaN(start) || isNaN(end) || end < start) return [];
    const out: string[] = [];
    for (let c = start; c <= end; c++) out.push(String.fromCharCode(c));
    return out;
  }
  if (strategy.kind === "numbers") {
    const out: string[] = [];
    for (let n = strategy.from; n <= strategy.to; n++) out.push(String(n));
    return out;
  }
  return strategy.names.map((n) => n.trim()).filter(Boolean);
}

export async function POST(req: NextRequest) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

    const body = (await req.json()) as Body;

    // Support both old format (backward compatibility) and new format
    let gradeConfigs: GradeConfig[] = [];
    if (body.gradeConfigs && Array.isArray(body.gradeConfigs)) {
      // New format: per-grade configurations
      gradeConfigs = body.gradeConfigs.filter(
        (gc) => gc.gradeId && mongoose.isValidObjectId(gc.gradeId) && gc.strategy
      );
    } else {
      // Old format: single strategy for all grades (backward compatibility)
      const oldBody = body as any;
      const gradeIds = (oldBody.gradeIds ?? []).filter((id: string) =>
        mongoose.isValidObjectId(id)
      );
      if (gradeIds.length === 0 && gradeConfigs.length === 0)
        return new Response("Missing gradeIds or gradeConfigs", { status: 400 });

      if (oldBody.strategy) {
        gradeConfigs = gradeIds.map((gradeId: string) => ({
          gradeId,
          strategy: oldBody.strategy,
        }));
      }
    }

    if (gradeConfigs.length === 0)
      return new Response("No valid grade configurations", { status: 400 });

    const gradeIds = gradeConfigs.map((gc) => gc.gradeId);
    const grades = await Grade.find({
      _id: { $in: gradeIds },
      schoolId,
      isActive: true,
    }).lean();

    if (grades.length !== gradeIds.length) {
      return new Response("One or more grades not found or not active", {
        status: 400,
      });
    }

    // Create a map for quick grade lookup
    const gradeMap = new Map(grades.map((g) => [String(g._id), g]));

    // Validate subjectIds belong to this school
    let subjectIds: mongoose.Types.ObjectId[] = [];
    if (body.subjectIds && body.subjectIds.length > 0) {
      const subs = (await Subject.find({
        _id: { $in: body.subjectIds },
        schoolId,
        isActive: true,
      }).lean()) as unknown as ISubject[];
      subjectIds = subs.map((s: ISubject) => {
        const id = s._id;
        return id instanceof mongoose.Types.ObjectId
          ? id
          : new mongoose.Types.ObjectId(String(id));
      });
    }

    const docs = [];
    for (const config of gradeConfigs) {
      const grade = gradeMap.get(config.gradeId);
      if (!grade) continue;

      const names = generateNames(config.strategy);
      if (names.length === 0) continue;

      for (const n of names) {
        docs.push({
          schoolId,
          gradeId: grade._id,
          name: `${grade.name} ${n}`.replace(/\s+/g, " ").trim(),
          code: null,
          subjectIds,
          homeroomTeacherId: body.homeroomTeacherId ?? null,
          capacity: body.capacity ?? null,
          isActive: true,
        });
      }
    }

    let inserted = 0;
    try {
      const res = await ClassGroup.insertMany(docs, { ordered: false });
      inserted = res.length;
    } catch (err: any) {
      const msg = String(err?.message || "");
      if (!msg.includes("E11000")) {
        console.error("insertMany error", err);
        return new Response("Failed to create class groups", { status: 500 });
      }
      // If dupes, approximate created by re-counting wanted set
      const namesSet = new Set(docs.map((d) => d.name));
      const existing = await ClassGroup.countDocuments({
        schoolId,
        gradeId: { $in: grades.map((g) => g._id) },
        name: { $in: Array.from(namesSet) },
      });
      inserted = Math.max(0, docs.length - existing);
    }

    // No manual emit: dashboard metrics don’t show class group counts.
    // React Query invalidations in the client hook will refresh dropdowns.
    return Response.json({ success: true, created: inserted });
  } catch (e: any) {
    console.error(e);
    return new Response(e?.message ?? "Failed to create class groups", {
      status: 500,
    });
  }
}
