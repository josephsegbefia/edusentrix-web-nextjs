// src/app/api/community/fundraising/[id]/route.ts
/**
 * Public/member API to get campaign details for donation.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireSchoolMember } from "@/lib/auth/requireSchoolMember";
import { connectToDatabase } from "@/db/connectToDatabase";
import { FundraisingCampaign } from "@/models/FundraisingCampaign";
import { FundraisingDonation } from "@/models/FundraisingDonation";
import { FundraisingCampaignUpdate } from "@/models/FundraisingCampaignUpdate";
import mongoose from "mongoose";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const memberContext = await requireSchoolMember({
      allowedRoles: ["parent", "teacher", "staff"],
    });

    await connectToDatabase();

    void FundraisingCampaign.modelName;
    void FundraisingDonation.modelName;
    void FundraisingCampaignUpdate.modelName;

    const { id } = await context.params;
    const schoolIdObj = new mongoose.Types.ObjectId(String(memberContext.schoolId));
    const campaignIdObj = new mongoose.Types.ObjectId(id);

    const campaign = await FundraisingCampaign.findOne({
      _id: campaignIdObj,
      schoolId: schoolIdObj,
      status: { $in: ["live", "paused", "closed"] },
    }).lean();

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found or not available" }, { status: 404 });
    }

    // Get recent updates
    const updates = await FundraisingCampaignUpdate.find({
      campaignId: campaignIdObj,
      isPublished: true,
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    // Get donor list based on visibility
    let recentDonors: any[] = [];
    const c = campaign as any;

    if (c.donorVisibility !== "admin_only") {
      const donorQuery: Record<string, unknown> = {
        campaignId: campaignIdObj,
        status: "completed",
      };

      const donorDocs = await FundraisingDonation.find(donorQuery)
        .sort({ createdAt: -1 })
        .limit(10)
        .lean();

      recentDonors = donorDocs.map((d: any) => ({
        id: String(d._id),
        name: d.isAnonymous || c.donorVisibility === "public_anonymous"
          ? "Anonymous"
          : d.donorName || "Anonymous",
        amountMinor: d.amountMinor,
        message: d.message || null,
        createdAt: new Date(d.createdAt).toISOString(),
      }));
    }

    return NextResponse.json({
      id: String(c._id),
      title: c.title,
      summary: c.summary || null,
      description: c.description || null,
      category: c.category,
      coverImageUrl: c.coverImageUrl || null,
      galleryUrls: c.galleryUrls || [],
      status: c.status,
      goalAmountMinor: c.goalAmountMinor,
      raisedAmountMinor: c.raisedAmountMinor || 0,
      donorCount: c.donorCount || 0,
      currency: c.currency,
      progressPercent: c.goalAmountMinor > 0
        ? Math.min(Math.round(((c.raisedAmountMinor || 0) / c.goalAmountMinor) * 100), 100)
        : 0,
      schedule: {
        startDate: c.schedule?.startDate ? new Date(c.schedule.startDate).toISOString() : null,
        endDate: c.schedule?.endDate ? new Date(c.schedule.endDate).toISOString() : null,
      },
      milestones: (c.milestones || []).map((m: any) => ({
        id: String(m._id),
        label: m.label,
        amountMinor: m.amountMinor,
        reached: (c.raisedAmountMinor || 0) >= m.amountMinor,
        reachedAt: m.reachedAt ? new Date(m.reachedAt).toISOString() : null,
      })),
      allowAnonymousDonations: c.allowAnonymousDonations,
      isAcceptingDonations: c.status === "live",
      updates: updates.map((u: any) => ({
        id: String(u._id),
        title: u.title,
        body: u.body,
        attachments: u.attachments || [],
        createdAt: new Date(u.createdAt).toISOString(),
      })),
      recentDonors,
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Error fetching campaign for donation:", error);
    return NextResponse.json({ error: "Failed to fetch campaign" }, { status: 500 });
  }
}
