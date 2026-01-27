// src/app/api/admin/community/polls/templates/[id]/route.ts
/**
 * Admin API for individual poll template - get, update, delete.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { PollTemplate } from "@/models/PollTemplate";
import mongoose from "mongoose";
import { z } from "zod";

// ============================================================================
// Validation Schemas
// ============================================================================

const TemplateOptionSchema = z.object({
  label: z.string().min(1).max(200),
  imageUrl: z.string().url().optional().nullable(),
  order: z.number().min(0).default(0),
});

const TemplateQuestionSchema = z.object({
  prompt: z.string().min(1).max(500),
  description: z.string().max(1000).optional(),
  type: z.enum(["single_choice", "multi_choice", "ranked_choice", "likert", "yes_no", "comment"]),
  options: z.array(TemplateOptionSchema).optional(),
  required: z.boolean().default(true),
  allowOther: z.boolean().default(false),
  order: z.number().min(0).default(0),
});

const TemplateDefaultsSchema = z.object({
  durationDays: z.number().min(1).max(365).optional(),
  anonymity: z.enum(["anonymous", "identified", "admin_only"]).optional(),
  revealResults: z.enum(["live", "after_close", "admin_only"]).optional(),
  allowComments: z.boolean().optional(),
  minResponseRate: z.number().min(0).max(100).optional(),
  audienceScope: z.enum(["school", "grade", "class", "staff", "parents", "students"]).optional(),
  audienceType: z.enum(["students", "parents", "teachers", "staff", "students_and_parents", "all"]).optional(),
  requiresApproval: z.boolean().optional(),
});

const UpdateTemplateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().min(1).max(500).optional(),
  category: z.enum(["wellbeing", "academic", "decision", "parent", "quick", "election", "feedback", "administrative"]).optional(),
  icon: z.string().max(50).optional(),
  color: z.string().max(50).optional(),
  questions: z.array(TemplateQuestionSchema).min(1).max(20).optional(),
  defaults: TemplateDefaultsSchema.optional(),
  isActive: z.boolean().optional(),
});

// ============================================================================
// GET - Get template details
// ============================================================================

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

    const { id } = await ctx.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: "Invalid template ID" },
        { status: 400 }
      );
    }

    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));
    const templateId = new mongoose.Types.ObjectId(id);

    // Find template (either platform-wide or school-specific)
    const template = await PollTemplate.findOne({
      _id: templateId,
      $or: [
        { schoolId: null },
        { schoolId: schoolIdObj },
      ],
    }).lean();

    if (!template) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: String(template._id),
      name: template.name,
      description: template.description,
      category: template.category,
      icon: template.icon || "vote",
      color: template.color || "violet",
      questions: template.questions,
      defaults: template.defaults,
      isPlatformDefault: template.isPlatformDefault,
      isSchoolSpecific: template.schoolId !== null,
      usageCount: template.usageCount || 0,
      isActive: template.isActive,
      createdAt: new Date(template.createdAt).toISOString(),
      updatedAt: new Date(template.updatedAt).toISOString(),
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Error fetching template:", error);
    return NextResponse.json(
      { error: "Failed to fetch template" },
      { status: 500 }
    );
  }
}

// ============================================================================
// PATCH - Update template (school-specific only)
// ============================================================================

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

    const { id } = await ctx.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: "Invalid template ID" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const parsed = UpdateTemplateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));
    const templateId = new mongoose.Types.ObjectId(id);

    // Find template - only allow updating school-specific templates
    const template = await PollTemplate.findOne({
      _id: templateId,
      schoolId: schoolIdObj,
    });

    if (!template) {
      // Check if it's a platform template
      const platformTemplate = await PollTemplate.findOne({
        _id: templateId,
        schoolId: null,
      });

      if (platformTemplate) {
        return NextResponse.json(
          { error: "Cannot modify platform-wide templates" },
          { status: 403 }
        );
      }

      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    const updates = parsed.data;

    // Check for duplicate name if name is being updated
    if (updates.name && updates.name !== template.name) {
      const existing = await PollTemplate.findOne({
        _id: { $ne: templateId },
        schoolId: schoolIdObj,
        name: { $regex: new RegExp(`^${updates.name}$`, "i") },
      });

      if (existing) {
        return NextResponse.json(
          { error: "A template with this name already exists" },
          { status: 409 }
        );
      }
    }

    // Transform questions with order if provided
    if (updates.questions) {
      updates.questions = updates.questions.map((q, index) => ({
        ...q,
        order: q.order ?? index,
        options: q.options?.map((opt, oIndex) => ({
          ...opt,
          order: opt.order ?? oIndex,
        })),
      }));
    }

    // Update template
    Object.assign(template, updates);
    await template.save();

    return NextResponse.json({
      id: String(template._id),
      message: "Template updated successfully",
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Error updating template:", error);
    return NextResponse.json(
      { error: "Failed to update template" },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE - Delete template (school-specific only)
// ============================================================================

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

    const { id } = await ctx.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: "Invalid template ID" },
        { status: 400 }
      );
    }

    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));
    const templateId = new mongoose.Types.ObjectId(id);

    // Find template - only allow deleting school-specific templates
    const template = await PollTemplate.findOne({
      _id: templateId,
      schoolId: schoolIdObj,
    });

    if (!template) {
      // Check if it's a platform template
      const platformTemplate = await PollTemplate.findOne({
        _id: templateId,
        schoolId: null,
      });

      if (platformTemplate) {
        return NextResponse.json(
          { error: "Cannot delete platform-wide templates" },
          { status: 403 }
        );
      }

      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    await PollTemplate.deleteOne({ _id: templateId });

    return NextResponse.json({
      message: "Template deleted successfully",
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Error deleting template:", error);
    return NextResponse.json(
      { error: "Failed to delete template" },
      { status: 500 }
    );
  }
}
