// src/app/api/admin/community/fundraising/[id]/share/route.ts
/**
 * Admin API to manage public sharing for a campaign.
 * - GET: Get current share settings and token
 * - POST: Enable sharing and generate/regenerate token
 * - DELETE: Disable public sharing
 */
import { NextRequest, NextResponse } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { FundraisingCampaign, IFundraisingCampaign } from "@/models/FundraisingCampaign";
import mongoose from "mongoose";
import crypto from "crypto";
import { recordActivity } from "@/lib/audit/recordActivity";
import { getBaseUrlFromRequest } from "@/lib/utils/getBaseUrl";
import { z } from "zod";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// ============================================================================
// GET - Get share settings
// ============================================================================

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const adminContext = await requireSchoolAdmin();
    await connectToDatabase();

    void FundraisingCampaign.modelName;

    const { id } = await context.params;
    const schoolIdObj = new mongoose.Types.ObjectId(String(adminContext.schoolId));
    const campaignIdObj = new mongoose.Types.ObjectId(id);

    const campaignDoc = await FundraisingCampaign.findOne({
      _id: campaignIdObj,
      schoolId: schoolIdObj,
    });

    if (!campaignDoc) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    const campaign = campaignDoc.toObject() as IFundraisingCampaign;

    // Build the public URL dynamically
    const baseUrl = getBaseUrlFromRequest(req.headers);
    const shareUrl = campaign.publicShare?.token
      ? `${baseUrl}/donate/${campaign.publicShare.token}`
      : null;

    return NextResponse.json({
      enabled: campaign.publicShare?.enabled || false,
      token: campaign.publicShare?.token || null,
      expiresAt: campaign.publicShare?.expiresAt
        ? new Date(campaign.publicShare.expiresAt).toISOString()
        : null,
      shareUrl,
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Error fetching share settings:", error);
    return NextResponse.json({ error: "Failed to fetch share settings" }, { status: 500 });
  }
}

// ============================================================================
// POST - Enable sharing / Regenerate token
// ============================================================================

const ShareSettingsSchema = z.object({
  regenerate: z.boolean().default(false),
  expiresInDays: z.number().min(1).max(365).optional(),
});

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const adminContext = await requireSchoolAdmin();
    await connectToDatabase();

    void FundraisingCampaign.modelName;

    const { id } = await context.params;
    const schoolIdObj = new mongoose.Types.ObjectId(String(adminContext.schoolId));
    const campaignIdObj = new mongoose.Types.ObjectId(id);

    const body = await req.json();
    const parsed = ShareSettingsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid settings", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { regenerate, expiresInDays } = parsed.data;

    const campaign = await FundraisingCampaign.findOne({
      _id: campaignIdObj,
      schoolId: schoolIdObj,
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    // Only allow sharing for live campaigns
    if (campaign.status !== "live") {
      return NextResponse.json(
        { error: "Only live campaigns can be shared publicly" },
        { status: 400 }
      );
    }

    // Generate or regenerate token
    const shouldGenerateToken = !campaign.publicShare?.token || regenerate;
    const newToken = shouldGenerateToken
      ? crypto.randomBytes(16).toString("hex")
      : campaign.publicShare?.token;

    // Calculate expiry
    let expiresAt: Date | null = null;
    if (expiresInDays) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);
    }

    await FundraisingCampaign.updateOne(
      { _id: campaignIdObj },
      {
        $set: {
          "publicShare.enabled": true,
          "publicShare.token": newToken,
          "publicShare.expiresAt": expiresAt,
        },
      }
    );

    // Record activity
    await recordActivity({
      schoolId: String(adminContext.schoolId),
      userId: String(adminContext.userId),
      type: "campaign.shared",
      description: `${regenerate ? "Regenerated" : "Enabled"} public donation link for campaign: ${campaign.title}`,
      metadata: {
        campaignId: id,
        campaignTitle: campaign.title,
        regenerated: regenerate,
      },
    });

    const baseUrl = getBaseUrlFromRequest(req.headers);
    const shareUrl = `${baseUrl}/donate/${newToken}`;

    return NextResponse.json({
      success: true,
      enabled: true,
      token: newToken,
      expiresAt: expiresAt ? expiresAt.toISOString() : null,
      shareUrl,
      message: regenerate ? "Share link regenerated" : "Public sharing enabled",
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Error enabling sharing:", error);
    return NextResponse.json({ error: "Failed to enable sharing" }, { status: 500 });
  }
}

// ============================================================================
// DELETE - Disable public sharing
// ============================================================================

export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const adminContext = await requireSchoolAdmin();
    await connectToDatabase();

    void FundraisingCampaign.modelName;

    const { id } = await context.params;
    const schoolIdObj = new mongoose.Types.ObjectId(String(adminContext.schoolId));
    const campaignIdObj = new mongoose.Types.ObjectId(id);

    const campaign = await FundraisingCampaign.findOne({
      _id: campaignIdObj,
      schoolId: schoolIdObj,
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    await FundraisingCampaign.updateOne(
      { _id: campaignIdObj },
      {
        $set: {
          "publicShare.enabled": false,
          "publicShare.token": null,
          "publicShare.expiresAt": null,
        },
      }
    );

    // Record activity
    await recordActivity({
      schoolId: String(adminContext.schoolId),
      userId: String(adminContext.userId),
      type: "campaign.unshared",
      description: `Disabled public donation link for campaign: ${campaign.title}`,
      metadata: {
        campaignId: id,
        campaignTitle: campaign.title,
      },
    });

    return NextResponse.json({
      success: true,
      enabled: false,
      message: "Public sharing disabled",
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Error disabling sharing:", error);
    return NextResponse.json({ error: "Failed to disable sharing" }, { status: 500 });
  }
}
