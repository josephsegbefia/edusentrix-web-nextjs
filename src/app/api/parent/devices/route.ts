import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireParent } from "@/lib/auth/requireParent";
import { ParentDeviceToken } from "@/models/ParentDeviceToken";

const DeviceSchema = z.object({
  expoPushToken: z.string().min(10),
  platform: z.enum(["ios", "android", "web"]).default("ios"),
  deviceName: z.string().max(160).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireParent();
    const parsed = DeviceSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "Invalid device token" }, { status: 400 });
    }

    await connectToDatabase();
    await ParentDeviceToken.findOneAndUpdate(
      { userId: ctx.userId, expoPushToken: parsed.data.expoPushToken },
      {
        $set: {
          schoolId: ctx.schoolId,
          platform: parsed.data.platform,
          deviceName: parsed.data.deviceName ?? null,
          isActive: true,
          lastSeenAt: new Date(),
        },
      },
      { upsert: true, new: true }
    );

    return NextResponse.json({ success: true, data: { success: true } });
  } catch (error) {
    if (error instanceof Response) return error;
    const message = error instanceof Error ? error.message : "Failed to save device token";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const ctx = await requireParent();
    const parsed = z.object({ expoPushToken: z.string().min(10) }).safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "Invalid device token" }, { status: 400 });
    }

    await connectToDatabase();
    await ParentDeviceToken.updateOne(
      { userId: ctx.userId, expoPushToken: parsed.data.expoPushToken },
      { $set: { isActive: false, lastSeenAt: new Date() } }
    );

    return NextResponse.json({ success: true, data: { success: true } });
  } catch (error) {
    if (error instanceof Response) return error;
    const message = error instanceof Error ? error.message : "Failed to deactivate device token";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
