import connectToDatabase from "@/db/connectToDatabase";
import { supabaseServer } from "@/lib/supabase/server";
import { Invite, IInvite } from "@/models/Invite";
import { School, ISchool } from "@/models/School";
import { User } from "@/models/User";

import { NextResponse } from "next/server";

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
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();

  if (!data?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectToDatabase();

  let appUser = await User.findOne({ supabaseUserId: data.user.id });

  if (!appUser) {
    appUser = await User.create({
      supabaseUserId: data.user.id,
      email: data.user.email.toLocaleLowerCase(),
      firstName: data.user.user_metadata?.full_name,
      lastName: data.user.user_metadata?.last_name,
      roles: [],
      pendingOnboarding: true,
    });
  }

  // IF user is not bound to a school, attach with latest valid invite for this email
  if (!appUser.schoolId) {
    const invite = (await Invite.findOne({
      email: data.user.email.toLocaleLowerCase(),
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

  const school = appUser.schoolId
    ? ((await School.findById(appUser.schoolId).lean()) as ISchool | null)
    : null;
  const subjectSuggestions =
    school?.type === "Secondary" ? SECONDARY_SUBJECTS : BASIC_SUBJECTS;

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
    subjectSuggestions: subjectSuggestions,
  });
}
