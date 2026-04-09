"use server";

import { connectToDatabase } from "@/db/connectToDatabase";
import { requireUser } from "@/lib/auth/get-current-user";
import { User } from "@/models/User";
import { School } from "@/models/School";
import { redirect } from "next/navigation";

export async function beginOnboarding() {
  const me = await requireUser(); // redirects to login if not logged in
  if (me.role !== "school_admin") redirect("/403");
  if (!me.pendingOnboarding) redirect("/admin");

  await connectToDatabase();

  // Optional: stamp a start time if you want analytics
  await User.updateOne(
    { _id: me._id },
    { $set: { onboardingStartedAt: new Date() } }
  );

  // Optional: ensure school exists and is still pending (safety);
  if (me.schoolId) {
    await School.updateOne(
      { _id: me.schoolId, status: { $ne: "active" } },
      { $setOnInsert: {} }
    );
  }

  redirect("/launch");
}
