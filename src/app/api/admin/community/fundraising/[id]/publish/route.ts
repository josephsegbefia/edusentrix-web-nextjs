// src/app/api/admin/community/fundraising/[id]/publish/route.ts
/**
 * Publish a campaign - sets status to "live".
 */
import { NextRequest, NextResponse } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { FundraisingCampaign } from "@/models/FundraisingCampaign";
import mongoose from "mongoose";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { schoolId } = await requireSchoolAdmin();
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

    // Can only publish from draft, approved, or paused status
    if (!["draft", "approved", "paused"].includes(campaign.status)) {
      return NextResponse.json(
        { error: `Cannot publish campaign with status "${campaign.status}"` },
        { status: 400 }
      );
    }

    // Check approval status
    if (campaign.approvalStatus === "pending") {
      return NextResponse.json(
        { error: "Campaign requires approval before publishing" },
        { status: 400 }
      );
    }

    if (campaign.approvalStatus === "rejected") {
      return NextResponse.json(
        { error: "Campaign was rejected and cannot be published" },
        { status: 400 }
      );
    }

    const now = new Date();
    const updates: Record<string, unknown> = {
      status: "live",
    };

    if (!campaign.schedule?.startDate) {
      updates["schedule.startDate"] = now;
    }

    await FundraisingCampaign.updateOne({ _id: campaign._id }, { $set: updates });

    return NextResponse.json({ message: "Campaign published successfully" });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Error publishing campaign:", error);
    return NextResponse.json({ error: "Failed to publish campaign" }, { status: 500 });
  }
}
