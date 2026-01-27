// src/app/api/admin/community/fundraising/[id]/donations/route.ts
/**
 * List and record donations for a campaign.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { FundraisingCampaign, IFundraisingCampaign } from "@/models/FundraisingCampaign";
import { FundraisingDonation, DonationStatus, PaymentMethod } from "@/models/FundraisingDonation";
import { User } from "@/models/User";
import { recordActivity } from "@/lib/audit/recordActivity";
import mongoose from "mongoose";
import { z } from "zod";

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

// ============================================================================
// Record Offline Donation
// ============================================================================

const RecordDonationSchema = z.object({
  amountMinor: z.number().int().positive("Amount must be positive"),
  currency: z.string().optional(),
  donorName: z.string().optional(),
  donorEmail: z.string().email().optional().or(z.literal("")),
  donorPhone: z.string().optional(),
  message: z.string().optional(),
  paymentMethod: z.enum(["cash", "bank_transfer", "mobile_money", "cheque", "other"]),
  isAnonymous: z.boolean().optional().default(false),
});

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { userId, schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

    void FundraisingCampaign.modelName;
    void FundraisingDonation.modelName;

    const { id } = await context.params;
    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));
    const campaignIdObj = new mongoose.Types.ObjectId(id);

    // Verify campaign exists and is active
    const campaign = await FundraisingCampaign.findOne({
      _id: campaignIdObj,
      schoolId: schoolIdObj,
    }).lean<Pick<IFundraisingCampaign, "_id" | "status" | "currency" | "raisedAmountMinor" | "donorCount">>();

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    if (!["live", "approved"].includes(campaign.status)) {
      return NextResponse.json(
        { error: "Campaign is not accepting donations" },
        { status: 400 }
      );
    }

    // Parse and validate body
    const body = await req.json();
    const result = RecordDonationSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0].message },
        { status: 400 }
      );
    }

    const data = result.data;

    // Validate donor info for non-anonymous donations
    if (!data.isAnonymous && !data.donorName?.trim()) {
      return NextResponse.json(
        { error: "Donor name is required for non-anonymous donations" },
        { status: 400 }
      );
    }

    // Generate receipt number
    const receiptCount = await FundraisingDonation.countDocuments({
      schoolId: schoolIdObj,
    });
    const receiptNumber = `DON-${Date.now().toString(36).toUpperCase()}-${(receiptCount + 1).toString().padStart(4, "0")}`;

    // Create donation
    const donation = await FundraisingDonation.create({
      campaignId: campaignIdObj,
      schoolId: schoolIdObj,
      amountMinor: data.amountMinor,
      currency: data.currency || campaign.currency,
      status: "completed",
      donorName: data.isAnonymous ? null : data.donorName?.trim(),
      donorEmail: data.donorEmail?.trim() || null,
      donorPhone: data.donorPhone?.trim() || null,
      message: data.message?.trim() || null,
      paymentMethod: data.paymentMethod as PaymentMethod,
      isAnonymous: data.isAnonymous,
      receiptNumber,
    });

    // Update campaign totals
    await FundraisingCampaign.updateOne(
      { _id: campaignIdObj },
      {
        $inc: {
          raisedAmountMinor: data.amountMinor,
          donorCount: 1,
        },
      }
    );

    // Record activity
    await recordActivity({
      schoolId: String(schoolId),
      userId: String(userId),
      type: "donation.received",
      entityType: "fundraising_campaign",
      entityId: String(campaignIdObj),
      description: `Recorded offline donation of ${data.amountMinor / 100} via ${data.paymentMethod}`,
      metadata: {
        donationId: String(donation._id),
        amountMinor: data.amountMinor,
        paymentMethod: data.paymentMethod,
        isOffline: true,
      },
    });

    return NextResponse.json({
      success: true,
      donationId: String(donation._id),
      receiptNumber,
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("Error recording donation:", error);
    return NextResponse.json({ error: "Failed to record donation" }, { status: 500 });
  }
}
