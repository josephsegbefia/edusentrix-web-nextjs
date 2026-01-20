// src/app/api/admin/teacher-duties/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import {
  DutyDefinition,
  TeacherDutyAssignment,
  DEFAULT_DUTY_DEFINITIONS,
} from "@/models/TeacherDutyAssignment";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import mongoose from "mongoose";
import { z } from "zod";

const CreateDutyDefinitionSchema = z.object({
  name: z.string().min(1).max(100),
  code: z.string().min(1).max(50).toUpperCase(),
  category: z.enum(["supervision", "assembly", "break", "gate", "dining", "sports", "exam", "event", "custom"]),
  description: z.string().max(500).optional(),
  frequency: z.enum(["daily", "weekly", "rotational", "one_time"]),
  defaultDays: z.array(z.number().min(0).max(6)).optional(),
  defaultStartTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
  defaultEndTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
  location: z.string().max(100).optional(),
  minTeachersRequired: z.number().min(1).max(20).optional(),
  maxTeachersAllowed: z.number().min(1).max(50).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

const AssignDutySchema = z.object({
  teacherId: z.string(),
  dutyDefinitionId: z.string(),
  days: z.array(z.number().min(0).max(6)),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  specificDate: z.string().optional(),
  weekNumber: z.number().min(1).max(52).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  notes: z.string().max(500).optional(),
});

/**
 * GET /api/admin/teacher-duties
 * Fetch duty definitions and current assignments
 */
export async function GET(req: NextRequest) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));
    const url = new URL(req.url);
    const includeAssignments = url.searchParams.get("assignments") === "1";
    const teacherId = url.searchParams.get("teacherId");
    const activeOnly = url.searchParams.get("active") !== "0";

    // Fetch duty definitions
    const dutyQuery: Record<string, unknown> = { schoolId: schoolIdObj };
    if (activeOnly) {
      dutyQuery.isActive = true;
    }

    let duties = await DutyDefinition.find(dutyQuery)
      .sort({ category: 1, order: 1, name: 1 })
      .lean();

    // If no duties exist, seed defaults
    if (duties.length === 0) {
      const defaultDuties = DEFAULT_DUTY_DEFINITIONS.map((duty, index) => ({
        schoolId: schoolIdObj,
        ...duty,
        order: index,
        isActive: true,
      }));
      await DutyDefinition.insertMany(defaultDuties);
      duties = await DutyDefinition.find({ schoolId: schoolIdObj })
        .sort({ category: 1, order: 1, name: 1 })
        .lean();
    }

    const dutiesData = duties.map((duty: any) => ({
      id: String(duty._id),
      name: duty.name,
      code: duty.code,
      category: duty.category,
      description: duty.description || null,
      frequency: duty.frequency,
      defaultDays: duty.defaultDays || [],
      defaultStartTime: duty.defaultStartTime || null,
      defaultEndTime: duty.defaultEndTime || null,
      location: duty.location || null,
      minTeachersRequired: duty.minTeachersRequired || 1,
      maxTeachersAllowed: duty.maxTeachersAllowed || null,
      color: duty.color || null,
      order: duty.order,
      isActive: duty.isActive,
    }));

    // Group by category
    const grouped = {
      supervision: dutiesData.filter((d) => d.category === "supervision"),
      assembly: dutiesData.filter((d) => d.category === "assembly"),
      break: dutiesData.filter((d) => d.category === "break"),
      gate: dutiesData.filter((d) => d.category === "gate"),
      dining: dutiesData.filter((d) => d.category === "dining"),
      sports: dutiesData.filter((d) => d.category === "sports"),
      exam: dutiesData.filter((d) => d.category === "exam"),
      event: dutiesData.filter((d) => d.category === "event"),
      custom: dutiesData.filter((d) => d.category === "custom"),
    };

    let assignments: any[] = [];
    let currentPeriod = null;

    if (includeAssignments) {
      // Get current academic period
      const period = await AcademicPeriod.findOne({
        schoolId: schoolIdObj,
        isCurrent: true,
      })
        .select("_id yearLabel term")
        .lean() as { _id: any; yearLabel: string; term: string } | null;

      if (period) {
        currentPeriod = {
          id: String(period._id),
          yearLabel: period.yearLabel,
          term: period.term,
        };

        // Build assignment query
        const assignmentQuery: Record<string, unknown> = {
          schoolId: schoolIdObj,
          academicPeriodId: period._id,
          isActive: true,
        };

        if (teacherId) {
          assignmentQuery.teacherId = new mongoose.Types.ObjectId(teacherId);
        }

        // Fetch assignments
        const assignmentDocs = await TeacherDutyAssignment.find(assignmentQuery)
          .populate({
            path: "teacherId",
            select: "userId",
            populate: { path: "userId", select: "firstName lastName email avatarUrl" },
          })
          .populate("dutyDefinitionId", "name code category color location")
          .populate("assignedBy", "firstName lastName")
          .sort({ "dutyDefinitionId.category": 1, days: 1, startTime: 1 })
          .lean();

        assignments = assignmentDocs.map((a: any) => {
          const teacher = a.teacherId;
          const user = teacher?.userId;
          const duty = a.dutyDefinitionId;

          return {
            id: String(a._id),
            teacher: teacher && user
              ? {
                  id: String(teacher._id),
                  firstName: user.firstName || "",
                  lastName: user.lastName || "",
                  fullName: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
                  email: user.email || null,
                  photoUrl: user.avatarUrl || null,
                }
              : null,
            duty: duty
              ? {
                  id: String(duty._id),
                  name: duty.name,
                  code: duty.code,
                  category: duty.category,
                  color: duty.color || null,
                  location: duty.location || null,
                }
              : null,
            days: a.days,
            startTime: a.startTime,
            endTime: a.endTime,
            specificDate: a.specificDate ? new Date(a.specificDate).toISOString() : null,
            weekNumber: a.weekNumber || null,
            assignedAt: new Date(a.assignedAt).toISOString(),
            startDate: new Date(a.startDate).toISOString(),
            endDate: a.endDate ? new Date(a.endDate).toISOString() : null,
            notes: a.notes || null,
          };
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: dutiesData,
      grouped,
      assignments: includeAssignments ? assignments : undefined,
      currentPeriod,
    });
  } catch (e: unknown) {
    console.error("Error fetching teacher duties:", e);
    const message = e instanceof Error ? e.message : "Failed to fetch teacher duties";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/**
 * POST /api/admin/teacher-duties
 * Create a new duty definition OR assign a duty to a teacher
 */
export async function POST(req: NextRequest) {
  try {
    const { schoolId, userId } = await requireSchoolAdmin();
    await connectToDatabase();

    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));
    const body = await req.json();

    // Check if this is a duty definition creation or assignment
    if (body.teacherId) {
      // This is an assignment
      const parsed = AssignDutySchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { success: false, error: "Validation failed", issues: parsed.error.flatten() },
          { status: 400 }
        );
      }

      const {
        teacherId,
        dutyDefinitionId,
        days,
        startTime,
        endTime,
        specificDate,
        weekNumber,
        startDate,
        endDate,
        notes,
      } = parsed.data;

      // Get current academic period
      const currentPeriod = await AcademicPeriod.findOne({
        schoolId: schoolIdObj,
        isCurrent: true,
      })
        .select("_id")
        .lean() as { _id: any } | null;

      if (!currentPeriod) {
        return NextResponse.json(
          { success: false, error: "No active academic period found" },
          { status: 404 }
        );
      }

      // Verify duty definition exists
      const dutyDef = await DutyDefinition.findOne({
        _id: new mongoose.Types.ObjectId(dutyDefinitionId),
        schoolId: schoolIdObj,
        isActive: true,
      }).lean() as { _id: any; name: string; maxTeachersAllowed?: number } | null;

      if (!dutyDef) {
        return NextResponse.json(
          { success: false, error: "Duty definition not found or inactive" },
          { status: 404 }
        );
      }

      // Check max teachers constraint
      if (dutyDef.maxTeachersAllowed) {
        const existingCount = await TeacherDutyAssignment.countDocuments({
          schoolId: schoolIdObj,
          dutyDefinitionId: dutyDef._id,
          academicPeriodId: currentPeriod._id,
          days: { $in: days },
          isActive: true,
        });

        if (existingCount >= dutyDef.maxTeachersAllowed) {
          return NextResponse.json(
            {
              success: false,
              error: `Maximum of ${dutyDef.maxTeachersAllowed} teacher(s) can be assigned to "${dutyDef.name}" for these days`,
            },
            { status: 409 }
          );
        }
      }

      // Check if teacher already has this duty on same days
      const existingAssignment = await TeacherDutyAssignment.findOne({
        schoolId: schoolIdObj,
        teacherId: new mongoose.Types.ObjectId(teacherId),
        dutyDefinitionId: dutyDef._id,
        academicPeriodId: currentPeriod._id,
        days: { $in: days },
        isActive: true,
      });

      if (existingAssignment) {
        return NextResponse.json(
          { success: false, error: "Teacher already has this duty on one or more of these days" },
          { status: 409 }
        );
      }

      // Create assignment
      const assignment = await TeacherDutyAssignment.create({
        schoolId: schoolIdObj,
        teacherId: new mongoose.Types.ObjectId(teacherId),
        dutyDefinitionId: dutyDef._id,
        academicPeriodId: currentPeriod._id,
        days,
        startTime,
        endTime,
        specificDate: specificDate ? new Date(specificDate) : undefined,
        weekNumber,
        assignedAt: new Date(),
        assignedBy: userId ? new mongoose.Types.ObjectId(String(userId)) : undefined,
        startDate: startDate ? new Date(startDate) : new Date(),
        endDate: endDate ? new Date(endDate) : undefined,
        notes,
        isActive: true,
      });

      return NextResponse.json({
        success: true,
        message: `${dutyDef.name} duty assigned successfully`,
        data: { id: String(assignment._id) },
      });
    } else {
      // This is a duty definition creation
      const parsed = CreateDutyDefinitionSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { success: false, error: "Validation failed", issues: parsed.error.flatten() },
          { status: 400 }
        );
      }

      const dutyData = parsed.data;

      // Check for duplicate code
      const existing = await DutyDefinition.findOne({
        schoolId: schoolIdObj,
        code: dutyData.code,
      });

      if (existing) {
        return NextResponse.json(
          { success: false, error: "A duty with this code already exists" },
          { status: 409 }
        );
      }

      // Get max order
      const maxOrderDuty = await DutyDefinition.findOne({ schoolId: schoolIdObj })
        .sort({ order: -1 })
        .select("order")
        .lean() as { order?: number } | null;
      const nextOrder = (maxOrderDuty?.order ?? -1) + 1;

      const duty = await DutyDefinition.create({
        schoolId: schoolIdObj,
        ...dutyData,
        order: nextOrder,
        isActive: true,
      });

      return NextResponse.json({
        success: true,
        message: "Duty definition created successfully",
        data: {
          id: String(duty._id),
          name: duty.name,
          code: duty.code,
        },
      });
    }
  } catch (e: unknown) {
    console.error("Error creating teacher duty:", e);
    const message = e instanceof Error ? e.message : "Failed to create teacher duty";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/teacher-duties
 * Remove a duty assignment (not the definition)
 */
export async function DELETE(req: NextRequest) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));
    const url = new URL(req.url);
    const assignmentId = url.searchParams.get("assignmentId");

    if (!assignmentId) {
      return NextResponse.json(
        { success: false, error: "Assignment ID is required" },
        { status: 400 }
      );
    }

    const assignment = await TeacherDutyAssignment.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(assignmentId),
        schoolId: schoolIdObj,
      },
      { $set: { isActive: false, endDate: new Date() } },
      { new: true }
    );

    if (!assignment) {
      return NextResponse.json(
        { success: false, error: "Assignment not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Duty assignment removed successfully",
    });
  } catch (e: unknown) {
    console.error("Error removing duty assignment:", e);
    const message = e instanceof Error ? e.message : "Failed to remove duty assignment";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
