import { NextResponse } from "next/server";
import { auth, currentUser as clerkCurrentUser } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { User } from "@/models/User";

export async function GET() {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectToDatabase();

  const docRaw = await User.findOne({ clerkUserId: userId })
    .select(
      "_id email firstName lastName avatarUrl role schoolId pendingOnboarding createdAt updatedAt"
    )
    .lean();

  // Normalize to ensure it's a single document, not an array
  let doc = Array.isArray(docRaw) ? docRaw[0] : docRaw;

  if (!doc) {
    const cu = await clerkCurrentUser();
    const email = cu?.emailAddresses?.[0]?.emailAddress?.toLowerCase();
    if (!email)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const byEmailRaw = await User.findOne({ email }).lean();
    if (!byEmailRaw)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Normalize to ensure it's a single document, not an array
    const byEmail = Array.isArray(byEmailRaw) ? byEmailRaw[0] : byEmailRaw;
    if (!byEmail)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await User.updateOne(
      { _id: byEmail._id },
      { $set: { clerkUserId: userId } }
    );
    doc = byEmail;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const docTyped = doc as any;
  const name =
    [docTyped.firstName, docTyped.lastName].filter(Boolean).join(" ") ||
    undefined;

  return NextResponse.json({
    _id: String(doc._id),
    email: doc.email,
    name,
    avatarUrl: doc.avatarUrl,
    role: doc.role,
    schoolId: doc.schoolId ? String(doc.schoolId) : null,
    pendingOnboarding: !!doc.pendingOnboarding,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  });
}
