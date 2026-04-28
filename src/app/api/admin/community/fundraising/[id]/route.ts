// src/app/api/admin/community/fundraising/[id]/route.ts
/**
 * Admin API for single campaign - get, update, delete.
 */
import { NextRequest, NextResponse } from "next/server";
import {
  requireSchoolAdminOrDelegatedAnyPermission,
  requireSchoolAdminOrDelegatedModuleView,
} from "@/lib/delegations/requireDelegatedModulePermission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { FundraisingCampaign } from "@/models/FundraisingCampaign";
import { FundraisingDonation } from "@/models/FundraisingDonation";
import { User } from "@/models/User";
import mongoose from "mongoose";
import { z } from "zod";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// ============================================================================
// Validation
// ============================================================================

const UpdateCampaignSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  summary: z.string().max(500).optional().nullable(),
  description: z.string().max(5000).optional().nullable(),
  category: z.enum(["school_project", "emergency", "pta_drive", "student_cause", "other"]).optional(),
  coverImageUrl: z.string().url().optional().nullable(),
  galleryUrls: z.array(z.string().url()).max(10).optional(),
  documents: z.array(z.string().url()).max(10).optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
  schedule: z.object({
    startDate: z.string().datetime().optional().nullable(),
    endDate: z.string().datetime().optional().nullable(),
    timezone: z.string().optional(),
  }).optional(),
  audience: z.object({
    scope: z.enum(["school", "grade", "class", "parents", "staff"]).optional(),
    gradeIds: z.array(z.string()).optional(),
    classGroupIds: z.array(z.string()).optional(),
  }).optional(),
  goalAmountMinor: z.number().min(100).optional(),
  milestones: z.array(z.object({
    _id: z.string().optional(),
    label: z.string().min(1).max(100),
    amountMinor: z.number().min(0),
  })).max(10).optional(),
  isRecurringEnabled: z.boolean().optional(),
  allowAnonymousDonations: z.boolean().optional(),
  donorVisibility: z.enum(["public_anonymous", "public_named", "admin_only"]).optional(),
  publicShare: z.object({
    enabled: z.boolean(),
  }).optional(),
});

// ============================================================================
// GET - Single campaign detail
// ============================================================================

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { schoolId } = await requireSchoolAdminOrDelegatedModuleView("fundraising");
    await connectToDatabase();

    void FundraisingCampaign.modelName;
    void User.modelName;

    const { id } = await context.params;
    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));

    const campaign = await FundraisingCampaign.findOne({
      _id: new mongoose.Types.ObjectId(id),
      schoolId: schoolIdObj,
    })
      .populate("createdBy", "firstName lastName email")
      .populate("approvedBy", "firstName lastName")
      .lean();

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    const c = campaign as any;

    return NextResponse.json({
      id: String(c._id),
      title: c.title,
      summary: c.summary || null,
      description: c.description || null,
      category: c.category,
      coverImageUrl: c.coverImageUrl || null,
      galleryUrls: c.galleryUrls || [],
      documents: c.documents || [],
      tags: c.tags || [],
      status: c.status,
      approvalStatus: c.approvalStatus,
      approvalNotes: c.approvalNotes || null,
      schedule: {
        startDate: c.schedule?.startDate ? new Date(c.schedule.startDate).toISOString() : null,
        endDate: c.schedule?.endDate ? new Date(c.schedule.endDate).toISOString() : null,
        timezone: c.schedule?.timezone || "UTC",
      },
      audience: c.audience,
      goalAmountMinor: c.goalAmountMinor,
      raisedAmountMinor: c.raisedAmountMinor || 0,
      donorCount: c.donorCount || 0,
      currency: c.currency,
      progressPercent: c.goalAmountMinor > 0
        ? Math.min(Math.round(((c.raisedAmountMinor || 0) / c.goalAmountMinor) * 100), 100)
        : 0,
      milestones: (c.milestones || []).map((m: any) => ({
        id: String(m._id),
        label: m.label,
        amountMinor: m.amountMinor,
        reachedAt: m.reachedAt ? new Date(m.reachedAt).toISOString() : null,
      })),
      matchingRules: (c.matchingRules || []).map((r: any) => ({
        id: String(r._id),
        matcherName: r.matcherName,
        matchPercent: r.matchPercent,
        capMinor: r.capMinor || null,
      })),
      isRecurringEnabled: c.isRecurringEnabled || false,
      publicShare: c.publicShare,
      allowAnonymousDonations: c.allowAnonymousDonations,
      donorVisibility: c.donorVisibility,
      createdBy: c.createdBy
        ? {
            id: String(c.createdBy._id),
            name: `${c.createdBy.firstName} ${c.createdBy.lastName}`.trim(),
            email: c.createdBy.email,
          }
        : null,
      createdByRole: c.createdByRole,
      approvedBy: c.approvedBy
        ? {
            id: String(c.approvedBy._id),
            name: `${c.approvedBy.firstName} ${c.approvedBy.lastName}`.trim(),
          }
        : null,
      approvedAt: c.approvedAt ? new Date(c.approvedAt).toISOString() : null,
      createdAt: new Date(c.createdAt).toISOString(),
      updatedAt: new Date(c.updatedAt).toISOString(),
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Error fetching campaign:", error);
    return NextResponse.json({ error: "Failed to fetch campaign" }, { status: 500 });
  }
}

// ============================================================================
// PATCH - Update campaign
// ============================================================================

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const { schoolId } = await requireSchoolAdminOrDelegatedAnyPermission([
      "fundraising.edit",
    ]);
    await connectToDatabase();

    const { id } = await context.params;
    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));

    const campaign = await FundraisingCampaign.findOne({
      _id: new mongoose.Types.ObjectId(id),
      schoolId: schoolIdObj,
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    // Cannot edit reconciled or archived campaigns
    if (["reconciled", "archived"].includes(campaign.status)) {
      return NextResponse.json(
        { error: "Cannot edit a reconciled or archived campaign" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const parsed = UpdateCampaignSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const updates: Record<string, unknown> = {};
    const data = parsed.data;

    if (data.title !== undefined) updates.title = data.title;
    if (data.summary !== undefined) updates.summary = data.summary;
    if (data.description !== undefined) updates.description = data.description;
    if (data.category !== undefined) updates.category = data.category;
    if (data.coverImageUrl !== undefined) updates.coverImageUrl = data.coverImageUrl;
    if (data.galleryUrls !== undefined) updates.galleryUrls = data.galleryUrls;
    if (data.documents !== undefined) updates.documents = data.documents;
    if (data.tags !== undefined) updates.tags = data.tags;
    if (data.isRecurringEnabled !== undefined) updates.isRecurringEnabled = data.isRecurringEnabled;
    if (data.allowAnonymousDonations !== undefined) updates.allowAnonymousDonations = data.allowAnonymousDonations;
    if (data.donorVisibility !== undefined) updates.donorVisibility = data.donorVisibility;

    // Only allow goal change for draft/pending campaigns
    if (data.goalAmountMinor !== undefined) {
      if (!["draft", "pending_approval", "approved"].includes(campaign.status)) {
        return NextResponse.json(
          { error: "Cannot change goal for live/closed campaigns" },
          { status: 400 }
        );
      }
      updates.goalAmountMinor = data.goalAmountMinor;
    }

    if (data.schedule) {
      updates.schedule = {
        startDate: data.schedule.startDate
          ? new Date(data.schedule.startDate)
          : campaign.schedule?.startDate,
        endDate: data.schedule.endDate
          ? new Date(data.schedule.endDate)
          : campaign.schedule?.endDate,
        timezone: data.schedule.timezone || campaign.schedule?.timezone || "UTC",
      };
    }

    if (data.audience) {
      updates.audience = {
        scope: data.audience.scope || campaign.audience.scope,
        gradeIds: data.audience.gradeIds?.map((id) => new mongoose.Types.ObjectId(id)) || campaign.audience.gradeIds,
        classGroupIds: data.audience.classGroupIds?.map((id) => new mongoose.Types.ObjectId(id)) || campaign.audience.classGroupIds,
      };
    }

    if (data.milestones) {
      updates.milestones = data.milestones.map((m) => ({
        _id: m._id ? new mongoose.Types.ObjectId(m._id) : new mongoose.Types.ObjectId(),
        label: m.label,
        amountMinor: m.amountMinor,
        reachedAt: null,
      }));
    }

    if (data.publicShare !== undefined) {
      if (data.publicShare.enabled && !campaign.publicShare?.token) {
        // Generate token
        const crypto = await import("crypto");
        updates.publicShare = {
          enabled: true,
          token: crypto.randomBytes(16).toString("hex"),
          expiresAt: null,
        };
      } else if (!data.publicShare.enabled) {
        updates.publicShare = {
          enabled: false,
          token: null,
          expiresAt: null,
        };
      }
    }

    await FundraisingCampaign.updateOne({ _id: campaign._id }, { $set: updates });

    return NextResponse.json({ message: "Campaign updated successfully" });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Error updating campaign:", error);
    return NextResponse.json({ error: "Failed to update campaign" }, { status: 500 });
  }
}

// ============================================================================
// DELETE - Delete campaign (only draft/pending)
// ============================================================================

export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const { schoolId } = await requireSchoolAdminOrDelegatedAnyPermission([
      "fundraising.edit",
    ]);
    await connectToDatabase();

    const { id } = await context.params;
    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));
    const campaignIdObj = new mongoose.Types.ObjectId(id);

    const campaign = await FundraisingCampaign.findOne({
      _id: campaignIdObj,
      schoolId: schoolIdObj,
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    // Only allow deletion of draft or pending campaigns
    if (!["draft", "pending_approval"].includes(campaign.status)) {
      return NextResponse.json(
        { error: "Only draft or pending campaigns can be deleted" },
        { status: 400 }
      );
    }

    // Check for any donations
    const donationCount = await FundraisingDonation.countDocuments({ campaignId: campaignIdObj });
    if (donationCount > 0) {
      return NextResponse.json(
        { error: "Cannot delete campaign with existing donations" },
        { status: 400 }
      );
    }

    await FundraisingCampaign.deleteOne({ _id: campaignIdObj });

    return NextResponse.json({ message: "Campaign deleted successfully" });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Error deleting campaign:", error);
    return NextResponse.json({ error: "Failed to delete campaign" }, { status: 500 });
  }
}
