// src/app/api/admin/community/fundraising/[id]/reject/route.ts
/**
 * Reject a campaign - admin only.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { FundraisingCampaign } from "@/models/FundraisingCampaign";
import mongoose from "mongoose";
import { z } from "zod";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const RejectSchema = z.object({
  reason: z.string().min(1).max(1000),
});

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { userId, schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

    const { id } = await context.params;
    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));
    const userIdObj = new mongoose.Types.ObjectId(String(userId));

    const body = await req.json();
    const parsed = RejectSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Rejection reason is required" },
        { status: 400 }
      );
    }

    const campaign = await FundraisingCampaign.findOne({
      _id: new mongoose.Types.ObjectId(id),
      schoolId: schoolIdObj,
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    if (campaign.approvalStatus !== "pending") {
      return NextResponse.json(
        { error: `Cannot reject campaign with approval status "${campaign.approvalStatus}"` },
        { status: 400 }
      );
    }

    await FundraisingCampaign.updateOne(
      { _id: campaign._id },
      {
        $set: {
          approvalStatus: "rejected",
          approvalNotes: parsed.data.reason,
          approvedBy: userIdObj,
          approvedAt: new Date(),
        },
      }
    );

    return NextResponse.json({ message: "Campaign rejected" });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Error rejecting campaign:", error);
    return NextResponse.json({ error: "Failed to reject campaign" }, { status: 500 });
  }
}
