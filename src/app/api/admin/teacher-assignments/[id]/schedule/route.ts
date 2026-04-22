// src/app/api/admin/teacher-assignments/[id]/schedule/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { TeacherAssignment } from "@/models/TeacherAssignment";
import mongoose from "mongoose";

/**
 * PATCH /api/admin/teacher-assignments/[id]/schedule
 *
 * Schedule writes are intentionally disabled as part of timetable cutover.
 * Only contactHoursPerWeek updates are accepted here for backwards compatibility.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

    const { id: assignmentId } = await params;

    let assignmentIdObj: mongoose.Types.ObjectId;
    try {
      assignmentIdObj = new mongoose.Types.ObjectId(String(assignmentId));
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid assignment ID" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const contactHoursPerWeek = body?.contactHoursPerWeek;
    const scheduleWriteAttempted = Object.prototype.hasOwnProperty.call(
      body ?? {},
      "schedules"
    );

    if (
      contactHoursPerWeek !== undefined &&
      (contactHoursPerWeek < 0 || contactHoursPerWeek > 40)
    ) {
      return NextResponse.json(
        { success: false, error: "Contact hours must be between 0 and 40" },
        { status: 400 }
      );
    }

    if (scheduleWriteAttempted && contactHoursPerWeek === undefined) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Assignment-level schedule writes are disabled. Manage schedules from the class timetable page.",
        },
        { status: 409 }
      );
    }

    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));
    const assignment = await TeacherAssignment.findOne({
      _id: assignmentIdObj,
      schoolId: schoolIdObj,
      status: "active",
    });

    if (!assignment) {
      return NextResponse.json(
        { success: false, error: "Assignment not found" },
        { status: 404 }
      );
    }

    if (contactHoursPerWeek === undefined) {
      return NextResponse.json({
        success: true,
        message: "No changes detected",
        data: {
          assignmentId: String(assignment._id),
          contactHoursPerWeek: assignment.contactHoursPerWeek ?? null,
        },
      });
    }

    assignment.contactHoursPerWeek = contactHoursPerWeek;
    await assignment.save();

    const warnings: string[] = [];
    if (scheduleWriteAttempted) {
      warnings.push("Schedules were ignored. Manage schedules from the class timetable page.");
    }

    return NextResponse.json({
      success: true,
      message:
        warnings.length > 0
          ? "Contact hours updated. Schedule edits are disabled on assignments."
          : "Contact hours updated successfully",
      data: {
        assignmentId: String(assignment._id),
        contactHoursPerWeek: assignment.contactHoursPerWeek ?? null,
      },
      warnings,
    });
  } catch (e: unknown) {
    console.error("Error updating assignment schedule endpoint:", e);
    const message =
      e instanceof Error ? e.message : "Failed to update assignment.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
