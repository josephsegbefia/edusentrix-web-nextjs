// src/app/api/admin/community/fundraising/[id]/donations/route.ts
/**
 * List donations for a campaign.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { FundraisingCampaign } from "@/models/FundraisingCampaign";
import { FundraisingDonation, DonationStatus } from "@/models/FundraisingDonation";
import { User } from "@/models/User";
import mongoose from "mongoose";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

    void FundraisingCampaign.modelName;
    void FundraisingDonation.modelName;
    void User.modelName;

    const { id } = await context.params;
    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));
    const campaignIdObj = new mongoose.Types.ObjectId(id);

    // Verify campaign exists and belongs to school
    const campaign = await FundraisingCampaign.findOne({
      _id: campaignIdObj,
      schoolId: schoolIdObj,
    }).lean();

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    const url = new URL(req.url);
    const status = url.searchParams.get("status") as DonationStatus | null;
    const limit = Math.min(Number(url.searchParams.get("limit")) || 50, 100);
    const skip = Number(url.searchParams.get("skip")) || 0;

    // Build query
    const query: Record<string, unknown> = {
      campaignId: campaignIdObj,
      schoolId: schoolIdObj,
    };
    if (status) query.status = status;

    // Fetch donations
    const [donations, total] = await Promise.all([
      FundraisingDonation.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("donorUserId", "firstName lastName email")
        .lean(),
      FundraisingDonation.countDocuments(query),
    ]);

    // Calculate totals
    const completedDonations = await FundraisingDonation.aggregate([
      { $match: { campaignId: campaignIdObj, status: "completed" } },
      { $group: { _id: null, total: { $sum: "$amountMinor" }, count: { $sum: 1 } } },
    ]);

    const totals = completedDonations[0] || { total: 0, count: 0 };

    // Transform response
    const data = donations.map((d: any) => ({
      id: String(d._id),
      amountMinor: d.amountMinor,
      currency: d.currency,
      status: d.status,
      isAnonymous: d.isAnonymous,
      donorName: d.isAnonymous ? "Anonymous" : d.donorName || null,
      donorEmail: d.donorEmail || null,
      donorPhone: d.donorPhone || null,
      donorUser: d.donorUserId && !d.isAnonymous
        ? {
            id: String(d.donorUserId._id),
            name: `${d.donorUserId.firstName} ${d.donorUserId.lastName}`.trim(),
            email: d.donorUserId.email,
          }
        : null,
      message: d.message || null,
      paymentMethod: d.paymentMethod,
      receiptNumber: d.receiptNumber || null,
      gatewayReference: d.gatewayReference || null,
      createdAt: new Date(d.createdAt).toISOString(),
      refundedAt: d.refundedAt ? new Date(d.refundedAt).toISOString() : null,
    }));

    return NextResponse.json({
      data,
      totals: {
        raisedAmountMinor: totals.total,
        donorCount: totals.count,
        currency: (campaign as any).currency,
      },
      pagination: {
        total,
        limit,
        skip,
        hasMore: skip + donations.length < total,
      },
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Error fetching donations:", error);
    return NextResponse.json({ error: "Failed to fetch donations" }, { status: 500 });
  }
}
