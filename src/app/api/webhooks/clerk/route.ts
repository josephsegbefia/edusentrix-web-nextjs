// src/app/api/webhooks/clerk/route.ts
/**
 * Clerk webhook handler for user and invitation events.
 * Handles:
 * - user.created: Link Clerk user to MongoDB user
 * - invitation.accepted: Mark invitation as accepted
 * - user.updated: Sync user data changes
 */
import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { headers } from "next/headers";
import { connectToDatabase } from "@/db/connectToDatabase";
import { User } from "@/models/User";
import { Invitation } from "@/models/Invitation";
import { UserMembership } from "@/models/UserMembership";
import mongoose from "mongoose";
import { trackUsage } from "@/lib/billing/trackUsage";
import { isMembershipRole } from "@/lib/roles";
import {
  bindBillingOwnerToSchool,
  bindPaymentSetupDelegateToSchool,
  replaceBillingOwnerOnSchool,
} from "@/lib/school-payments/billing-owner-lifecycle";

// ============================================================================
// Types
// ============================================================================

interface ClerkUserData {
  id: string;
  email_addresses: Array<{
    id: string;
    email_address: string;
    verification?: { status: string };
  }>;
  first_name: string | null;
  last_name: string | null;
  image_url: string | null;
  public_metadata: Record<string, unknown>;
  private_metadata: Record<string, unknown>;
  created_at: number;
  updated_at: number;
}

interface ClerkInvitationData {
  id: string;
  email_address: string;
  public_metadata: Record<string, unknown>;
  status: string;
  revoked_at?: number;
  created_at: number;
  updated_at: number;
}

interface WebhookEvent {
  type: string;
  data: ClerkUserData | ClerkInvitationData;
}

// ============================================================================
// Webhook Verification
// ============================================================================

async function verifyWebhook(req: NextRequest): Promise<WebhookEvent | null> {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;
  
  if (!WEBHOOK_SECRET) {
    console.error("Clerk webhook: CLERK_WEBHOOK_SECRET not configured");
    return null;
  }

  const headerPayload = await headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  if (!svix_id || !svix_timestamp || !svix_signature) {
    console.error("Clerk webhook: Missing svix headers");
    return null;
  }

  const payload = await req.text();
  const wh = new Webhook(WEBHOOK_SECRET);

  try {
    const evt = wh.verify(payload, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent;
    return evt;
  } catch (err) {
    console.error("Clerk webhook: Verification failed", err);
    return null;
  }
}

// ============================================================================
// Event Handlers
// ============================================================================

/**
 * Handle user.created event
 * Links the Clerk user to an existing MongoDB user (created during invitation)
 * or creates a new user if one doesn't exist
 */
async function handleUserCreated(data: ClerkUserData) {
  const email = data.email_addresses?.[0]?.email_address?.toLowerCase();
  if (!email) {
    console.log("Clerk webhook: user.created - no email address");
    return;
  }

  await connectToDatabase();

  // Check if user already exists (created during teacher/staff invitation)
  const role = (data.public_metadata?.role as string) || undefined;
  const schoolId = data.public_metadata?.schoolId as string | undefined;
  let resolvedUserId: mongoose.Types.ObjectId | null = null;
  let resolvedSchoolId: mongoose.Types.ObjectId | null = null;
  const resolvedName =
    [data.first_name, data.last_name].filter(Boolean).join(" ").trim() || null;

  interface ExistingUserLean {
    _id: mongoose.Types.ObjectId;
    firstName?: string;
    lastName?: string;
    avatarUrl?: string;
    schoolId?: mongoose.Types.ObjectId;
    role?: string;
  }
  const existingUser = await User.findOne({ email }).lean() as ExistingUserLean | null;

  if (existingUser) {
    // Link the Clerk user ID to the existing MongoDB user
    await User.updateOne(
      { _id: existingUser._id },
      {
        $set: {
          clerkUserId: data.id,
          firstName: data.first_name || existingUser.firstName,
          lastName: data.last_name || existingUser.lastName,
          avatarUrl: data.image_url || existingUser.avatarUrl,
          ...(role ? { role } : {}),
          ...(schoolId ? { schoolId: new mongoose.Types.ObjectId(schoolId) } : {}),
        },
      }
    );
    console.log(`Clerk webhook: Linked existing user ${email} to Clerk ID ${data.id}`);

    if (schoolId && role && isMembershipRole(role)) {
      resolvedSchoolId = new mongoose.Types.ObjectId(schoolId);
      await UserMembership.findOneAndUpdate(
        {
          userId: existingUser._id,
          schoolId: resolvedSchoolId,
        },
        { $addToSet: { roles: role }, $set: { status: "active" } },
        { upsert: true }
      );
    }
    resolvedUserId = existingUser._id;
    if (!resolvedSchoolId && existingUser.schoolId) {
      resolvedSchoolId = existingUser.schoolId;
    }

    if (existingUser.schoolId) {
      await trackUsage({
        schoolId: existingUser.schoolId,
        provider: "clerk",
        metricKey: "user_created_events",
        quantity: 1,
        unitLabel: "events",
        allocationMethod: "direct",
        sourceType: "system_estimate",
        notes: "Clerk user.created webhook processed for an existing linked user.",
      });
    }
  } else {
    // Create new user from Clerk data
    const newUser = await User.create({
      clerkUserId: data.id,
      email,
      firstName: data.first_name || undefined,
      lastName: data.last_name || undefined,
      avatarUrl: data.image_url || undefined,
      role,
      schoolId: schoolId ? new mongoose.Types.ObjectId(schoolId) : undefined,
      pendingOnboarding: role === "school_admin",
    });
    resolvedUserId = newUser._id;
    resolvedSchoolId = schoolId ? new mongoose.Types.ObjectId(schoolId) : null;

    // If schoolId is set, create UserMembership
    if (schoolId && role && isMembershipRole(role)) {
      await UserMembership.findOneAndUpdate(
        { userId: newUser._id, schoolId: resolvedSchoolId },
        { $addToSet: { roles: role }, $set: { status: "active" } },
        { upsert: true }
      );

      await trackUsage({
        schoolId,
        provider: "clerk",
        metricKey: "user_created_events",
        quantity: 1,
        unitLabel: "events",
        allocationMethod: "direct",
        sourceType: "system_estimate",
        notes: "Clerk user.created webhook created a new linked user.",
      });
    }

    console.log(`Clerk webhook: Created new user ${email} from Clerk ID ${data.id}`);
  }

  // Mark any pending invitations as accepted
  const updateResult = await Invitation.updateMany(
    { email, status: "pending" },
    {
      $set: {
        status: "accepted",
        acceptedAt: new Date(),
      },
    }
  );

  if (updateResult.modifiedCount > 0) {
    console.log(`Clerk webhook: Marked ${updateResult.modifiedCount} invitation(s) as accepted for ${email}`);
  }

  if (role === "billing_owner" && resolvedUserId && resolvedSchoolId) {
    const ownerInvitation = await Invitation.findOne({
      email,
      schoolId: resolvedSchoolId,
      role: "billing_owner",
      status: { $in: ["accepted", "pending"] },
    })
      .sort({ acceptedAt: -1, sentAt: -1 })
      .lean<{ metadata?: { paymentAuthorityMode?: string } | null } | null>();

    if (ownerInvitation?.metadata?.paymentAuthorityMode === "owner_replacement") {
      await replaceBillingOwnerOnSchool({
        schoolId: resolvedSchoolId,
        userId: resolvedUserId,
        email,
        name: resolvedName,
      });
    } else {
      await bindBillingOwnerToSchool({
        schoolId: resolvedSchoolId,
        userId: resolvedUserId,
        email,
        name: resolvedName,
      });
    }
  }

  if (role === "bursar" && resolvedUserId && resolvedSchoolId) {
    await bindPaymentSetupDelegateToSchool({
      schoolId: resolvedSchoolId,
      userId: resolvedUserId,
      email,
      name: resolvedName,
    });
  }
}

/**
 * Handle user.updated event
 * Syncs user data changes from Clerk to MongoDB
 */
async function handleUserUpdated(data: ClerkUserData) {
  await connectToDatabase();

  const updateFields: Record<string, unknown> = {};

  if (data.first_name) updateFields.firstName = data.first_name;
  if (data.last_name) updateFields.lastName = data.last_name;
  if (data.image_url) updateFields.avatarUrl = data.image_url;

  if (Object.keys(updateFields).length > 0) {
    await User.updateOne(
      { clerkUserId: data.id },
      { $set: updateFields }
    );
    console.log(`Clerk webhook: Updated user data for Clerk ID ${data.id}`);
  }
}

/**
 * Handle invitation.accepted event (Clerk's native invitation acceptance)
 */
async function handleInvitationAccepted(data: ClerkInvitationData) {
  const email = data.email_address?.toLowerCase();
  if (!email) return;

  await connectToDatabase();

  // Mark invitation as accepted by clerkInvitationId
  const invitation = await Invitation.findOneAndUpdate(
    { clerkInvitationId: data.id },
    {
      $set: {
        status: "accepted",
        acceptedAt: new Date(),
      },
    },
    { new: true }
  );

  if (invitation?.schoolId) {
    await trackUsage({
      schoolId: invitation.schoolId,
      provider: "clerk",
      metricKey: "invitation_acceptances",
      quantity: 1,
      unitLabel: "events",
      allocationMethod: "direct",
      sourceType: "system_estimate",
      notes: "Clerk invitation.accepted webhook processed successfully.",
    });
  }

  console.log(`Clerk webhook: Marked invitation ${data.id} as accepted`);
}

/**
 * Handle invitation.revoked event
 */
async function handleInvitationRevoked(data: ClerkInvitationData) {
  await connectToDatabase();

  await Invitation.updateOne(
    { clerkInvitationId: data.id },
    {
      $set: {
        status: "revoked",
        revokedAt: data.revoked_at ? new Date(data.revoked_at) : new Date(),
      },
    }
  );

  console.log(`Clerk webhook: Marked invitation ${data.id} as revoked`);
}

// ============================================================================
// POST Handler
// ============================================================================

export async function POST(req: NextRequest) {
  try {
    const event = await verifyWebhook(req);
    
    if (!event) {
      return NextResponse.json({ error: "Invalid webhook" }, { status: 401 });
    }

    console.log(`Clerk webhook received: ${event.type}`);

    switch (event.type) {
      case "user.created":
        await handleUserCreated(event.data as ClerkUserData);
        break;
      case "user.updated":
        await handleUserUpdated(event.data as ClerkUserData);
        break;
      case "invitation.accepted":
        await handleInvitationAccepted(event.data as ClerkInvitationData);
        break;
      case "invitation.revoked":
        await handleInvitationRevoked(event.data as ClerkInvitationData);
        break;
      default:
        console.log(`Clerk webhook: Unhandled event type ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Clerk webhook error:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
