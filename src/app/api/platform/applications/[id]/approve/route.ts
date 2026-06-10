// /* eslint-disable @typescript-eslint/no-explicit-any */
// import { NextRequest, NextResponse } from "next/server";
// import mongoose from "mongoose";
// import { z } from "zod";

// import { connectToDatabase } from "@/db/connectToDatabase";
// import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
// import { Application } from "@/models/Application";
// import { School } from "@/models/School";
// import { User } from "@/models/User";
// import { sendEmail } from "@/lib/email/brevo";
// import { recordApplicationAudit } from "@/lib/audit/recordApplicationAudit";

// import { clerkClient } from "@clerk/nextjs/server";

// const BodySchema = z.object({
//   note: z.string().optional(),
// });

// export async function POST(
//   req: NextRequest,
//   ctx: { params: Promise<{ id: string }> }
// ) {
//   const guard = await requirePlatformAdmin();
//   if (!guard.ok) return guard.res;
//   const platformAdminId = new mongoose.Types.ObjectId(
//     String((guard.me as any)?._id)
//   );

//   const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
//   if (!parsed.success)
//     return NextResponse.json({ error: "Invalid body" }, { status: 400 });

//   await connectToDatabase();
//   const session = await mongoose.connection.startSession();
//   const { id } = await ctx.params;

//   let appForEmail: any;
//   let createdSchoolId: mongoose.Types.ObjectId | null = null;

//   try {
//     await session.withTransaction(async () => {
//       const app = await Application.findById(id).session(session);
//       if (!app) throw new Error("Application not found");

//       // Allow idempotency if already approved
//       if (!["submitted", "reviewed", "approved"].includes(app.status)) {
//         throw new Error(
//           `Invalid state transition from '${app.status}' to 'approved'`
//         );
//       }
//       if (app.status === "approved") {
//         // no-op: we will still try (re)send invitation below after txn
//       }

//       // 1) Create or reuse School
//       let school: any;
//       if (app.linkedSchoolId) {
//         school = await School.findById(app.linkedSchoolId).session(session);
//         if (!school) throw new Error("Linked school not found");
//         school.status = "pending";
//         await school.save({ session });
//       } else {
//         school = await School.create(
//           [
//             {
//               name: app.schoolName,
//               type: app.schoolType,
//               address: (app as any).address || undefined,
//               city: app.city || undefined,
//               region: app.region || undefined,
//               status: "pending",
//               createdBy: platformAdminId,
//             },
//           ],
//           { session }
//         ).then(([doc]) => doc);
//       }
//       createdSchoolId = school._id;

//       // 2) Ensure local User (by email)
//       const adminFullName = `${app.adminFirstName} ${app.adminLastName}`.trim();
//       const userEmail = app.adminEmail.toLowerCase();

//       const existing = await User.findOne({ email: userEmail })
//         .session(session)
//         .lean();

//       if (existing) {
//         await User.updateOne(
//           { _id: (existing as any)._id },
//           {
//             $set: {
//               email: userEmail,
//               name: adminFullName,
//               phone: app.adminPhone || null,
//               role: "school_admin",
//               schoolId: school._id,
//               pendingOnboarding: true,
//             },
//           },
//           { session }
//         );
//       } else {
//         await User.create(
//           [
//             {
//               email: userEmail,
//               // clerkUserId will be set after the admin accepts the invite
//               name: adminFullName,
//               phone: app.adminPhone || null,
//               role: "school_admin",
//               schoolId: school._id,
//               pendingOnboarding: true,
//             },
//           ],
//           { session }
//         );
//       }

//       // 3) Update application + link + audit
//       app.status = "approved";
//       app.linkedSchoolId = school._id as any;
//       app.processedBy = platformAdminId as any;
//       await app.save({ session });

//       await recordApplicationAudit(
//         {
//           applicationId: app._id,
//           action: "approved",
//           by: platformAdminId,
//           note: parsed.data?.note,
//           meta: { linkedSchoolId: String(school._id) },
//         },
//         { session }
//       );

//       appForEmail = app;
//     });

//     // 4) Send Clerk invitation (AFTER the DB txn)
//     const APP_URL = process.env.APP_URL!;
//     if (!APP_URL) {
//       throw new Error("APP_URL is not configured");
//     }

//     // Redirect here after the invitee completes sign-up (password set)
//     const redirectUrl = `${APP_URL}/auth/callback`;

//     // NOTE: Invitations require your instance to accept email addresses.
//     // See docs: https://clerk.com/docs/references/backend/invitations/create-invitation
//     const clerk = await clerkClient();
//     const invitation = await clerk.invitations.createInvitation({
//       emailAddress: appForEmail.adminEmail,
//       redirectUrl,
//       publicMetadata: {
//         role: "school_admin",
//         applicationId: String(appForEmail._id),
//         schoolId: createdSchoolId ? String(createdSchoolId) : undefined,
//       },
//       // Optional but recommended:
//       notify: true, // send Clerk’s email
//       ignoreExisting: true, // don’t error if they were invited before
//     });

//     // Optional: your own branded “heads up” email so they know what to expect.
//     await sendEmail(appForEmail.adminEmail, "SCHOOL_INVITE", {
//       schoolName: appForEmail.schoolName,
//       setupLink: `${APP_URL}/sign-in`, // safety link to your sign-in page
//     });

//     return NextResponse.json({
//       success: true,
//       schoolId: createdSchoolId,
//       clerkInvitationId: invitation.id,
//     });
//   } catch (e: any) {
//     // Common cause: invitations_not_supported (instance doesn’t accept email addresses)
//     console.error("Clerk invitation error / Approve failed:", e);
//     return NextResponse.json(
//       { error: "Approval failed", details: e?.message || String(e) },
//       { status: 500 }
//     );
//   } finally {
//     session.endSession();
//   }
// }

// src/app/api/platform/applications/[id]/approve/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { Application } from "@/models/Application";
import { School } from "@/models/School";
import { User } from "@/models/User";
import { UserMembership } from "@/models/UserMembership";
import { sendTrackedBrevoEmail } from "@/lib/email";
import { renderTemplate } from "@/lib/email/templates";
import { recordApplicationAudit } from "@/lib/audit/recordApplicationAudit";
import { writeTransactionalAuditEvent } from "@/lib/audit/writeTransactionalAuditEvent";
import {
  buildPlatformAdminAuditContext,
  resolveAuditIdempotencyKey,
} from "@/lib/audit/fromApiRoute";
import { clerkClient } from "@clerk/nextjs/server";
import {
  getAppUrl,
  getInvitationAcceptUrl,
  getInvitationRedirectUrl,
} from "@/lib/utils/getAppUrl";
const BodySchema = z.object({
  note: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const guard = await requirePlatformAdmin();
  if (!guard.ok) return guard.res;
  const platformAdminId = new mongoose.Types.ObjectId(
    String((guard.me as any)?._id)
  );

  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  await connectToDatabase();
  const session = await mongoose.connection.startSession();
  const { id } = await ctx.params;
  const applicationAuditIdempotencyKey = resolveAuditIdempotencyKey(
    req,
    `application.approved:${id}`
  );

  try {
    let schoolIdCreated: mongoose.Types.ObjectId | null = null;
    let approvedApp: any;

    await session.withTransaction(async () => {
      const app = await Application.findById(id).session(session);
      if (!app) throw new Error("Application not found");

      if (!["submitted", "reviewed"].includes(app.status)) {
        if (app.status === "approved") {
          approvedApp = app;
          schoolIdCreated = app.linkedSchoolId
            ? new mongoose.Types.ObjectId(String(app.linkedSchoolId))
            : null;
          return;
        }
        throw new Error(
          `Invalid state transition from '${app.status}' to 'approved'`
        );
      }

      // 1) School
      let school: any;
      if (app.linkedSchoolId) {
        school = await School.findById(app.linkedSchoolId).session(session);
        if (!school) throw new Error("Linked school not found");
        school.status = "pending";
        await school.save({ session });
      } else {
        const normalizedSchoolType =
          app.schoolType === "Secondary" ? "SHS" : app.schoolType;
        school = await School.create(
          [
            {
              name: app.schoolName,
              type: normalizedSchoolType,
              address: (app as any).address || undefined,
              city: app.city || undefined,
              region: app.region || undefined,
              status: "pending",
              createdBy: platformAdminId,
            },
          ],
          { session }
        ).then(([doc]) => doc);
      }
      schoolIdCreated = school._id;

      // 2) Local user (by email)
      const adminFullName = `${app.adminFirstName} ${app.adminLastName}`.trim();
      const userEmail = app.adminEmail.toLowerCase();

      const existing = await User.findOne({ email: userEmail })
        .session(session)
        .lean();
      let adminUserId: mongoose.Types.ObjectId;

      if (existing) {
        adminUserId =
          (existing as any)._id instanceof mongoose.Types.ObjectId
            ? (existing as any)._id
            : new mongoose.Types.ObjectId(String((existing as any)._id));
        await User.updateOne(
          { _id: adminUserId },
          {
            $set: {
              email: userEmail,
              name: adminFullName,
              phone: app.adminPhone || null,
              role: (existing as { role?: string }).role || "school_admin",
              schoolId: school._id,
              pendingOnboarding: true,
              termsAccepted: !!app.termsAccepted,
              privacyAccepted: !!app.privacyAccepted,
              termsVersion: app.termsVersion || null,
              privacyVersion: app.privacyVersion || null,
              policyAcceptedAt: app.policyAcceptedAt || null,
              policyAcceptedIp: app.policyAcceptedIp || null,
              policyAcceptedUserAgent: app.policyAcceptedUserAgent || null,
            },
          },
          { session }
        );
      } else {
        const createdUsers = await User.create(
          [
            {
              email: userEmail,
              // clerkUserId will be added automatically after they accept invite & sign in
              name: adminFullName,
              phone: app.adminPhone || null,
              role: "school_admin",
              schoolId: school._id,
              pendingOnboarding: true,
              termsAccepted: !!app.termsAccepted,
              privacyAccepted: !!app.privacyAccepted,
              termsVersion: app.termsVersion || null,
              privacyVersion: app.privacyVersion || null,
              policyAcceptedAt: app.policyAcceptedAt || null,
              policyAcceptedIp: app.policyAcceptedIp || null,
              policyAcceptedUserAgent: app.policyAcceptedUserAgent || null,
            },
          ],
          { session }
        );
        adminUserId = createdUsers[0]._id as mongoose.Types.ObjectId;
      }

      await UserMembership.findOneAndUpdate(
        { userId: adminUserId, schoolId: school._id },
        {
          $set: { status: "active" },
          $setOnInsert: {
            userId: adminUserId,
            schoolId: school._id,
          },
          $addToSet: { roles: "school_admin" },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true, session }
      );

      // 3) Update app + audit
      app.status = "approved";
      app.linkedSchoolId = school._id as any;
      app.processedBy = platformAdminId as any;
      await app.save({ session });

      await recordApplicationAudit(
        {
          applicationId: app._id,
          action: "approved",
          by: platformAdminId,
          note: parsed.data?.note,
          meta: { linkedSchoolId: String(school._id) },
        },
        { session }
      );

      await writeTransactionalAuditEvent(session, {
        actionCode: "application.approved",
        scopeType: "platform",
        scopeId: null,
        result: "succeeded",
        target: {
          targetEntityType: "Application",
          targetEntityId: app._id,
        },
        context: buildPlatformAdminAuditContext(req, {
          platformAdminId,
          actorEmail: (guard.me as { email?: string } | undefined)?.email ?? null,
          actorName: null,
          idempotencyKey: applicationAuditIdempotencyKey,
        }),
        payload: {
          metadata: {
            linkedSchoolId: String(school._id),
            note: parsed.data?.note ?? null,
          },
        },
        streamKey: "platform:applications",
      });

      approvedApp = app;
    });

    // 4) Send Clerk invitation (verify + set password)
    const APP_URL = getAppUrl();
    const redirectUrl = getInvitationRedirectUrl();

    try {
      const clerk = await clerkClient();
      const clerkInvitation = await clerk.invitations.createInvitation({
        emailAddress: approvedApp.adminEmail,
        redirectUrl,
        notify: false,
        publicMetadata: {
          role: "school_admin",
          schoolId: schoolIdCreated ? String(schoolIdCreated) : undefined,
        },
        ignoreExisting: true,
      });

      const rendered = renderTemplate("SCHOOL_INVITE", {
        schoolName: approvedApp.schoolName,
        setupLink: getInvitationAcceptUrl(clerkInvitation, redirectUrl),
      });

      await sendTrackedBrevoEmail({
        to: approvedApp.adminEmail,
        subject: rendered.subject,
        htmlContent: rendered.htmlContent,
        textContent: rendered.textContent,
        templateKey: "SCHOOL_ADMIN_INVITE",
        schoolId: schoolIdCreated ? String(schoolIdCreated) : undefined,
        schoolName: approvedApp.schoolName,
        actorId: String(platformAdminId),
        actorRole: "platform_admin",
        relatedEntityType: "application",
        relatedEntityId: id,
      });
    } catch (e) {
      console.error(
        "Clerk invitation error (ensure Email identifiers are enabled):",
        e
      );
    }

    return NextResponse.json({ success: true, schoolId: schoolIdCreated });
  } catch (e: any) {
    console.log("Approval failed", e);
    return NextResponse.json(
      { error: "Approval failed", details: e?.message || String(e) },
      { status: 500 }
    );
  } finally {
    session.endSession();
  }
}
