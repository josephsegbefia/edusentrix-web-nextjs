// src/app/api/admin/community/fundraising/[id]/approve/route.ts
/**
 * Approve a campaign - admin only.
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
    const { userId, schoolId } = await requireSchoolAdminOrDelegatedAnyPermission([
      "fundraising.publish",
    ]);
    await connectToDatabase();

    const { id } = await context.params;
    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));
    const userIdObj = new mongoose.Types.ObjectId(String(userId));

    const campaign = await FundraisingCampaign.findOne({
      _id: new mongoose.Types.ObjectId(id),
      schoolId: schoolIdObj,
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    if (campaign.approvalStatus !== "pending") {
      return NextResponse.json(
        { error: `Cannot approve campaign with approval status "${campaign.approvalStatus}"` },
        { status: 400 }
      );
    }

    await FundraisingCampaign.updateOne(
      { _id: campaign._id },
      {
        $set: {
          status: "approved",
          approvalStatus: "approved",
          approvedBy: userIdObj,
          approvedAt: new Date(),
        },
      }
    );

    return NextResponse.json({ message: "Campaign approved successfully" });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Error approving campaign:", error);
    return NextResponse.json({ error: "Failed to approve campaign" }, { status: 500 });
  }
}
