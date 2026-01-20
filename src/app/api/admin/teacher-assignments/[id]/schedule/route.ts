// src/app/api/admin/teacher-assignments/[id]/schedule/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { TeacherAssignment } from "@/models/TeacherAssignment";
import mongoose from "mongoose";

/**
 * PATCH /api/admin/teacher-assignments/[id]/schedule
 * Update schedule and contact hours for a teacher assignment
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
      assignmentIdObj = new mongoose.Types.ObjectId(assignmentId);
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid assignment ID" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { contactHoursPerWeek, schedules } = body;

    // Validate input
    if (contactHoursPerWeek !== undefined && (contactHoursPerWeek < 0 || contactHoursPerWeek > 40)) {
      return NextResponse.json(
        { success: false, error: "Contact hours must be between 0 and 40" },
        { status: 400 }
      );
    }

    if (schedules && !Array.isArray(schedules)) {
      return NextResponse.json(
        { success: false, error: "Schedules must be an array" },
        { status: 400 }
      );
    }

    if (schedules) {
      for (const schedule of schedules) {
        if (
          typeof schedule.dayOfWeek !== "number" ||
          schedule.dayOfWeek < 0 ||
          schedule.dayOfWeek > 6
        ) {
          return NextResponse.json(
            { success: false, error: "Invalid day of week (must be 0-6)" },
            { status: 400 }
          );
        }

        if (!schedule.startTime || !schedule.endTime) {
          return NextResponse.json(
            { success: false, error: "Start time and end time are required" },
            { status: 400 }
          );
        }

        // Validate time format (HH:MM)
        const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
        if (!timeRegex.test(schedule.startTime) || !timeRegex.test(schedule.endTime)) {
          return NextResponse.json(
            { success: false, error: "Invalid time format (use HH:MM)" },
            { status: 400 }
          );
        }

        // Validate start time is before end time
        const [startHour, startMin] = schedule.startTime.split(":").map(Number);
        const [endHour, endMin] = schedule.endTime.split(":").map(Number);
        const startMinutes = startHour * 60 + startMin;
        const endMinutes = endHour * 60 + endMin;

        if (endMinutes <= startMinutes) {
          return NextResponse.json(
            { success: false, error: "End time must be after start time" },
            { status: 400 }
          );
        }
      }
    }

    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));

    // Find and update the assignment
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

    // Update fields
    if (contactHoursPerWeek !== undefined) {
      assignment.contactHoursPerWeek = contactHoursPerWeek;
    }

    if (schedules !== undefined) {
      // Convert schedules to proper format
      assignment.schedules = schedules.map((s: any) => ({
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime,
        location: s.location || undefined,
        roomId: s.roomId ? new mongoose.Types.ObjectId(s.roomId) : undefined,
      }));
    }

    await assignment.save();

    return NextResponse.json({
      success: true,
      message: "Schedule updated successfully",
      data: {
        assignmentId: String(assignment._id),
        contactHoursPerWeek: assignment.contactHoursPerWeek,
        schedules: assignment.schedules || [],
      },
    });
  } catch (e: unknown) {
    console.error("Error updating schedule:", e);
    const message =
      e instanceof Error ? e.message : "Failed to update schedule";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
