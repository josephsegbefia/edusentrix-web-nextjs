import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireEnabledSchoolLeo } from "@/lib/leo/require-enabled-school-leo";
import { LeoConversation } from "@/models/LeoConversation";

export const dynamic = "force-dynamic";

const CreateConversationSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  sourceRoute: z.string().trim().max(500).nullable().optional(),
  sourceTab: z.string().trim().max(120).nullable().optional(),
});

function serializeConversation(doc: {
  _id: unknown;
  title: string;
  sourceApp: string;
  sourceRoute?: string | null;
  sourceTab?: string | null;
  pinned: boolean;
  archivedAt?: Date | null;
  lastMessageAt: Date;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: String(doc._id),
    title: doc.title,
    sourceApp: doc.sourceApp,
    sourceRoute: doc.sourceRoute ?? null,
    sourceTab: doc.sourceTab ?? null,
    pinned: !!doc.pinned,
    archivedAt: doc.archivedAt ? new Date(doc.archivedAt).toISOString() : null,
    lastMessageAt: new Date(doc.lastMessageAt).toISOString(),
    createdAt: new Date(doc.createdAt).toISOString(),
    updatedAt: new Date(doc.updatedAt).toISOString(),
  };
}

export async function GET() {
  try {
    const ctx = await requireEnabledSchoolLeo();
    await connectToDatabase();

    const conversations = await LeoConversation.find({
      schoolId: ctx.schoolId,
      userId: ctx.userId,
      archivedAt: null,
    })
      .sort({ pinned: -1, lastMessageAt: -1 })
      .limit(30)
      .lean();

    return NextResponse.json({
      success: true,
      data: conversations.map(serializeConversation),
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Leo conversations GET error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load Leo conversations" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireEnabledSchoolLeo();
    const body = await req.json().catch(() => ({}));
    const parsed = CreateConversationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    await connectToDatabase();
    const doc = await LeoConversation.create({
      schoolId: ctx.schoolId,
      userId: ctx.userId,
      role: ctx.role,
      sourceApp: ctx.sourceApp,
      title: parsed.data.title || "New Leo chat",
      sourceRoute: parsed.data.sourceRoute ?? null,
      sourceTab: parsed.data.sourceTab ?? null,
      lastMessageAt: new Date(),
    });

    return NextResponse.json(
      { success: true, data: serializeConversation(doc.toObject()) },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Leo conversations POST error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create Leo conversation" },
      { status: 500 }
    );
  }
}
