// src/app/api/admin/community/fundraising/[id]/close/route.ts
/**
 * Close a campaign - sets status to "closed".
 */
import { NextRequest, NextResponse } from "next/server";
import { requireSchoolAdminOrDelegatedAnyPermission } from "@/lib/delegations/requireDelegatedModulePermission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { FundraisingCampaign } from "@/models/FundraisingCampaign";
import mongoose from "mongoose";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { schoolId } = await requireSchoolAdminOrDelegatedAnyPermission([
      "fundraising.close",
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

    // Can only close a live or paused campaign
    if (!["live", "paused"].includes(campaign.status)) {
      return NextResponse.json(
        { error: `Cannot close campaign with status "${campaign.status}"` },
        { status: 400 }
      );
    }

    const now = new Date();

    await FundraisingCampaign.updateOne(
      { _id: campaign._id },
      {
        $set: {
          status: "closed",
          "schedule.endDate": now,
        },
      }
    );

    return NextResponse.json({ message: "Campaign closed successfully" });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Error closing campaign:", error);
    return NextResponse.json({ error: "Failed to close campaign" }, { status: 500 });
  }
}
