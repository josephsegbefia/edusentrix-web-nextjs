// src/app/api/community/fundraising/[id]/donate/route.ts
/**
 * Create donation intent with V2 idempotency.
 * Accepts Idempotency-Key header for safe retries.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireSchoolMember, canDonate } from "@/lib/auth/requireSchoolMember";
import { connectToDatabase } from "@/db/connectToDatabase";
import { FundraisingCampaign } from "@/models/FundraisingCampaign";
import { FundraisingDonation } from "@/models/FundraisingDonation";
import mongoose from "mongoose";
import crypto from "crypto";
import { z } from "zod";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// ============================================================================
// Validation Schema
// ============================================================================

const DonateSchema = z.object({
  amountMinor: z.number().min(100), // Minimum 1 GHS/USD
  currency: z.string().default("GHS"),
  isAnonymous: z.boolean().default(false),
  donorName: z.string().max(200).optional(),
  donorEmail: z.string().email().optional(),
  donorPhone: z.string().max(50).optional(),
  message: z.string().max(1000).optional(),
  paymentMethod: z.enum(["paystack", "mobile_money", "bank_transfer"]).default("paystack"),
});

// ============================================================================
// POST - Create donation intent
// ============================================================================

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const memberContext = await requireSchoolMember({
      allowedRoles: ["parent", "teacher", "staff"],
    });

    if (!canDonate(memberContext)) {
      return NextResponse.json({ error: "You are not eligible to donate" }, { status: 403 });
    }

    await connectToDatabase();

    void FundraisingCampaign.modelName;
    void FundraisingDonation.modelName;

    const { id } = await context.params;
    const schoolIdObj = new mongoose.Types.ObjectId(String(memberContext.schoolId));
    const campaignIdObj = new mongoose.Types.ObjectId(id);

    // Get campaign
    const campaign = await FundraisingCampaign.findOne({
      _id: campaignIdObj,
      schoolId: schoolIdObj,
      status: "live",
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found or not accepting donations" }, { status: 404 });
    }

    // Parse body
    const body = await req.json();
    const parsed = DonateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid donation data", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const {
      amountMinor,
      currency,
      isAnonymous,
      donorName,
      donorEmail,
      donorPhone,
      message,
      paymentMethod,
    } = parsed.data;

    // Check if anonymous donations are allowed
    if (isAnonymous && !campaign.allowAnonymousDonations) {
      return NextResponse.json(
        { error: "This campaign does not accept anonymous donations" },
        { status: 400 }
      );
    }

    // V2: Handle idempotency
    const idempotencyKey = req.headers.get("Idempotency-Key") || req.headers.get("idempotency-key");

    if (idempotencyKey) {
      // Check if we already have a donation with this idempotency key
      const existingDonation = await FundraisingDonation.findOne({
        idempotencyKey,
        schoolId: schoolIdObj,
      });

      if (existingDonation) {
        // Return the existing donation intent
        return NextResponse.json({
          id: String(existingDonation._id),
          status: existingDonation.status,
          amountMinor: existingDonation.amountMinor,
          currency: existingDonation.currency,
          message: "Existing donation intent returned",
          // TODO: Return payment URL if available
          paymentUrl: null,
        });
      }
    }

    // Generate internal intent ID
    const intentId = `intent_${crypto.randomBytes(16).toString("hex")}`;

    // Create donation record
    const donation = await FundraisingDonation.create({
      campaignId: campaignIdObj,
      schoolId: schoolIdObj,
      amountMinor,
      currency: currency || campaign.currency,
      status: "pending",
      donorUserId: memberContext.userId,
      donorName: donorName || null,
      donorEmail: donorEmail || null,
      donorPhone: donorPhone || null,
      isAnonymous,
      message: message || null,
      paymentMethod,
      idempotencyKey: idempotencyKey || null,
      intentId,
    });

    // TODO: Integrate with Paystack to create payment session
    // For now, return the donation intent
    // In production, you would:
    // 1. Create a Paystack transaction
    // 2. Store the gatewayReference
    // 3. Return the authorization URL

    return NextResponse.json({
      id: String(donation._id),
      intentId,
      status: "pending",
      amountMinor,
      currency: currency || campaign.currency,
      message: "Donation intent created",
      // TODO: Replace with actual Paystack payment URL
      paymentUrl: null,
      paymentMethod,
    });
  } catch (error: any) {
    // Handle duplicate idempotency key (race condition)
    if (error.code === 11000 && error.keyPattern?.idempotencyKey) {
      // Fetch and return the existing donation
      const idempotencyKey = req.headers.get("Idempotency-Key") || req.headers.get("idempotency-key");
      if (idempotencyKey) {
        const existingDonation = await FundraisingDonation.findOne({ idempotencyKey });
        if (existingDonation) {
          return NextResponse.json({
            id: String(existingDonation._id),
            status: existingDonation.status,
            amountMinor: existingDonation.amountMinor,
            currency: existingDonation.currency,
            message: "Existing donation intent returned",
            paymentUrl: null,
          });
        }
      }
    }

    if (error instanceof NextResponse) return error;
    console.error("Error creating donation:", error);
    return NextResponse.json({ error: "Failed to create donation" }, { status: 500 });
  }
}
