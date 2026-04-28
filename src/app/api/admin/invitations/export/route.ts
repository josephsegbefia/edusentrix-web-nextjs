import { NextRequest } from "next/server";
import { requireSchoolAdminOrDelegatedModuleView } from "@/lib/delegations/requireDelegatedModulePermission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Invitation } from "@/models/Invitation";
import mongoose from "mongoose";

type InvitationInvitedBy = {
  firstName?: string;
  lastName?: string;
  email: string;
};

export async function GET(req: NextRequest) {
  try {
    const { schoolId } = await requireSchoolAdminOrDelegatedModuleView("invitations");
    await connectToDatabase();

    if (!schoolId) {
      return new Response(
        JSON.stringify({ success: false, error: "School ID not found" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Convert schoolId to ObjectId (inside try-catch to handle invalid formats)
    const schoolIdObj =
      schoolId instanceof mongoose.Types.ObjectId
        ? schoolId
        : new mongoose.Types.ObjectId(String(schoolId));

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") as
      | "pending"
      | "accepted"
      | "expired"
      | "revoked"
      | "failed"
      | null;
    const role = searchParams.get("role") as
      | "teacher"
      | "staff"
      | "school_admin"
      | "billing_owner"
      | "parent"
      | "bursar"
      | null;

    const filter: Record<string, unknown> = {
      schoolId: schoolIdObj,
    };

    if (status) {
      filter.status = status;
    }

    if (role) {
      filter.role = role;
    }

    const invitations = await Invitation.find(filter)
      .sort({ sentAt: -1 })
      .populate("invitedBy", "firstName lastName email")
      .lean();

    // Convert to CSV
    const headers = [
      "Email",
      "Role",
      "Status",
      "Sent Date",
      "Expires Date",
      "Accepted Date",
      "Resend Count",
      "Invited By",
    ];

    const rows = invitations.map((inv) => {
      const invitedByMeta = inv.invitedBy as InvitationInvitedBy | null;
      const invitedBy = inv.invitedBy
        ? `${invitedByMeta?.firstName || ""} ${invitedByMeta?.lastName || ""}`.trim() ||
          invitedByMeta?.email
        : "—";

      return [
        inv.email,
        inv.role,
        inv.status,
        new Date(inv.sentAt).toLocaleDateString(),
        new Date(inv.expiresAt).toLocaleDateString(),
        inv.acceptedAt ? new Date(inv.acceptedAt).toLocaleDateString() : "—",
        String(inv.resendCount),
        invitedBy,
      ];
    });

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="invitations-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  } catch (e: unknown) {
    console.error("Failed to export invitations:", e);
    const message =
      e instanceof Error ? e.message : "Failed to export invitations";
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
