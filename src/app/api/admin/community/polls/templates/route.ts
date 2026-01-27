// src/app/api/admin/community/polls/templates/route.ts
/**
 * Admin API for poll templates - list and create.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { PollTemplate, IPollTemplate, TemplateCategory } from "@/models/PollTemplate";
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
  durationDays: z.number().min(1).max(365).default(7),
  anonymity: z.enum(["anonymous", "identified", "admin_only"]).default("anonymous"),
  revealResults: z.enum(["live", "after_close", "admin_only"]).default("after_close"),
  allowComments: z.boolean().default(false),
  minResponseRate: z.number().min(0).max(100).default(60),
  audienceScope: z.enum(["school", "grade", "class", "staff", "parents", "students"]).default("class"),
  audienceType: z.enum(["students", "parents", "teachers", "staff", "students_and_parents", "all"]).default("students"),
  requiresApproval: z.boolean().default(true),
});

const CreateTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().min(1).max(500),
  category: z.enum(["wellbeing", "academic", "decision", "parent", "quick", "election", "feedback", "administrative"]),
  icon: z.string().max(50).optional(),
  color: z.string().max(50).optional(),
  questions: z.array(TemplateQuestionSchema).min(1).max(20),
  defaults: TemplateDefaultsSchema.optional(),
}).refine((data) => {
  // Validate question options based on type
  for (const q of data.questions) {
    if (["single_choice", "multi_choice", "ranked_choice"].includes(q.type)) {
      if (!q.options || q.options.length < 2) {
        return false;
      }
    }
  }
  return true;
}, {
  message: "Choice questions require at least 2 options",
});

// ============================================================================
// GET - List templates
// ============================================================================

export async function GET(req: NextRequest) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

    void PollTemplate.modelName;

    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));
    const url = new URL(req.url);

    // Query params
    const category = url.searchParams.get("category") as TemplateCategory | null;
    const includeInactive = url.searchParams.get("includeInactive") === "true";

    // Build query: get both platform-wide (schoolId = null) and school-specific templates
    const query: Record<string, unknown> = {
      $or: [
        { schoolId: null }, // Platform-wide templates
        { schoolId: schoolIdObj }, // School-specific templates
      ],
    };

    if (!includeInactive) {
      query.isActive = true;
    }

    if (category) {
      query.category = category;
    }

    // Fetch templates
    const templates = await PollTemplate.find(query)
      .sort({ isPlatformDefault: -1, usageCount: -1, name: 1 })
      .lean();

    // Group by category for better UI
    const data = templates.map((template: any) => ({
      id: String(template._id),
      name: template.name,
      description: template.description,
      category: template.category,
      icon: template.icon || "vote",
      color: template.color || "violet",
      questionCount: template.questions?.length || 0,
      defaults: template.defaults,
      isPlatformDefault: template.isPlatformDefault,
      isSchoolSpecific: template.schoolId !== null,
      usageCount: template.usageCount || 0,
      isActive: template.isActive,
      createdAt: new Date(template.createdAt).toISOString(),
    }));

    // Group by category
    const categories = [
      "wellbeing",
      "academic",
      "decision",
      "parent",
      "quick",
      "election",
      "feedback",
      "administrative",
    ];

    const grouped = categories.reduce((acc, cat) => {
      acc[cat] = data.filter((t: any) => t.category === cat);
      return acc;
    }, {} as Record<string, typeof data>);

    return NextResponse.json({
      data,
      grouped,
      total: templates.length,
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Error fetching templates:", error);
    return NextResponse.json(
      { error: "Failed to fetch templates" },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Create template (school-specific only)
// ============================================================================

export async function POST(req: NextRequest) {
  try {
    const { userId, schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

    const body = await req.json();
    const parsed = CreateTemplateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const {
      name,
      description,
      category,
      icon,
      color,
      questions,
      defaults,
    } = parsed.data;

    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));
    const userIdObj = new mongoose.Types.ObjectId(String(userId));

    // Check for duplicate name in school
    const existing = await PollTemplate.findOne({
      schoolId: schoolIdObj,
      name: { $regex: new RegExp(`^${name}$`, "i") },
    });

    if (existing) {
      return NextResponse.json(
        { error: "A template with this name already exists" },
        { status: 409 }
      );
    }

    // Transform questions with order
    const questionsWithOrder = questions.map((q, index) => ({
      ...q,
      order: q.order ?? index,
      options: q.options?.map((opt, oIndex) => ({
        ...opt,
        order: opt.order ?? oIndex,
      })),
    }));

    const template = await PollTemplate.create({
      schoolId: schoolIdObj,
      name,
      description,
      category,
      icon: icon || "vote",
      color: color || "violet",
      questions: questionsWithOrder,
      defaults: defaults || {},
      isActive: true,
      isPlatformDefault: false,
      usageCount: 0,
      createdBy: userIdObj,
    });

    return NextResponse.json({
      id: String(template._id),
      message: "Template created successfully",
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Error creating template:", error);
    return NextResponse.json(
      { error: "Failed to create template" },
      { status: 500 }
    );
  }
}
