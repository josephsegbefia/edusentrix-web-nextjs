// src/app/api/admin/students/[id]/school-roles/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { SchoolStudentRole } from "@/models/SchoolStudentRole";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import mongoose from "mongoose";

/**
 * GET /api/admin/students/[id]/school-roles
 * Fetch school-wide roles for a specific student
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

    const { id: studentId } = await params;

    let studentIdObj: mongoose.Types.ObjectId;
    try {
      studentIdObj = new mongoose.Types.ObjectId(studentId);
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid student ID" },
        { status: 400 }
      );
    }

    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));

    // Get current academic period
    const currentPeriod = await AcademicPeriod.findOne({
      schoolId: schoolIdObj,
      isCurrent: true,
    })
      .select("_id yearLabel term")
      .lean() as { _id: any; yearLabel: string; term: string } | null;

    if (!currentPeriod) {
      return NextResponse.json({
        success: true,
        data: [],
        currentPeriod: null,
      });
    }

    // Fetch school-wide roles for this student
    const roles = await SchoolStudentRole.find({
      schoolId: schoolIdObj,
      studentId: studentIdObj,
      academicPeriodId: currentPeriod._id,
      isActive: true,
    })
      .populate("roleDefinitionId", "name code category badgeColor description")
      .populate("houseId", "name color")
      .sort({ "roleDefinitionId.category": 1, createdAt: -1 })
      .lean();

    const data = roles.map((role: any) => ({
      id: String(role._id),
      role: role.roleDefinitionId
        ? {
            id: String(role.roleDefinitionId._id),
            name: role.roleDefinitionId.name,
            code: role.roleDefinitionId.code,
            category: role.roleDefinitionId.category,
            badgeColor: role.roleDefinitionId.badgeColor || null,
            description: role.roleDefinitionId.description || null,
          }
        : null,
      house: role.houseId
        ? {
            id: String(role.houseId._id),
            name: role.houseId.name,
            color: role.houseId.color || null,
          }
        : null,
      academicPeriod: {
        id: String(currentPeriod._id),
        yearLabel: currentPeriod.yearLabel,
        term: currentPeriod.term,
      },
      isActive: role.isActive,
      assignedAt: new Date(role.assignedAt).toISOString(),
      startDate: new Date(role.startDate).toISOString(),
      endDate: role.endDate ? new Date(role.endDate).toISOString() : null,
      notes: role.notes || null,
    }));

    return NextResponse.json({
      success: true,
      data,
      currentPeriod: {
        id: String(currentPeriod._id),
        yearLabel: currentPeriod.yearLabel,
        term: currentPeriod.term,
      },
    });
  } catch (e: unknown) {
    console.error("Error fetching student school roles:", e);
    const message = e instanceof Error ? e.message : "Failed to fetch school roles";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
