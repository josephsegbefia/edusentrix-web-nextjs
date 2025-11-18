import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Invite, IInvite } from "@/models/Invite";
import { School, ISchool } from "@/models/School";
import { User } from "@/models/User";

const BASIC_SUBJECTS = [
  "Mathematics",
  "English Language",
  "Science",
  "Social Studies",
  "Religious & Moral Education",
  "ICT",
  "French",
  "Ghanaian Language",
  "Creative Arts",
  "Physical Education",
];

const SECONDARY_SUBJECTS = [
  "Core Mathematics",
  "English Language",
  "Integrated Science",
  "Social Studies",
  "Biology",
  "Chemistry",
  "Physics",
  "Geography",
  "Economics",
  "Government",
  "Elective Mathematics",
  "Literature-in-English",
  "ICT",
];

export async function GET() {
  // 1) Require a signed-in Clerk session
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2) Load the Clerk user and primary email
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

  // 3) DB bootstrap / lookup
  await connectToDatabase();

  let appUser = await User.findOne({ clerkUserId: clerkUser.id });

  // If we don't have a local user yet, create one from Clerk profile
  if (!appUser) {
    const roleFromMetadata =
      (clerkUser.publicMetadata?.role as string | undefined) || undefined;

    appUser = await User.create({
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
    });
  }

  // 4) If the user isn't attached to a school yet, bind via latest valid invite
  if (!appUser.schoolId) {
    const invite = (await Invite.findOne({
      email: primaryEmail.toLowerCase(),
      status: "pending",
      expiresAt: { $gt: new Date() },
    })
      .sort({ createdAt: -1 })
      .lean()) as IInvite | null;

    if (invite) {
      appUser.schoolId = invite.schoolId;
      await appUser.save();
    }
  }

  // 5) Fetch school + subject suggestions
  const school = appUser.schoolId
    ? ((await School.findById(appUser.schoolId).lean()) as ISchool | null)
    : null;

  const subjectSuggestions =
    school?.type === "Secondary" ? SECONDARY_SUBJECTS : BASIC_SUBJECTS;

  // 6) Response in the same shape your frontend expects
  return NextResponse.json({
    user: {
      email: appUser.email,
      firstName: appUser.firstName ?? "",
      lastName: appUser.lastName ?? "",
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
          type: school.type,
          address: school.address ?? "",
          city: school.city ?? "",
          region: school.region ?? "",
          bank: school.bank ?? {},
          status: school.status,
        }
      : null,
    subjectSuggestions,
  });
}
