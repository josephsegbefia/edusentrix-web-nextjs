// src/app/api/public/donate/[token]/route.ts
/**
 * Public API for getting campaign info and submitting donations.
 * No authentication required - uses public share token.
 */
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { FundraisingCampaign, IFundraisingCampaign } from "@/models/FundraisingCampaign";
import { FundraisingDonation } from "@/models/FundraisingDonation";
import { FundraisingCampaignUpdate } from "@/models/FundraisingCampaignUpdate";
import { z } from "zod";
import crypto from "crypto";

interface RouteContext {
  params: Promise<{ token: string }>;
}

// ============================================================================
// GET - Get campaign details for public donation
// ============================================================================

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    await connectToDatabase();

    void FundraisingCampaign.modelName;
    void FundraisingDonation.modelName;
    void FundraisingCampaignUpdate.modelName;

    const { token } = await context.params;

    if (!token || token.length < 10) {
      return NextResponse.json({ error: "Invalid share token" }, { status: 400 });
    }

    // Find campaign by public share token
    const campaignDoc = await FundraisingCampaign.findOne({
      "publicShare.token": token,
      "publicShare.enabled": true,
      status: "live",
    });

    if (!campaignDoc) {
      return NextResponse.json({ error: "Campaign not found or not accepting donations" }, { status: 404 });
    }

    const campaign = campaignDoc.toObject() as IFundraisingCampaign;

    // Check if token has expired
    if (campaign.publicShare.expiresAt && new Date(campaign.publicShare.expiresAt) < new Date()) {
      return NextResponse.json({ error: "This donation link has expired" }, { status: 410 });
    }

    // Get recent updates
    const updatesDocs = await FundraisingCampaignUpdate.find({
      campaignId: campaign._id,
      isPublished: true,
    })
      .sort({ createdAt: -1 })
      .limit(5);

    const updates = updatesDocs.map((u) => {
      const update = u.toObject();
      return {
        id: String(update._id),
        title: update.title,
        body: update.body,
        createdAt: new Date(update.createdAt).toISOString(),
      };
    });

    // Get recent donors (respecting visibility settings)
    let recentDonors: Array<{
      name: string;
      amountMinor: number;
      message: string | null;
      createdAt: string;
    }> = [];

    if (campaign.donorVisibility !== "admin_only") {
      const donorDocs = await FundraisingDonation.find({
        campaignId: campaign._id,
        status: "completed",
      })
        .sort({ createdAt: -1 })
        .limit(10);

      recentDonors = donorDocs.map((d) => {
        const donor = d.toObject();
        return {
          name:
            donor.isAnonymous || campaign.donorVisibility === "public_anonymous"
              ? "Anonymous"
              : donor.donorName || "Anonymous",
          amountMinor: donor.amountMinor,
          message: donor.message || null,
          createdAt: new Date(donor.createdAt).toISOString(),
        };
      });
    }

    return NextResponse.json({
      id: String(campaign._id),
      schoolId: String(campaign.schoolId),
      title: campaign.title,
      summary: campaign.summary || null,
      description: campaign.description || null,
      category: campaign.category,
      coverImageUrl: campaign.coverImageUrl || null,
      galleryUrls: campaign.galleryUrls || [],
      goalAmountMinor: campaign.goalAmountMinor,
      raisedAmountMinor: campaign.raisedAmountMinor || 0,
      donorCount: campaign.donorCount || 0,
      currency: campaign.currency,
      progressPercent:
        campaign.goalAmountMinor > 0
          ? Math.min(Math.round(((campaign.raisedAmountMinor || 0) / campaign.goalAmountMinor) * 100), 100)
          : 0,
      schedule: {
        startDate: campaign.schedule?.startDate ? new Date(campaign.schedule.startDate).toISOString() : null,
        endDate: campaign.schedule?.endDate ? new Date(campaign.schedule.endDate).toISOString() : null,
      },
      milestones: (campaign.milestones || []).map((m) => ({
        id: String(m._id),
        label: m.label,
        amountMinor: m.amountMinor,
        reached: (campaign.raisedAmountMinor || 0) >= m.amountMinor,
      })),
      allowAnonymousDonations: campaign.allowAnonymousDonations,
      updates,
      recentDonors,
    });
  } catch (error) {
    console.error("Error fetching public campaign:", error);
    return NextResponse.json({ error: "Failed to fetch campaign" }, { status: 500 });
  }
}

// ============================================================================
// POST - Submit public donation
// ============================================================================

const PublicDonateSchema = z.object({
  amountMinor: z.number().min(100, "Minimum donation is 1.00"),
  currency: z.string().default("GHS"),
  donorName: z.string().min(2, "Name is required").max(200),
  donorEmail: z.string().email("Valid email is required"),
  donorPhone: z.string().max(50).optional(),
  message: z.string().max(500).optional(),
  isAnonymous: z.boolean().default(false),
  paymentMethod: z.enum(["paystack", "mobile_money"]).default("paystack"),
});

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    await connectToDatabase();

    void FundraisingCampaign.modelName;
    void FundraisingDonation.modelName;

    const { token } = await context.params;

    if (!token || token.length < 10) {
      return NextResponse.json({ error: "Invalid share token" }, { status: 400 });
    }

    // Find campaign by public share token
    const campaignDoc = await FundraisingCampaign.findOne({
      "publicShare.token": token,
      "publicShare.enabled": true,
      status: "live",
    });

    if (!campaignDoc) {
      return NextResponse.json({ error: "Campaign not found or not accepting donations" }, { status: 404 });
    }

    const campaign = campaignDoc.toObject() as IFundraisingCampaign;

    // Check if token has expired
    if (campaign.publicShare.expiresAt && new Date(campaign.publicShare.expiresAt) < new Date()) {
      return NextResponse.json({ error: "This donation link has expired" }, { status: 410 });
    }

    // Parse body
    const body = await req.json();
    const parsed = PublicDonateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Check if anonymous donations are allowed
    if (data.isAnonymous && !campaign.allowAnonymousDonations) {
      return NextResponse.json(
        { error: "This campaign does not accept anonymous donations" },
        { status: 400 }
      );
    }

    // Generate receipt number
    const receiptCount = await FundraisingDonation.countDocuments({
      schoolId: campaign.schoolId,
    });
    const receiptNumber = `DON-${Date.now().toString(36).toUpperCase()}-${(receiptCount + 1).toString().padStart(4, "0")}`;

    // Generate internal reference
    const internalReference = `pub_${crypto.randomBytes(12).toString("hex")}`;

    // Create donation record
    const donation = await FundraisingDonation.create({
      campaignId: campaign._id,
      schoolId: campaign.schoolId,
      amountMinor: data.amountMinor,
      currency: data.currency || campaign.currency,
      status: "pending",
      donorName: data.donorName,
      donorEmail: data.donorEmail.toLowerCase(),
      donorPhone: data.donorPhone || null,
      isAnonymous: data.isAnonymous,
      message: data.message || null,
      paymentMethod: data.paymentMethod,
      receiptNumber,
      isPublicDonation: true,
      internalReference,
    });

    // TODO: Integrate with Paystack to create payment session
    // In production:
    // 1. Create Paystack transaction with metadata (donationId, campaignId, schoolId)
    // 2. Store the gatewayReference
    // 3. Return the authorization URL for redirect

    // For now, return success with payment instructions
    return NextResponse.json({
      success: true,
      donationId: String(donation._id),
      receiptNumber,
      amountMinor: data.amountMinor,
      currency: data.currency || campaign.currency,
      message: "Donation recorded successfully",
      // In production, this would be the Paystack payment URL
      paymentUrl: null,
      paymentMethod: data.paymentMethod,
    });
  } catch (error) {
    console.error("Error processing public donation:", error);
    return NextResponse.json({ error: "Failed to process donation" }, { status: 500 });
  }
}
