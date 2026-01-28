// src/app/api/webhooks/paystack/route.ts
/**
 * Paystack webhook handler for payment events.
 * Handles donation completions for fundraising campaigns.
 */
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { FundraisingDonation, IFundraisingDonation } from "@/models/FundraisingDonation";
import { FundraisingCampaign } from "@/models/FundraisingCampaign";
import { recordActivity } from "@/lib/audit/recordActivity";
import { recordDonationInLedger } from "@/lib/finance/writeLedgerEntry";

// ============================================================================
// Types
// ============================================================================

interface PaystackEvent {
  event: string;
  data: {
    reference: string;
    amount: number;
    currency: string;
    status: string;
    gateway_response: string;
    channel: string;
    metadata?: {
      donationId?: string;
      campaignId?: string;
      schoolId?: string;
      custom_fields?: Array<{
        display_name: string;
        variable_name: string;
        value: string;
      }>;
    };
    customer?: {
      email?: string;
      customer_code?: string;
    };
    paid_at?: string;
    created_at?: string;
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function verifyPaystackSignature(
  payload: string,
  signature: string | null,
  secretKey: string
): boolean {
  if (!signature) return false;
  const hash = crypto
    .createHmac("sha512", secretKey)
    .update(payload)
    .digest("hex");
  return hash === signature;
}

// ============================================================================
// POST Handler
// ============================================================================

export async function POST(req: NextRequest) {
  try {
    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey) {
      console.error("Paystack webhook: PAYSTACK_SECRET_KEY not configured");
      return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
    }

    // Get raw body for signature verification
    const payload = await req.text();
    const signature = req.headers.get("x-paystack-signature");

    // Verify signature
    if (!verifyPaystackSignature(payload, signature, secretKey)) {
      console.error("Paystack webhook: Invalid signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const event: PaystackEvent = JSON.parse(payload);
    console.log(`Paystack webhook received: ${event.event}`);

    // Handle charge.success event
    if (event.event === "charge.success") {
      await handleChargeSuccess(event);
    }

    // Acknowledge receipt
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Paystack webhook error:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}

// ============================================================================
// Event Handlers
// ============================================================================

async function handleChargeSuccess(event: PaystackEvent) {
  const { data } = event;
  const { reference, amount, status, metadata } = data;

  // Only process successful payments
  if (status !== "success") {
    console.log(`Paystack webhook: Ignoring non-success status: ${status}`);
    return;
  }

  // Check if this is a donation
  if (!metadata?.donationId) {
    console.log(`Paystack webhook: No donationId in metadata, skipping`);
    return;
  }

  await connectToDatabase();
  void FundraisingDonation.modelName;
  void FundraisingCampaign.modelName;

  const donationId = metadata.donationId;
  const campaignId = metadata.campaignId;
  const schoolId = metadata.schoolId;

  if (!mongoose.Types.ObjectId.isValid(donationId)) {
    console.error(`Paystack webhook: Invalid donationId: ${donationId}`);
    return;
  }

  // Find the donation
  const donation = await FundraisingDonation.findById(donationId).lean<IFundraisingDonation>();

  if (!donation) {
    console.error(`Paystack webhook: Donation not found: ${donationId}`);
    return;
  }

  // Skip if already completed
  if (donation.status === "completed") {
    console.log(`Paystack webhook: Donation already completed: ${donationId}`);
    return;
  }

  // Update donation to completed
  await FundraisingDonation.updateOne(
    { _id: donationId },
    {
      $set: {
        status: "completed",
        gatewayReference: reference,
        updatedAt: new Date(),
      },
    }
  );

  // Update campaign totals
  if (campaignId && mongoose.Types.ObjectId.isValid(campaignId)) {
    await FundraisingCampaign.updateOne(
      { _id: campaignId },
      {
        $inc: {
          raisedAmountMinor: donation.amountMinor,
          donorCount: 1,
        },
      }
    );

    // Check and update milestones
    const campaign = await FundraisingCampaign.findById(campaignId);
    if (campaign && campaign.milestones) {
      const newTotal = campaign.raisedAmountMinor;
      let milestonesUpdated = false;

      for (const milestone of campaign.milestones) {
        if (!milestone.reachedAt && newTotal >= milestone.amountMinor) {
          milestone.reachedAt = new Date();
          milestonesUpdated = true;
        }
      }

      if (milestonesUpdated) {
        await campaign.save();
      }
    }
  }

  // Record activity
  if (schoolId && mongoose.Types.ObjectId.isValid(schoolId)) {
    await recordActivity({
      schoolId,
      userId: donation.donorUserId ? String(donation.donorUserId) : schoolId,
      type: "donation.received",
      entityType: "fundraising_donation",
      entityId: donationId,
      description: `Online donation received: ${(donation.amountMinor / 100).toFixed(2)} ${donation.currency}`,
      metadata: {
        campaignId,
        amountMinor: donation.amountMinor,
        paymentMethod: "paystack",
        gatewayReference: reference,
      },
    });

    // Write to Financial Center ledger
    try {
      // Get campaign title for description
      const campaign = await FundraisingCampaign.findById(campaignId)
        .select("title")
        .lean() as { title: string } | null;

      await recordDonationInLedger({
        schoolId,
        donationId,
        campaignId: campaignId || "",
        campaignTitle: campaign?.title || "Fundraising Campaign",
        amountMinor: donation.amountMinor,
        currency: donation.currency,
        paymentMethod: "paystack",
        gatewayReference: reference,
        donorName: donation.donorName || "Anonymous",
        donorEmail: donation.donorEmail || null,
        donorPhone: donation.donorPhone || null,
        isAnonymous: donation.isAnonymous,
        receiptNumber: donation.receiptNumber || null,
        occurredAt: new Date(),
        createdBy: donation.donorUserId ? String(donation.donorUserId) : null,
      });
    } catch (ledgerError) {
      console.error("Failed to write donation to ledger:", ledgerError);
    }
  }

  console.log(`Paystack webhook: Successfully processed donation ${donationId}`);
}
