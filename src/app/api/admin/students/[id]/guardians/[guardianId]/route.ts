// src/app/api/admin/students/[id]/guardians/[guardianId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Student } from "@/models/Student";
import { Guardian } from "@/models/Guardian";
import { User } from "@/models/User";
import { UserMembership } from "@/models/UserMembership";
import { recordActivity } from "@/lib/audit/recordActivity";
import mongoose from "mongoose";
import { z } from "zod";

const UpdateGuardianSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phone: z.string().optional().nullable(),
  relationship: z
    .enum([
      "mother",
      "father",
      "guardian",
      "step_mother",
      "step_father",
      "grandmother",
      "grandfather",
      "aunt",
      "uncle",
      "other",
    ])
    .optional(),
  occupation: z.string().optional().nullable(),
  photoUrl: z.string().url().optional().nullable(),
  isPrimary: z.boolean().optional(),
});

// PATCH - Update guardian
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; guardianId: string }> }
) {
  try {
    const { schoolId, userId } = await requireSchoolAdmin();
    await connectToDatabase();

    if (!schoolId) {
      return NextResponse.json(
        { success: false, error: "School ID not found" },
        { status: 400 }
      );
    }

    const schoolIdObj =
      schoolId instanceof mongoose.Types.ObjectId
        ? schoolId
        : new mongoose.Types.ObjectId(String(schoolId));

    const { id, guardianId } = await ctx.params;

    if (
      !mongoose.Types.ObjectId.isValid(id) ||
      !mongoose.Types.ObjectId.isValid(guardianId)
    ) {
      return NextResponse.json(
        { success: false, error: "Invalid ID" },
        { status: 400 }
      );
    }

    // Verify student belongs to admin's school
    const student = await Student.findOne({
      _id: new mongoose.Types.ObjectId(id),
      schoolId: schoolIdObj,
    }).lean();

    if (!student) {
      return NextResponse.json(
        { success: false, error: "Student not found" },
        { status: 404 }
      );
    }

    // Find guardian
    const guardianRaw = await Guardian.findOne({
      _id: new mongoose.Types.ObjectId(guardianId),
      studentId: new mongoose.Types.ObjectId(id),
    }).lean();

    // Normalize guardian (findOne().lean() can be inferred as array by TypeScript)
    const guardian = (
      Array.isArray(guardianRaw) ? guardianRaw[0] || null : guardianRaw
    ) as any;

    if (!guardian) {
      return NextResponse.json(
        { success: false, error: "Guardian not found" },
        { status: 404 }
      );
    }

    const body = await req.json();
    const validated = UpdateGuardianSchema.parse(body);

    const studentIdObj = new mongoose.Types.ObjectId(id);
    const guardianIdObj = new mongoose.Types.ObjectId(guardianId);
    const userIdObj =
      guardian.userId instanceof mongoose.Types.ObjectId
        ? guardian.userId
        : new mongoose.Types.ObjectId(String(guardian.userId));

    // Handle primary guardian change
    if (validated.isPrimary === true) {
      await Guardian.updateMany(
        {
          studentId: studentIdObj,
          _id: { $ne: guardianIdObj },
          isPrimary: true,
        },
        { $set: { isPrimary: false } }
      );
    }

    // Update guardian record
    const updateData: any = {};
    if (validated.relationship !== undefined)
      updateData.relationship = validated.relationship;
    if (validated.occupation !== undefined)
      updateData.occupation = validated.occupation?.trim() || null;
    if (validated.phone !== undefined)
      updateData.phone = validated.phone?.trim() || null;
    if (validated.photoUrl !== undefined)
      updateData.photoUrl = validated.photoUrl || null;
    if (validated.isPrimary !== undefined)
      updateData.isPrimary = validated.isPrimary;

    if (Object.keys(updateData).length > 0) {
      await Guardian.updateOne({ _id: guardianIdObj }, { $set: updateData });
    }

    // Update user record if name/photo changed
    const userUpdateData: any = {};
    if (validated.firstName) userUpdateData.firstName = validated.firstName.trim();
    if (validated.lastName) userUpdateData.lastName = validated.lastName.trim();
    if (validated.phone !== undefined)
      userUpdateData.phone = validated.phone?.trim() || undefined;
    if (validated.photoUrl !== undefined)
      userUpdateData.avatarUrl = validated.photoUrl || undefined;

    if (Object.keys(userUpdateData).length > 0) {
      await User.updateOne({ _id: userIdObj }, { $set: userUpdateData });
    }

    // Record activity
    await recordActivity({
      schoolId: schoolIdObj,
      userId: new mongoose.Types.ObjectId(userId),
      type: "guardian.updated",
      entityType: "student",
      entityId: String(studentIdObj),
      description: `Updated guardian information`,
      metadata: {
        guardianId: String(guardianIdObj),
        studentId: String(studentIdObj),
      },
    });

    // Fetch updated guardian
    const updatedGuardianRaw = await Guardian.findById(guardianIdObj)
      .populate("userId", "firstName lastName email avatarUrl")
      .lean();

    // Normalize updatedGuardian (findById().lean() can be inferred as array by TypeScript)
    const updatedGuardian = (
      Array.isArray(updatedGuardianRaw) ? updatedGuardianRaw[0] || null : updatedGuardianRaw
    ) as any;

    if (!updatedGuardian) {
      return NextResponse.json(
        { success: false, error: "Guardian not found after update" },
        { status: 404 }
      );
    }

    const user = updatedGuardian.userId as any;

    return NextResponse.json({
      success: true,
      data: {
        id: String(updatedGuardian._id),
        userId: String(user._id),
        fullName: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
        relationship: (updatedGuardian as any).relationship,
        phone: (updatedGuardian as any).phone || "",
        email: (updatedGuardian as any).email || user.email || "",
        occupation: (updatedGuardian as any).occupation || null,
        photoUrl:
          (updatedGuardian as any).photoUrl || user.avatarUrl || null,
        isPrimary: (updatedGuardian as any).isPrimary,
        createdAt: (updatedGuardian as any).createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Failed to update guardian:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation error",
          details: error.issues,
        },
        { status: 400 }
      );
    }
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to update guardian",
      },
      { status: 500 }
    );
  }
}

// DELETE - Remove guardian
export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; guardianId: string }> }
) {
  try {
    const { schoolId, userId } = await requireSchoolAdmin();
    await connectToDatabase();

    if (!schoolId) {
      return NextResponse.json(
        { success: false, error: "School ID not found" },
        { status: 400 }
      );
    }

    const schoolIdObj =
      schoolId instanceof mongoose.Types.ObjectId
        ? schoolId
        : new mongoose.Types.ObjectId(String(schoolId));

    const { id, guardianId } = await ctx.params;

    if (
      !mongoose.Types.ObjectId.isValid(id) ||
      !mongoose.Types.ObjectId.isValid(guardianId)
    ) {
      return NextResponse.json(
        { success: false, error: "Invalid ID" },
        { status: 400 }
      );
    }

    // Verify student belongs to admin's school
    const student = await Student.findOne({
      _id: new mongoose.Types.ObjectId(id),
      schoolId: schoolIdObj,
    }).lean();

    if (!student) {
      return NextResponse.json(
        { success: false, error: "Student not found" },
        { status: 404 }
      );
    }

    // Find guardian
    const guardianRaw = await Guardian.findOne({
      _id: new mongoose.Types.ObjectId(guardianId),
      studentId: new mongoose.Types.ObjectId(id),
    }).lean();

    // Normalize guardian (findOne().lean() can be inferred as array by TypeScript)
    const guardian = (
      Array.isArray(guardianRaw) ? guardianRaw[0] || null : guardianRaw
    ) as any;

    if (!guardian) {
      return NextResponse.json(
        { success: false, error: "Guardian not found" },
        { status: 404 }
      );
    }

    const studentIdObj = new mongoose.Types.ObjectId(id);
    const guardianIdObj = new mongoose.Types.ObjectId(guardianId);
    const userIdObj =
      guardian.userId instanceof mongoose.Types.ObjectId
        ? guardian.userId
        : new mongoose.Types.ObjectId(String(guardian.userId));

    // Delete guardian relationship
    await Guardian.deleteOne({ _id: guardianIdObj });

    // Check if user has other students linked
    const otherGuardians = await Guardian.countDocuments({
      userId: userIdObj,
      _id: { $ne: guardianIdObj },
    });

    // If no other students, remove UserMembership and optionally delete user
    if (otherGuardians === 0) {
      await UserMembership.deleteOne({
        userId: userIdObj,
        schoolId: schoolIdObj,
      });

      // Optionally delete user account if they have no other relationships
      // Check if user has any other roles/memberships
      const otherMemberships = await UserMembership.countDocuments({
        userId: userIdObj,
      });

      const user = await User.findById(userIdObj).lean();
      const hasOtherRole =
        user && (user as any).role && (user as any).role !== "parent";

      // Only delete if no other memberships and no other role
      if (otherMemberships === 0 && !hasOtherRole) {
        // Note: We don't delete Clerk user, just the local User record
        // Clerk user deletion should be handled separately if needed
        await User.deleteOne({ _id: userIdObj });
      }
    }

    // Record activity
    await recordActivity({
      schoolId: schoolIdObj,
      userId: new mongoose.Types.ObjectId(userId),
      type: "guardian.removed",
      entityType: "student",
      entityId: String(studentIdObj),
      description: `Removed guardian from student`,
      metadata: {
        guardianId: String(guardianIdObj),
        studentId: String(studentIdObj),
      },
    });

    return NextResponse.json({
      success: true,
      message: "Guardian removed successfully",
    });
  } catch (error) {
    console.error("Failed to remove guardian:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to remove guardian",
      },
      { status: 500 }
    );
  }
}
