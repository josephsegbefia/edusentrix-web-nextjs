import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import type { ISchool } from "@/models/School";
import type { IUser } from "@/models/User";
import { enrichUserNamesFromApplication } from "@/lib/onboarding/enrichUserNamesFromApplication";
import { resolveOnboardingSchoolForUser } from "@/lib/onboarding/resolve-onboarding-school";
import { ensureCanonicalUserForClerkSession } from "@/lib/auth/canonical-user";
import { schoolIdFromClerkMetadata } from "@/lib/auth/resolveTenantUserForClerkSession";

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

  let appUser: IUser;
  try {
    const roleFromMetadata =
      (clerkUser.publicMetadata?.role as string | undefined) || "school_admin";
    appUser = await ensureCanonicalUserForClerkSession({
      clerkUserId: clerkUser.id,
      email: primaryEmail,
      firstName:
        clerkUser.firstName ||
        (clerkUser.publicMetadata?.firstName as string | undefined),
      lastName:
        clerkUser.lastName ||
        (clerkUser.publicMetadata?.lastName as string | undefined),
      avatarUrl: clerkUser.imageUrl,
      role: roleFromMetadata,
      schoolId: schoolIdFromClerkMetadata(clerkUser),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to bootstrap onboarding";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const school = await resolveOnboardingSchoolForUser({
    appUser,
    email: primaryEmail,
    clerkSchoolId: schoolIdFromClerkMetadata(clerkUser),
  });

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
