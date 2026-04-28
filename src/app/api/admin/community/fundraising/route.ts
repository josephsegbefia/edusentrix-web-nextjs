// src/app/api/admin/community/fundraising/route.ts
/**
 * Admin API for fundraising campaigns - list and create.
 */
import { NextRequest, NextResponse } from "next/server";
import {
  requireSchoolAdminOrDelegatedAnyPermission,
  requireSchoolAdminOrDelegatedModuleView,
} from "@/lib/delegations/requireDelegatedModulePermission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { FundraisingCampaign, CampaignStatus } from "@/models/FundraisingCampaign";
import { User } from "@/models/User";
import mongoose from "mongoose";
import { z } from "zod";
import crypto from "crypto";

// ============================================================================
// Validation Schemas
// ============================================================================

const MilestoneSchema = z.object({
  label: z.string().min(1).max(100),
  amountMinor: z.number().min(0),
});

const MatchingRuleSchema = z.object({
  matcherName: z.string().min(1).max(100),
  matchPercent: z.number().min(0).max(100),
  capMinor: z.number().min(0).optional(),
});

const CreateCampaignSchema = z.object({
  title: z.string().min(1).max(200),
  summary: z.string().max(500).optional(),
  description: z.string().max(5000).optional(),
  category: z.enum(["school_project", "emergency", "pta_drive", "student_cause", "other"]).default("other"),
  coverImageUrl: z.string().url().optional().nullable(),
  galleryUrls: z.array(z.string().url()).max(10).optional(),
  documents: z.array(z.string().url()).max(10).optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
  schedule: z.object({
    startDate: z.string().datetime().optional().nullable(),
    endDate: z.string().datetime().optional().nullable(),
    timezone: z.string().default("UTC"),
  }).optional(),
  audience: z.object({
    scope: z.enum(["school", "grade", "class", "parents", "staff"]),
    gradeIds: z.array(z.string()).optional(),
    classGroupIds: z.array(z.string()).optional(),
  }),
  goalAmountMinor: z.number().min(100), // At least 1 GHS/USD
  currency: z.enum(["GHS", "USD", "NGN", "KES", "ZAR", "GBP", "EUR"]).default("GHS"),
  milestones: z.array(MilestoneSchema).max(10).optional(),
  matchingRules: z.array(MatchingRuleSchema).max(5).optional(),
  isRecurringEnabled: z.boolean().default(false),
  allowAnonymousDonations: z.boolean().default(true),
  donorVisibility: z.enum(["public_anonymous", "public_named", "admin_only"]).default("public_anonymous"),
  publicShare: z.object({
    enabled: z.boolean().default(false),
  }).optional(),
}).refine((data) => {
  // Validate schedule dates
  if (data.schedule?.startDate && data.schedule?.endDate) {
    return new Date(data.schedule.endDate) >= new Date(data.schedule.startDate);
  }
  return true;
}, {
  message: "End date must be after start date",
});

// ============================================================================
// GET - List campaigns
// ============================================================================

export async function GET(req: NextRequest) {
  try {
    const { schoolId } = await requireSchoolAdminOrDelegatedModuleView("fundraising");
    await connectToDatabase();

    void FundraisingCampaign.modelName;
    void User.modelName;

    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));
    const url = new URL(req.url);

    // Query params
    const status = url.searchParams.get("status") as CampaignStatus | null;
    const category = url.searchParams.get("category");
    const limit = Math.min(Number(url.searchParams.get("limit")) || 50, 100);
    const skip = Number(url.searchParams.get("skip")) || 0;

    // Build query
    const query: Record<string, unknown> = { schoolId: schoolIdObj };
    if (status) query.status = status;
    if (category) query.category = category;

    // Fetch campaigns
    const [campaigns, total] = await Promise.all([
      FundraisingCampaign.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("createdBy", "firstName lastName email")
        .populate("approvedBy", "firstName lastName")
        .lean(),
      FundraisingCampaign.countDocuments(query),
    ]);

    // Transform response
    const data = campaigns.map((c: any) => ({
      id: String(c._id),
      title: c.title,
      summary: c.summary || null,
      category: c.category,
      status: c.status,
      approvalStatus: c.approvalStatus,
      coverImageUrl: c.coverImageUrl || null,
      goalAmountMinor: c.goalAmountMinor,
      raisedAmountMinor: c.raisedAmountMinor || 0,
      donorCount: c.donorCount || 0,
      currency: c.currency,
      progressPercent: c.goalAmountMinor > 0
        ? Math.min(Math.round(((c.raisedAmountMinor || 0) / c.goalAmountMinor) * 100), 100)
        : 0,
      audience: c.audience,
      schedule: c.schedule,
      donorVisibility: c.donorVisibility,
      allowAnonymousDonations: c.allowAnonymousDonations,
      publicShare: c.publicShare,
      tags: c.tags || [],
      createdBy: c.createdBy
        ? {
            id: String(c.createdBy._id),
            name: `${c.createdBy.firstName} ${c.createdBy.lastName}`.trim(),
            email: c.createdBy.email,
          }
        : null,
      createdByRole: c.createdByRole,
      createdAt: new Date(c.createdAt).toISOString(),
      updatedAt: new Date(c.updatedAt).toISOString(),
    }));

    return NextResponse.json({
      data,
      pagination: {
        total,
        limit,
        skip,
        hasMore: skip + campaigns.length < total,
      },
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Error fetching campaigns:", error);
    return NextResponse.json({ error: "Failed to fetch campaigns" }, { status: 500 });
  }
}

// ============================================================================
// POST - Create campaign
// ============================================================================

export async function POST(req: NextRequest) {
  try {
    const { userId, schoolId } = await requireSchoolAdminOrDelegatedAnyPermission([
      "fundraising.create",
    ]);
    await connectToDatabase();

    const body = await req.json();
    const parsed = CreateCampaignSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));
    const userIdObj = new mongoose.Types.ObjectId(String(userId));

    const {
      title,
      summary,
      description,
      category,
      coverImageUrl,
      galleryUrls,
      documents,
      tags,
      schedule,
      audience,
      goalAmountMinor,
      currency,
      milestones,
      matchingRules,
      isRecurringEnabled,
      allowAnonymousDonations,
      donorVisibility,
      publicShare,
    } = parsed.data;

    // Transform audience with ObjectIds
    const audienceTransformed = {
      scope: audience.scope,
      gradeIds: audience.gradeIds?.map((id) => new mongoose.Types.ObjectId(id)),
      classGroupIds: audience.classGroupIds?.map((id) => new mongoose.Types.ObjectId(id)),
    };

    // Transform schedule
    const scheduleTransformed = {
      startDate: schedule?.startDate ? new Date(schedule.startDate) : null,
      endDate: schedule?.endDate ? new Date(schedule.endDate) : null,
      timezone: schedule?.timezone || "UTC",
    };

    // Transform milestones
    const milestonesTransformed = milestones?.map((m) => ({
      _id: new mongoose.Types.ObjectId(),
      label: m.label,
      amountMinor: m.amountMinor,
      reachedAt: null,
    }));

    // Transform matching rules
    const matchingRulesTransformed = matchingRules?.map((r) => ({
      _id: new mongoose.Types.ObjectId(),
      matcherName: r.matcherName,
      matchPercent: r.matchPercent,
      capMinor: r.capMinor,
    }));

    // Generate public share token if enabled
    const publicShareTransformed = {
      enabled: publicShare?.enabled || false,
      token: publicShare?.enabled ? crypto.randomBytes(16).toString("hex") : null,
      expiresAt: null,
    };

    // School-wide campaigns by admins don't need approval
    const isSchoolWide = audience.scope === "school";

    const campaign = await FundraisingCampaign.create({
      schoolId: schoolIdObj,
      title,
      summary,
      description,
      category,
      coverImageUrl: coverImageUrl || null,
      galleryUrls: galleryUrls || [],
      documents: documents || [],
      tags: tags || [],
      status: "draft",
      approvalStatus: isSchoolWide ? "not_required" : "not_required",
      createdBy: userIdObj,
      createdByRole: "school_admin",
      schedule: scheduleTransformed,
      audience: audienceTransformed,
      goalAmountMinor,
      currency,
      raisedAmountMinor: 0,
      donorCount: 0,
      milestones: milestonesTransformed || [],
      matchingRules: matchingRulesTransformed || [],
      isRecurringEnabled,
      publicShare: publicShareTransformed,
      allowAnonymousDonations,
      donorVisibility,
    });

    return NextResponse.json({
      id: String(campaign._id),
      message: "Campaign created successfully",
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Error creating campaign:", error);
    return NextResponse.json({ error: "Failed to create campaign" }, { status: 500 });
  }
}
