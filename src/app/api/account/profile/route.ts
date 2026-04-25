import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { School } from "@/models/School";
import { User, type IUser } from "@/models/User";
import { isDemoMode } from "@/lib/demo/runtime";

export const runtime = "nodejs";

const ProfileUpdateSchema = z.object({
  email: z.string().trim().email().toLowerCase(),
  phone: z.string().trim().max(40).optional().nullable(),
  avatarUrl: z.string().trim().url().optional().nullable(),
  avatarPublicId: z.string().trim().max(240).optional().nullable(),
  dateOfBirth: z.string().trim().optional().nullable(),
  address: z.string().trim().max(500).optional().nullable(),
});

async function requireAccountUser() {
  const { userId } = await auth();
  if (!userId) {
    return {
      error: NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      ),
    };
  }

  await connectToDatabase();
  const user = await User.findOne({ clerkUserId: userId });
  if (!user) {
    return {
      error: NextResponse.json(
        { success: false, error: "Profile not found" },
        { status: 404 },
      ),
    };
  }

  return { userId, user };
}

function serializeUser(
  user: IUser,
  school?: {
    _id: unknown;
    name?: string | null;
    logo?: string | null;
  } | null,
) {
  if (!user) return null;
  const name =
    [user.firstName, user.lastName].filter(Boolean).join(" ") ||
    user.name ||
    user.email;

  return {
    _id: String(user._id),
    name,
    firstName: user.firstName || "",
    lastName: user.lastName || "",
    email: user.email,
    phone: user.phone || "",
    avatarUrl: user.avatarUrl || "",
    avatarPublicId: user.avatarPublicId || "",
    role: user.role || null,
    schoolId: user.schoolId ? String(user.schoolId) : null,
    school: school
      ? {
          _id: String(school._id),
          name: school.name || "School",
          logo: school.logo || null,
        }
      : null,
    dateOfBirth: user.dateOfBirth
      ? new Date(user.dateOfBirth).toISOString().slice(0, 10)
      : "",
    address: user.address || "",
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export async function GET() {
  try {
    const result = await requireAccountUser();
    if ("error" in result) return result.error;

    const school = result.user.schoolId
      ? await School.findById(result.user.schoolId)
          .select("name logo")
          .lean<{
            _id: unknown;
            name?: string | null;
            logo?: string | null;
          } | null>()
      : null;

    return NextResponse.json({
      success: true,
      data: serializeUser(result.user, school),
    });
  } catch (error) {
    console.error("[account/profile GET]", error);
    return NextResponse.json(
      { success: false, error: "Failed to load profile" },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    if (isDemoMode()) {
      return NextResponse.json(
        { success: false, error: "Profile changes are disabled in demo mode." },
        { status: 403 },
      );
    }

    const result = await requireAccountUser();
    if ("error" in result) return result.error;

    const parsed = ProfileUpdateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.issues[0]?.message || "Invalid profile details",
        },
        { status: 400 },
      );
    }

    const dateOfBirth = parsed.data.dateOfBirth
      ? new Date(parsed.data.dateOfBirth)
      : null;
    if (dateOfBirth && Number.isNaN(dateOfBirth.getTime())) {
      return NextResponse.json(
        { success: false, error: "Invalid date of birth." },
        { status: 400 },
      );
    }

    if (parsed.data.email !== result.user.email) {
      if (result.user.schoolId) {
        const duplicate = await User.exists({
          _id: { $ne: result.user._id },
          schoolId: result.user.schoolId,
          email: parsed.data.email,
        });
        if (duplicate) {
          return NextResponse.json(
            {
              success: false,
              error: "Another user in this school already uses that email.",
            },
            { status: 409 },
          );
        }
      }

      try {
        await syncClerkPrimaryEmail(result.userId, parsed.data.email);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Could not update your sign-in email.";
        return NextResponse.json(
          { success: false, error: message },
          { status: 400 },
        );
      }
    }

    result.user.email = parsed.data.email;
    result.user.phone = parsed.data.phone || undefined;
    result.user.avatarUrl = parsed.data.avatarUrl || undefined;
    result.user.avatarPublicId = parsed.data.avatarPublicId || undefined;
    result.user.dateOfBirth = dateOfBirth || undefined;
    result.user.address = parsed.data.address || undefined;
    await result.user.save();

    const school = result.user.schoolId
      ? await School.findById(result.user.schoolId)
          .select("name logo")
          .lean<{
            _id: unknown;
            name?: string | null;
            logo?: string | null;
          } | null>()
      : null;

    return NextResponse.json({
      success: true,
      data: serializeUser(result.user, school),
    });
  } catch (error) {
    console.error("[account/profile PATCH]", error);
    return NextResponse.json(
      { success: false, error: "Failed to update profile" },
      { status: 500 },
    );
  }
}

async function syncClerkPrimaryEmail(userId: string, email: string) {
  const clerk = await clerkClient();
  const clerkUser = await clerk.users.getUser(userId);
  const existing = clerkUser.emailAddresses.find(
    (item) => item.emailAddress.toLowerCase() === email.toLowerCase(),
  );

  if (existing) {
    await clerk.emailAddresses.updateEmailAddress(existing.id, {
      verified: true,
      primary: true,
    });
    return;
  }

  await clerk.emailAddresses.createEmailAddress({
    userId,
    emailAddress: email,
    verified: true,
    primary: true,
  });
}

export async function DELETE() {
  try {
    if (isDemoMode()) {
      return NextResponse.json(
        { success: false, error: "Account deletion is disabled in demo mode." },
        { status: 403 },
      );
    }

    const result = await requireAccountUser();
    if ("error" in result) return result.error;

    const clerk = await clerkClient();
    await clerk.users.deleteUser(result.userId);
    await User.deleteOne({ _id: result.user._id });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[account/profile DELETE]", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete account" },
      { status: 500 },
    );
  }
}
