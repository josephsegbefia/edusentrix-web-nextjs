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
  /** Applied to every new group when no per-grade override. */
  subjectIds?: string[];
  /** When set, each grade uses its list; missing grade falls back to subjectIds. */
  subjectIdsByGrade?: Record<string, string[]>;
  homeroomTeacherId?: string | null;
  /** Default capacity when capacitiesByClassName omits a class name. */
  capacity?: number | null;
  /** Exact class group display name → capacity. Overrides capacity for matching rows. */
  capacitiesByClassName?: Record<string, number | null>;
};

function normalizeCapacity(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

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
    const gradeMap = new Map(grades.map((g: any) => [String(g._id), g]));

    const idStrings = new Set<string>();
    if (body.subjectIds?.length) {
      for (const id of body.subjectIds) idStrings.add(String(id));
    }
    if (body.subjectIdsByGrade) {
      for (const arr of Object.values(body.subjectIdsByGrade)) {
        for (const id of arr ?? []) idStrings.add(String(id));
      }
    }
    const subjectOidList = [...idStrings].filter((id) =>
      mongoose.isValidObjectId(id)
    );
    const validSubjectById = new Map<string, mongoose.Types.ObjectId>();
    if (subjectOidList.length > 0) {
      const subs = (await Subject.find({
        _id: { $in: subjectOidList.map((id) => new mongoose.Types.ObjectId(id)) },
        schoolId,
        isActive: true,
      }).lean()) as unknown as ISubject[];
      for (const s of subs) {
        const id = s._id;
        const oid =
          id instanceof mongoose.Types.ObjectId
            ? id
            : new mongoose.Types.ObjectId(String(id));
        validSubjectById.set(String(oid), oid);
      }
    }

    const capByName = body.capacitiesByClassName;

    function capacityForClassName(className: string): number | null {
      if (
        capByName &&
        Object.prototype.hasOwnProperty.call(capByName, className)
      ) {
        return normalizeCapacity(capByName[className]);
      }
      return normalizeCapacity(body.capacity);
    }

    function subjectOidsForGrade(gradeIdStr: string): mongoose.Types.ObjectId[] {
      const byGrade = body.subjectIdsByGrade;
      if (byGrade && Object.prototype.hasOwnProperty.call(byGrade, gradeIdStr)) {
        const raw = byGrade[gradeIdStr] ?? [];
        return raw
          .map((id) => validSubjectById.get(String(id)))
          .filter(Boolean) as mongoose.Types.ObjectId[];
      }
      if (body.subjectIds && body.subjectIds.length > 0) {
        return body.subjectIds
          .map((id) => validSubjectById.get(String(id)))
          .filter(Boolean) as mongoose.Types.ObjectId[];
      }
      return [];
    }

    const docs = [];
    for (const config of gradeConfigs) {
      const grade = gradeMap.get(config.gradeId);
      if (!grade) continue;

      const names = generateNames(config.strategy);
      if (names.length === 0) continue;

      const subjectIdsForRow = subjectOidsForGrade(String(config.gradeId));

      for (const n of names) {
        const className = `${grade.name} ${n}`.replace(/\s+/g, " ").trim();
        docs.push({
          schoolId,
          gradeId: grade._id,
          name: className,
          code: null,
          subjectIds: subjectIdsForRow,
          homeroomTeacherId: body.homeroomTeacherId ?? null,
          capacity: capacityForClassName(className),
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
        gradeId: { $in: grades.map((g: any) => g._id) },
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
