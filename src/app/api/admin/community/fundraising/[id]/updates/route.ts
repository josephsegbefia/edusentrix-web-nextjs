// src/app/api/admin/community/fundraising/[id]/updates/route.ts
/**
 * Admin API to manage campaign updates.
 * - GET: List all updates for a campaign
 * - POST: Create a new update
 */
import { NextRequest, NextResponse } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { FundraisingCampaign, IFundraisingCampaign } from "@/models/FundraisingCampaign";
import { FundraisingCampaignUpdate, IFundraisingCampaignUpdate } from "@/models/FundraisingCampaignUpdate";
import mongoose from "mongoose";
import { z } from "zod";
import { recordActivity } from "@/lib/audit/recordActivity";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// Populated update type (after .populate('createdBy'))
interface PopulatedUpdate {
  _id: mongoose.Types.ObjectId;
  campaignId: mongoose.Types.ObjectId;
  schoolId: mongoose.Types.ObjectId;
  createdBy: { _id: mongoose.Types.ObjectId; name: string; email: string } | null;
  title: string;
  body: string;
  attachments?: string[];
  isPublished: boolean;
  publishedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// GET - List updates
// ============================================================================

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const adminContext = await requireSchoolAdmin();
    await connectToDatabase();

    void FundraisingCampaign.modelName;
    void FundraisingCampaignUpdate.modelName;

    const { id } = await context.params;
    const schoolIdObj = new mongoose.Types.ObjectId(String(adminContext.schoolId));
    const campaignIdObj = new mongoose.Types.ObjectId(id);

    // Verify campaign exists
    const campaign = await FundraisingCampaign.findOne({
      _id: campaignIdObj,
      schoolId: schoolIdObj,
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    // Get updates
    const updateDocs = await FundraisingCampaignUpdate.find({
      campaignId: campaignIdObj,
      schoolId: schoolIdObj,
    })
      .sort({ createdAt: -1 })
      .populate<{ createdBy: { _id: mongoose.Types.ObjectId; name: string; email: string } | null }>(
        "createdBy",
        "name email"
      );

    const updates = updateDocs.map((u) => {
      const update = u.toObject() as unknown as PopulatedUpdate;
      return {
        id: String(update._id),
        title: update.title,
        body: update.body,
        attachments: update.attachments || [],
        isPublished: update.isPublished,
        publishedAt: update.publishedAt ? new Date(update.publishedAt).toISOString() : null,
        createdBy: update.createdBy
          ? {
              id: String(update.createdBy._id),
              name: update.createdBy.name,
              email: update.createdBy.email,
            }
          : null,
        createdAt: new Date(update.createdAt).toISOString(),
        updatedAt: new Date(update.updatedAt).toISOString(),
      };
    });

    return NextResponse.json({ data: updates });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Error fetching campaign updates:", error);
    return NextResponse.json({ error: "Failed to fetch updates" }, { status: 500 });
  }
}

// ============================================================================
// POST - Create update
// ============================================================================

const CreateUpdateSchema = z.object({
  title: z.string().min(3).max(200),
  body: z.string().min(10).max(5000),
  attachments: z.array(z.string().url()).max(10).optional(),
  isPublished: z.boolean().default(true),
});

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const adminContext = await requireSchoolAdmin();
    await connectToDatabase();

    void FundraisingCampaign.modelName;
    void FundraisingCampaignUpdate.modelName;

    const { id } = await context.params;
    const schoolIdObj = new mongoose.Types.ObjectId(String(adminContext.schoolId));
    const campaignIdObj = new mongoose.Types.ObjectId(id);

    // Verify campaign exists
    const campaign = await FundraisingCampaign.findOne({
      _id: campaignIdObj,
      schoolId: schoolIdObj,
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    // Parse body
    const body = await req.json();
    const parsed = CreateUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid update data", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Create update
    const update = await FundraisingCampaignUpdate.create({
      campaignId: campaignIdObj,
      schoolId: schoolIdObj,
      createdBy: new mongoose.Types.ObjectId(String(adminContext.userId)),
      title: data.title,
      body: data.body,
      attachments: data.attachments || [],
      isPublished: data.isPublished,
      publishedAt: data.isPublished ? new Date() : null,
    });

    // Record activity
    await recordActivity({
      schoolId: String(adminContext.schoolId),
      userId: String(adminContext.userId),
      type: "campaign.update_posted",
      description: `Posted update "${data.title}" to campaign: ${campaign.title}`,
      metadata: {
        campaignId: id,
        campaignTitle: campaign.title,
        updateId: String(update._id),
        updateTitle: data.title,
      },
    });

    return NextResponse.json({
      success: true,
      id: String(update._id),
      message: "Update posted successfully",
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Error creating campaign update:", error);
    return NextResponse.json({ error: "Failed to create update" }, { status: 500 });
  }
}
