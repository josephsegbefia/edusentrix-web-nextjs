import { NextRequest, NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Invitation } from "@/models/Invitation";

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded =
    normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded, "base64").toString("utf8");
}

function extractInvitationIdFromTicket(ticket: string) {
  try {
    const parts = ticket.split(".");
    if (parts.length < 2) return "";
    const payloadRaw = decodeBase64Url(parts[1]);
    const payload = JSON.parse(payloadRaw) as { sid?: string };
    return typeof payload.sid === "string" ? payload.sid.trim() : "";
  } catch {
    return "";
  }
}

export async function GET(req: NextRequest) {
  const ticket = req.nextUrl.searchParams.get("ticket")?.trim() || "";
  if (!ticket) {
    return NextResponse.json(
      { success: false, error: "Missing invitation ticket" },
      { status: 400 }
    );
  }

  const invitationId = extractInvitationIdFromTicket(ticket);
  if (!invitationId) {
    return NextResponse.json(
      { success: false, error: "Invalid invitation ticket" },
      { status: 400 }
    );
  }

  try {
    await connectToDatabase();

    const localInvitation = await Invitation.findOne({
      clerkInvitationId: invitationId,
    })
      .select("email")
      .lean<{ email?: string } | null>();

    const localEmail = localInvitation?.email?.trim().toLowerCase() || "";
    if (localEmail) {
      return NextResponse.json({
        success: true,
        data: { email: localEmail },
      });
    }

    const clerk = await clerkClient();
    const response = await clerk.invitations.getInvitationList({
      query: invitationId,
      limit: 1,
    });

    const clerkEmail =
      response.data?.[0]?.emailAddress?.trim().toLowerCase() || "";

    if (!clerkEmail) {
      return NextResponse.json(
        { success: false, error: "Invitation email not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { email: clerkEmail },
    });
  } catch (error) {
    console.error("Failed to resolve invitation email:", error);
    return NextResponse.json(
      { success: false, error: "Failed to resolve invitation email" },
      { status: 500 }
    );
  }
}
