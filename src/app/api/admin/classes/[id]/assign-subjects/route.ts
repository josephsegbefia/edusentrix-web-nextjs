// src/app/api/admin/classes/[id]/assign-subjects/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { ClassGroup } from "@/models/ClassGroup";
import { Subject } from "@/models/Subject";
import { SubjectOffering } from "@/models/SubjectOffering";
import { isPreschoolLearningAreaGrade } from "@/constants/curriculum-subject-templates";
import mongoose from "mongoose";
import { z } from "zod";

const AssignSubjectsSchema = z.object({
  subjectIds: z.array(z.string()),
});

function toObjectIdOrNull(id: string) {
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

/**
 * POST /api/admin/classes/[id]/assign-subjects
 * Assign subjects to a class group
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

    const { id } = await params;
    const classId = toObjectIdOrNull(id);
    if (!classId) {
      return NextResponse.json(
        { success: false, error: "Invalid class ID" },
        { status: 400 }
      );
    }

    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));
    const body = await req.json();

    const parsed = AssignSubjectsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { subjectIds } = parsed.data;
    const subjectObjectIds = subjectIds
      .map(toObjectIdOrNull)
      .filter((id): id is mongoose.Types.ObjectId => id !== null);

    if (subjectObjectIds.length !== subjectIds.length) {
      return NextResponse.json(
        { success: false, error: "One or more subject IDs are invalid" },
        { status: 400 }
      );
    }

    const classGroup = await ClassGroup.findOne({
      _id: classId,
      schoolId: schoolIdObj,
    })
      .populate("gradeId", "name code stage")
      .select("_id name gradeId subjectOfferingIds")
      .lean();

    if (!classGroup) {
      return NextResponse.json(
        { success: false, error: "Class not found" },
        { status: 404 }
      );
    }

    const validSubjects = await Subject.find({
      _id: { $in: subjectObjectIds },
      schoolId: schoolIdObj,
    })
      .select("_id name")
      .lean();

    if (validSubjects.length !== subjectObjectIds.length) {
      return NextResponse.json(
        { success: false, error: "One or more subjects do not belong to this school" },
        { status: 400 }
      );
    }

    const grade = classGroup.gradeId as unknown as {
      _id: mongoose.Types.ObjectId;
      name?: string | null;
      code?: string | null;
      stage?: string | null;
    };
    const isPreschoolClass = isPreschoolLearningAreaGrade(grade);
    let subjectOfferingObjectIds: mongoose.Types.ObjectId[] = [];

    if (!isPreschoolClass && subjectObjectIds.length > 0) {
      const offerings = await SubjectOffering.find({
        schoolId: schoolIdObj,
        subjectId: { $in: subjectObjectIds },
        gradeIds: grade._id,
        isActive: true,
      })
        .select("_id subjectId displayName")
        .lean();

      const existingOfferingIds = new Set(
        (classGroup.subjectOfferingIds || []).map((id) => String(id))
      );
      const subjectNameById = new Map(
        validSubjects.map((subject) => [String(subject._id), subject.name])
      );
      const offeringsBySubjectId = new Map<string, typeof offerings>();

      for (const offering of offerings) {
        const key = String(offering.subjectId);
        const rows = offeringsBySubjectId.get(key) || [];
        rows.push(offering);
        offeringsBySubjectId.set(key, rows);
      }

      const missing: string[] = [];
      const ambiguous: string[] = [];

      for (const subjectId of subjectObjectIds) {
        const key = String(subjectId);
        const candidates = offeringsBySubjectId.get(key) || [];
        const existingCandidates = candidates.filter((offering) =>
          existingOfferingIds.has(String(offering._id))
        );

        if (existingCandidates.length === 1) {
          subjectOfferingObjectIds.push(existingCandidates[0]._id);
        } else if (candidates.length === 1) {
          subjectOfferingObjectIds.push(candidates[0]._id);
        } else if (candidates.length === 0) {
          missing.push(subjectNameById.get(key) || key);
        } else {
          ambiguous.push(subjectNameById.get(key) || key);
        }
      }

      if (missing.length > 0) {
        return NextResponse.json(
          {
            success: false,
            error: `Set up an active subject offering for this grade before assigning: ${missing.join(", ")}`,
          },
          { status: 400 }
        );
      }

      if (ambiguous.length > 0) {
        return NextResponse.json(
          {
            success: false,
            error: `Multiple subject offerings match this grade. Assign the intended offering from Subject Offerings: ${ambiguous.join(", ")}`,
          },
          { status: 409 }
        );
      }
    }

    const updated = await ClassGroup.findOneAndUpdate(
      { _id: classId, schoolId: schoolIdObj },
      {
        $set: {
          subjectIds: subjectObjectIds,
          subjectOfferingIds: subjectOfferingObjectIds,
        },
      },
      { new: true }
    )
      .populate("subjectIds", "name code")
      .populate("subjectOfferingIds", "subjectId displayName shortName code")
      .lean();

    if (!updated) {
      return NextResponse.json(
        { success: false, error: "Class not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Assigned ${subjectIds.length} subject(s) to class`,
      data: {
        id: String((updated as any)._id),
        name: (updated as any).name,
        subjects: isPreschoolClass
          ? ((updated as any).subjectIds || []).map((s: any) => ({
              id: String(s._id),
              subjectOfferingId: null,
              name: s.name,
              code: s.code || null,
            }))
          : ((updated as any).subjectOfferingIds || []).map((offering: any) => ({
              id: String(offering.subjectId || offering._id),
              subjectOfferingId: String(offering._id),
              name: offering.displayName || offering.shortName,
              code: offering.code || null,
            })),
      },
    });
  } catch (e: unknown) {
    const message =
      e instanceof Error ? e.message : "Failed to assign subjects";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
