/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/admin/class-groups/search/route.ts
import { NextRequest } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import mongoose from "mongoose";
import { ClassGroup } from "@/models/ClassGroup";
import { Grade } from "@/models/Grade";
import { Subject } from "@/models/Subject";
import { School } from "@/models/School";
import { escapeRegex, parsePositiveInt } from "@/lib/utils";
import { formatClassGroupLabel } from "@/lib/utils/formatClassGroupLabel";
import { getAllowedStagesForSubject } from "@/constants/curriculum-subject-templates";
import type { CurriculumCode } from "@/constants/curriculum-profiles";

export async function GET(req: NextRequest) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));
    const { searchParams } = new URL(req.url);

    const q = (searchParams.get("q") || "").trim();
    const limit = Math.min(parsePositiveInt(searchParams.get("limit"), 10), 50);
    const subjectId = (searchParams.get("subjectId") || "").trim();
    const gradeIdParam = (searchParams.get("gradeId") || "").trim();

    const query: any = { schoolId: schoolIdObj, isActive: true };
    if (q) query.name = new RegExp(escapeRegex(q), "i");
    if (gradeIdParam && mongoose.Types.ObjectId.isValid(gradeIdParam)) {
      query.gradeId = new mongoose.Types.ObjectId(gradeIdParam);
    }

    let allowedStages: string[] | null = null;
    if (subjectId && mongoose.Types.ObjectId.isValid(subjectId)) {
      const [subjectDoc, schoolDoc] = await Promise.all([
        Subject.findById(subjectId).select("name").lean(),
        School.findById(schoolId).select("curriculumCode type").lean(),
      ]);
      if (subjectDoc && schoolDoc) {
        const curriculumCode = (schoolDoc.curriculumCode || "ghana_nacca") as CurriculumCode;
        const schoolType = (schoolDoc as any).type;
        allowedStages = getAllowedStagesForSubject(
          (subjectDoc as any).name ?? "",
          curriculumCode,
          schoolType
        );
      }
    }

    if (allowedStages && allowedStages.length > 0) {
      const gradesInStages = await Grade.find({
        schoolId: schoolIdObj,
        stage: { $in: allowedStages },
        isActive: true,
      })
        .select("_id")
        .lean();
      const gradeIds = gradesInStages.map((g: any) => g._id);
      if (gradeIds.length > 0) {
        query.gradeId = { $in: gradeIds };
      }
      // If no grades match (e.g. stages not yet synced), fall back to no filter
      // so classes still appear. Run grade seed to sync stages from curriculum.
    }

    const items = await ClassGroup.find(query)
      .select("_id name gradeId")
      .limit(limit)
      .populate({ path: "gradeId", select: "name stage", model: Grade })
      .lean();

    return Response.json({
      success: true,
      data: (items || []).map((g: any) => {
        const gradeName = g.gradeId?.name ? String(g.gradeId.name) : null;
        const name = String(g.name);
        return {
          id: String(g._id),
          name,
          gradeId: g.gradeId?._id ? String(g.gradeId._id) : null,
          gradeName,
          label: formatClassGroupLabel(gradeName, name),
        };
      }),
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to search class groups";
    return Response.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
