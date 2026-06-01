import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Invite, IInvite } from "@/models/Invite";
import { School, ISchool } from "@/models/School";
import { User, type IUser } from "@/models/User";
import { enrichUserNamesFromApplication } from "@/lib/onboarding/enrichUserNamesFromApplication";
import { runMongoTransaction } from "@/lib/mongoose/run-transaction";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clerk = await clerkClient();
  const clerkUser = await clerk.users.getUser(userId);

  const primaryEmail =
    clerkUser.emailAddresses.find(
      (ea) => ea.id === clerkUser.primaryEmailAddressId
    )?.emailAddress ||
    clerkUser.emailAddresses[0]?.emailAddress ||
    "";

  if (!primaryEmail) {
    return NextResponse.json(
      { error: "No email associated with this account" },
      { status: 401 }
    );
  }

  await connectToDatabase();

  let appUser: IUser | null = null;
  const existingUser = await User.findOne({ clerkUserId: clerkUser.id }).lean<IUser | null>();

  if (existingUser?.schoolId) {
    appUser = existingUser;
  } else {
    try {
      appUser = await runMongoTransaction(async (session) => {
        let user = await User.findOne({ clerkUserId: clerkUser.id }).session(
          session
        );

        if (!user) {
          const roleFromMetadata =
            (clerkUser.publicMetadata?.role as string | undefined) || undefined;

          const created = await User.create(
            [
              {
                clerkUserId: clerkUser.id,
                email: primaryEmail.toLowerCase(),
                firstName:
                  clerkUser.firstName ||
                  (clerkUser.publicMetadata?.firstName as string | undefined),
                lastName:
                  clerkUser.lastName ||
                  (clerkUser.publicMetadata?.lastName as string | undefined),
                role: roleFromMetadata || "school_admin",
                pendingOnboarding: true,
              },
            ],
            { session }
          );
          user = created[0];
        }

        if (!user.schoolId) {
          const invite = (await Invite.findOne({
            email: primaryEmail.toLowerCase(),
            status: "pending",
            expiresAt: { $gt: new Date() },
          })
            .sort({ createdAt: -1 })
            .session(session)
            .lean()) as IInvite | null;

          if (invite) {
            await User.updateOne(
              { _id: user._id },
              { $set: { schoolId: invite.schoolId } },
              { session }
            );
            user.schoolId = invite.schoolId;
          }
        }

        return user.toObject() as IUser;
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to bootstrap onboarding";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  const school = appUser.schoolId
    ? ((await School.findById(appUser.schoolId).lean()) as ISchool | null)
    : null;

  const schoolTypeRaw = (school as { type?: string } | null)?.type;
  const isSecondary = schoolTypeRaw === "SHS" || schoolTypeRaw === "Secondary";
  const curriculumCode =
    (school as ISchool | null)?.curriculumCode || "ghana_nacca";
  const schoolTypeForClient = isSecondary ? "Secondary" : "Basic";

  const displayNames = await enrichUserNamesFromApplication(
    primaryEmail,
    appUser.firstName,
    appUser.lastName
  );

  return NextResponse.json({
    user: {
      email: appUser.email,
      firstName: displayNames.firstName,
      lastName: displayNames.lastName,
      phone: appUser.phone ?? "",
      dateOfBirth: appUser.dateOfBirth ?? "",
      address: appUser.address ?? "",
      avatarUrl: appUser.avatarUrl ?? "",
      pendingOnboarding: appUser.pendingOnboarding !== false,
    },
    school: school
      ? {
          id: String(school._id),
          name: school.name,
          type: schoolTypeForClient,
          curriculumCode,
          address: school.address ?? "",
          city: school.city ?? "",
          region: school.region ?? "",
          bank: school.bank ?? {},
          paymentSetup: {
            status: school.billing?.paymentSetup?.status ?? "not_started",
            ownerName: school.billing?.paymentSetup?.ownerName ?? "",
            ownerEmail: school.billing?.paymentSetup?.ownerEmail ?? "",
          },
          status: school.status,
        }
      : null,
  });
}
