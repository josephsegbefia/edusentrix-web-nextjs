// src/app/api/admin/community/fundraising/[id]/pause/route.ts
/**
 * Pause a campaign - sets status to "paused".
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

    // Can only pause a live campaign
    if (campaign.status !== "live") {
      return NextResponse.json(
        { error: `Cannot pause campaign with status "${campaign.status}"` },
        { status: 400 }
      );
    }

    await FundraisingCampaign.updateOne(
      { _id: campaign._id },
      { $set: { status: "paused" } }
    );

    return NextResponse.json({ message: "Campaign paused successfully" });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Error pausing campaign:", error);
    return NextResponse.json({ error: "Failed to pause campaign" }, { status: 500 });
  }
}
