// src/app/api/admin/school-roles/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import {
  SchoolRoleDefinition,
  SchoolStudentRole,
  DEFAULT_SCHOOL_ROLES,
} from "@/models/SchoolStudentRole";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import mongoose from "mongoose";
import { z } from "zod";

const CreateRoleDefinitionSchema = z.object({
  name: z.string().min(1).max(100),
  code: z.string().min(1).max(50).toUpperCase(),
  category: z.enum(["prefect", "council", "club", "sports", "cultural", "service", "custom"]),
  description: z.string().max(500).optional(),
  maxPerSchool: z.number().min(1).max(100).optional(),
  eligibleGrades: z.array(z.string()).optional(),
  badgeColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  icon: z.string().optional(),
});

const AssignRoleSchema = z.object({
  studentId: z.string(),
  roleDefinitionId: z.string(),
  houseId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  notes: z.string().max(500).optional(),
});

/**
 * GET /api/admin/school-roles
 * Fetch school role definitions and current assignments
 */
export async function GET(req: NextRequest) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));
    const url = new URL(req.url);
    const includeAssignments = url.searchParams.get("assignments") === "1";
    const activeOnly = url.searchParams.get("active") !== "0";

    // Fetch role definitions
    const roleQuery: Record<string, unknown> = { schoolId: schoolIdObj };
    if (activeOnly) {
      roleQuery.isActive = true;
    }

    let roles = await SchoolRoleDefinition.find(roleQuery)
      .sort({ category: 1, order: 1, name: 1 })
      .lean();

    // If no roles exist, seed defaults
    if (roles.length === 0) {
      const defaultRoles = DEFAULT_SCHOOL_ROLES.map((role, index) => ({
        schoolId: schoolIdObj,
        ...role,
        order: index,
        isActive: true,
      }));
      await SchoolRoleDefinition.insertMany(defaultRoles);
      roles = await SchoolRoleDefinition.find({ schoolId: schoolIdObj })
        .sort({ category: 1, order: 1, name: 1 })
        .lean();
    }

    const rolesData = roles.map((role: any) => ({
      id: String(role._id),
      name: role.name,
      code: role.code,
      category: role.category,
      description: role.description || null,
      maxPerSchool: role.maxPerSchool || null,
      eligibleGrades: (role.eligibleGrades || []).map((g: any) => String(g)),
      badgeColor: role.badgeColor || null,
      icon: role.icon || null,
      order: role.order,
      isActive: role.isActive,
    }));

    // Group by category
    const grouped = {
      prefect: rolesData.filter((r) => r.category === "prefect"),
      council: rolesData.filter((r) => r.category === "council"),
      club: rolesData.filter((r) => r.category === "club"),
      sports: rolesData.filter((r) => r.category === "sports"),
      cultural: rolesData.filter((r) => r.category === "cultural"),
      service: rolesData.filter((r) => r.category === "service"),
      custom: rolesData.filter((r) => r.category === "custom"),
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

        // Fetch assignments
        const assignmentDocs = await SchoolStudentRole.find({
          schoolId: schoolIdObj,
          academicPeriodId: period._id,
          isActive: true,
        })
          .populate("studentId", "firstName lastName photoUrl admissionNo classGroupId")
          .populate({
            path: "studentId",
            populate: {
              path: "classGroupId",
              select: "name gradeId",
              populate: { path: "gradeId", select: "name" },
            },
          })
          .populate("roleDefinitionId", "name code category badgeColor")
          .populate("houseId", "name color")
          .populate("assignedBy", "firstName lastName")
          .lean();

        assignments = assignmentDocs.map((a: any) => {
          const student = a.studentId;
          const role = a.roleDefinitionId;
          const house = a.houseId;
          const classGroup = student?.classGroupId;
          const grade = classGroup?.gradeId;

          return {
            id: String(a._id),
            student: student
              ? {
                  id: String(student._id),
                  firstName: student.firstName,
                  lastName: student.lastName,
                  fullName: `${student.firstName} ${student.lastName}`.trim(),
                  photoUrl: student.photoUrl || null,
                  admissionNo: student.admissionNo || null,
                  className: classGroup
                    ? grade
                      ? `${grade.name} ${classGroup.name}`
                      : classGroup.name
                    : null,
                }
              : null,
            role: role
              ? {
                  id: String(role._id),
                  name: role.name,
                  code: role.code,
                  category: role.category,
                  badgeColor: role.badgeColor || null,
                }
              : null,
            house: house
              ? {
                  id: String(house._id),
                  name: house.name,
                  color: house.color || null,
                }
              : null,
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
      data: rolesData,
      grouped,
      assignments: includeAssignments ? assignments : undefined,
      currentPeriod,
    });
  } catch (e: unknown) {
    console.error("Error fetching school roles:", e);
    const message = e instanceof Error ? e.message : "Failed to fetch school roles";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/**
 * POST /api/admin/school-roles
 * Create a new role definition OR assign a role to a student
 */
export async function POST(req: NextRequest) {
  try {
    const { schoolId, userId } = await requireSchoolAdmin();
    await connectToDatabase();

    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));
    const body = await req.json();

    // Check if this is a role definition creation or assignment
    if (body.studentId) {
      // This is an assignment
      const parsed = AssignRoleSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { success: false, error: "Validation failed", issues: parsed.error.flatten() },
          { status: 400 }
        );
      }

      const { studentId, roleDefinitionId, houseId, startDate, endDate, notes } = parsed.data;

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

      // Verify role definition exists
      const roleDef = await SchoolRoleDefinition.findOne({
        _id: new mongoose.Types.ObjectId(roleDefinitionId),
        schoolId: schoolIdObj,
        isActive: true,
      }).lean() as { _id: any; name: string; maxPerSchool?: number } | null;

      if (!roleDef) {
        return NextResponse.json(
          { success: false, error: "Role definition not found or inactive" },
          { status: 404 }
        );
      }

      // Check max per school constraint
      if (roleDef.maxPerSchool) {
        const existingCount = await SchoolStudentRole.countDocuments({
          schoolId: schoolIdObj,
          roleDefinitionId: roleDef._id,
          academicPeriodId: currentPeriod._id,
          isActive: true,
        });

        if (existingCount >= roleDef.maxPerSchool) {
          return NextResponse.json(
            {
              success: false,
              error: `Maximum of ${roleDef.maxPerSchool} student(s) can hold the "${roleDef.name}" role`,
            },
            { status: 409 }
          );
        }
      }

      // Check if student already has this role
      const existingAssignment = await SchoolStudentRole.findOne({
        schoolId: schoolIdObj,
        studentId: new mongoose.Types.ObjectId(studentId),
        roleDefinitionId: roleDef._id,
        academicPeriodId: currentPeriod._id,
        isActive: true,
      });

      if (existingAssignment) {
        return NextResponse.json(
          { success: false, error: "Student already has this role" },
          { status: 409 }
        );
      }

      // Create assignment
      const assignment = await SchoolStudentRole.create({
        schoolId: schoolIdObj,
        studentId: new mongoose.Types.ObjectId(studentId),
        roleDefinitionId: roleDef._id,
        academicPeriodId: currentPeriod._id,
        houseId: houseId ? new mongoose.Types.ObjectId(houseId) : undefined,
        assignedAt: new Date(),
        assignedBy: userId ? new mongoose.Types.ObjectId(String(userId)) : undefined,
        startDate: startDate ? new Date(startDate) : new Date(),
        endDate: endDate ? new Date(endDate) : undefined,
        notes,
        isActive: true,
      });

      return NextResponse.json({
        success: true,
        message: `${roleDef.name} role assigned successfully`,
        data: { id: String(assignment._id) },
      });
    } else {
      // This is a role definition creation
      const parsed = CreateRoleDefinitionSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { success: false, error: "Validation failed", issues: parsed.error.flatten() },
          { status: 400 }
        );
      }

      const { eligibleGrades, ...roleData } = parsed.data;

      // Check for duplicate code
      const existing = await SchoolRoleDefinition.findOne({
        schoolId: schoolIdObj,
        code: roleData.code,
      });

      if (existing) {
        return NextResponse.json(
          { success: false, error: "A role with this code already exists" },
          { status: 409 }
        );
      }

      // Get max order
      const maxOrderRole = await SchoolRoleDefinition.findOne({ schoolId: schoolIdObj })
        .sort({ order: -1 })
        .select("order")
        .lean() as { order?: number } | null;
      const nextOrder = (maxOrderRole?.order ?? -1) + 1;

      const role = await SchoolRoleDefinition.create({
        schoolId: schoolIdObj,
        ...roleData,
        eligibleGrades: eligibleGrades?.map((g) => new mongoose.Types.ObjectId(g)),
        order: nextOrder,
        isActive: true,
      });

      return NextResponse.json({
        success: true,
        message: "Role definition created successfully",
        data: {
          id: String(role._id),
          name: role.name,
          code: role.code,
        },
      });
    }
  } catch (e: unknown) {
    console.error("Error creating school role:", e);
    const message = e instanceof Error ? e.message : "Failed to create school role";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

const UpdateRoleDefinitionSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  maxPerSchool: z.number().min(1).max(100).optional().nullable(),
  eligibleGrades: z.array(z.string()).optional(),
  badgeColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  icon: z.string().optional(),
  isActive: z.boolean().optional(),
});

/**
 * PUT /api/admin/school-roles
 * Update a role definition
 */
export async function PUT(req: NextRequest) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));
    const url = new URL(req.url);
    const definitionId = url.searchParams.get("definitionId");

    if (!definitionId) {
      return NextResponse.json(
        { success: false, error: "Definition ID is required" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const parsed = UpdateRoleDefinitionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
    if (parsed.data.description !== undefined) updateData.description = parsed.data.description;
    if (parsed.data.maxPerSchool !== undefined) updateData.maxPerSchool = parsed.data.maxPerSchool;
    if (parsed.data.eligibleGrades !== undefined) {
      updateData.eligibleGrades = parsed.data.eligibleGrades.map(
        (g) => new mongoose.Types.ObjectId(g)
      );
    }
    if (parsed.data.badgeColor !== undefined) updateData.badgeColor = parsed.data.badgeColor;
    if (parsed.data.icon !== undefined) updateData.icon = parsed.data.icon;
    if (parsed.data.isActive !== undefined) updateData.isActive = parsed.data.isActive;

    const role = await SchoolRoleDefinition.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(definitionId),
        schoolId: schoolIdObj,
      },
      { $set: updateData },
      { new: true }
    );

    if (!role) {
      return NextResponse.json(
        { success: false, error: "Role definition not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Role definition updated successfully",
      data: {
        id: String(role._id),
        name: role.name,
        code: role.code,
        category: role.category,
        isActive: role.isActive,
      },
    });
  } catch (e: unknown) {
    console.error("Error updating school role definition:", e);
    const message = e instanceof Error ? e.message : "Failed to update role definition";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/school-roles
 * Remove a role assignment OR deactivate a role definition
 * Use ?assignmentId=xxx to remove an assignment
 * Use ?definitionId=xxx to deactivate a definition
 */
export async function DELETE(req: NextRequest) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));
    const url = new URL(req.url);
    const assignmentId = url.searchParams.get("assignmentId");
    const definitionId = url.searchParams.get("definitionId");

    if (!assignmentId && !definitionId) {
      return NextResponse.json(
        { success: false, error: "Either assignmentId or definitionId is required" },
        { status: 400 }
      );
    }

    // Delete/deactivate a role definition
    if (definitionId) {
      // Check if there are active assignments using this role
      const activeAssignments = await SchoolStudentRole.countDocuments({
        schoolId: schoolIdObj,
        roleDefinitionId: new mongoose.Types.ObjectId(definitionId),
        isActive: true,
      });

      if (activeAssignments > 0) {
        return NextResponse.json(
          {
            success: false,
            error: `Cannot delete role: ${activeAssignments} student(s) currently have this role assigned. Remove all assignments first.`,
          },
          { status: 409 }
        );
      }

      const role = await SchoolRoleDefinition.findOneAndUpdate(
        {
          _id: new mongoose.Types.ObjectId(definitionId),
          schoolId: schoolIdObj,
        },
        { $set: { isActive: false } },
        { new: true }
      );

      if (!role) {
        return NextResponse.json(
          { success: false, error: "Role definition not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "Role definition deactivated successfully",
      });
    }

    // Remove an assignment
    const assignment = await SchoolStudentRole.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(assignmentId!),
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
      message: "Role assignment removed successfully",
    });
  } catch (e: unknown) {
    console.error("Error removing school role:", e);
    const message = e instanceof Error ? e.message : "Failed to remove role";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
