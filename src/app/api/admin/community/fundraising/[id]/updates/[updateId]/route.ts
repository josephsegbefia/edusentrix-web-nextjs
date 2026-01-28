// src/app/api/admin/community/fundraising/[id]/updates/[updateId]/route.ts
/**
 * Admin API to manage individual campaign update.
 * - PATCH: Update an existing update
 * - DELETE: Delete an update
 */
import { NextRequest, NextResponse } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { FundraisingCampaign } from "@/models/FundraisingCampaign";
import { FundraisingCampaignUpdate } from "@/models/FundraisingCampaignUpdate";
import mongoose from "mongoose";
import { z } from "zod";
import { recordActivity } from "@/lib/audit/recordActivity";

interface RouteContext {
  params: Promise<{ id: string; updateId: string }>;
}

// ============================================================================
// PATCH - Update an update
// ============================================================================

const UpdateUpdateSchema = z.object({
  title: z.string().min(3).max(200).optional(),
  body: z.string().min(10).max(5000).optional(),
  attachments: z.array(z.string().url()).max(10).optional(),
  isPublished: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const adminContext = await requireSchoolAdmin();
    await connectToDatabase();

    void FundraisingCampaign.modelName;
    void FundraisingCampaignUpdate.modelName;

    const { id, updateId } = await context.params;
    const schoolIdObj = new mongoose.Types.ObjectId(String(adminContext.schoolId));
    const campaignIdObj = new mongoose.Types.ObjectId(id);
    const updateIdObj = new mongoose.Types.ObjectId(updateId);

    // Verify update exists
    const existingUpdate = await FundraisingCampaignUpdate.findOne({
      _id: updateIdObj,
      campaignId: campaignIdObj,
      schoolId: schoolIdObj,
    });

    if (!existingUpdate) {
      return NextResponse.json({ error: "Update not found" }, { status: 404 });
    }

    // Get campaign for activity logging
    const campaign = await FundraisingCampaign.findOne({
      _id: campaignIdObj,
      schoolId: schoolIdObj,
    });

    // Parse body
    const body = await req.json();
    const parsed = UpdateUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid update data", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Build update object
    const updateFields: Record<string, unknown> = {};
    if (data.title !== undefined) updateFields.title = data.title;
    if (data.body !== undefined) updateFields.body = data.body;
    if (data.attachments !== undefined) updateFields.attachments = data.attachments;
    if (data.isPublished !== undefined) {
      updateFields.isPublished = data.isPublished;
      // Set publishedAt when first published
      if (data.isPublished && !existingUpdate.publishedAt) {
        updateFields.publishedAt = new Date();
      }
    }

    await FundraisingCampaignUpdate.updateOne(
      { _id: updateIdObj },
      { $set: updateFields }
    );

    // Record activity
    await recordActivity({
      schoolId: String(adminContext.schoolId),
      userId: String(adminContext.userId),
      type: "campaign_update_edited",
      title: "Edited Campaign Update",
      description: `Edited update "${data.title || existingUpdate.title}" on campaign: ${campaign?.title || "Unknown"}`,
      metadata: {
        campaignId: id,
        updateId,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Update modified successfully",
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Error updating campaign update:", error);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

// ============================================================================
// DELETE - Delete an update
// ============================================================================

export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const adminContext = await requireSchoolAdmin();
    await connectToDatabase();

    void FundraisingCampaign.modelName;
    void FundraisingCampaignUpdate.modelName;

    const { id, updateId } = await context.params;
    const schoolIdObj = new mongoose.Types.ObjectId(String(adminContext.schoolId));
    const campaignIdObj = new mongoose.Types.ObjectId(id);
    const updateIdObj = new mongoose.Types.ObjectId(updateId);

    // Verify update exists
    const existingUpdate = await FundraisingCampaignUpdate.findOne({
      _id: updateIdObj,
      campaignId: campaignIdObj,
      schoolId: schoolIdObj,
    });

    if (!existingUpdate) {
      return NextResponse.json({ error: "Update not found" }, { status: 404 });
    }

    // Get campaign for activity logging
    const campaign = await FundraisingCampaign.findOne({
      _id: campaignIdObj,
      schoolId: schoolIdObj,
    });

    // Delete update
    await FundraisingCampaignUpdate.deleteOne({ _id: updateIdObj });

    // Record activity
    await recordActivity({
      schoolId: String(adminContext.schoolId),
      userId: String(adminContext.userId),
      type: "campaign_update_deleted",
      title: "Deleted Campaign Update",
      description: `Deleted update "${existingUpdate.title}" from campaign: ${campaign?.title || "Unknown"}`,
      metadata: {
        campaignId: id,
        updateId,
        updateTitle: existingUpdate.title,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Update deleted successfully",
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Error deleting campaign update:", error);
    return NextResponse.json({ error: "Failed to delete update" }, { status: 500 });
  }
}
