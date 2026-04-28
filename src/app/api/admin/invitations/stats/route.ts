import { requireSchoolAdminOrDelegatedModuleView } from "@/lib/delegations/requireDelegatedModulePermission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Invitation } from "@/models/Invitation";
import mongoose from "mongoose";

export async function GET() {
  try {
    const { schoolId } = await requireSchoolAdminOrDelegatedModuleView("invitations");
    await connectToDatabase();

    if (!schoolId) {
      throw new Error("Missing schoolId for invitation stats lookup");
    }

    const schoolIdObj = new mongoose.Types.ObjectId(String(schoolId));

    const [total, pending, accepted, expired, revoked, failed] = await Promise.all([
      Invitation.countDocuments({ schoolId: schoolIdObj }),
      Invitation.countDocuments({ schoolId: schoolIdObj, status: "pending" }),
      Invitation.countDocuments({ schoolId: schoolIdObj, status: "accepted" }),
      Invitation.countDocuments({ schoolId: schoolIdObj, status: "expired" }),
      Invitation.countDocuments({ schoolId: schoolIdObj, status: "revoked" }),
      Invitation.countDocuments({ schoolId: schoolIdObj, status: "failed" }),
    ]);

    // Count by role
    const byRole = await Invitation.aggregate([
      { $match: { schoolId: schoolIdObj } },
      {
        $group: {
          _id: "$role",
          count: { $sum: 1 },
        },
      },
    ]);

    const roleCounts = {
      teacher: 0,
      staff: 0,
      school_admin: 0,
      billing_owner: 0,
      parent: 0,
      bursar: 0,
    };

    byRole.forEach((item) => {
      if (item._id in roleCounts) {
        roleCounts[item._id as keyof typeof roleCounts] = item.count;
      }
    });

    return Response.json({
      success: true,
      data: {
        total,
        pending,
        accepted,
        expired,
        revoked,
        failed,
        byRole: roleCounts,
      },
    });
  } catch (e: unknown) {
    console.error("Failed to fetch invitation stats:", e);
    const message =
      e instanceof Error ? e.message : "Failed to fetch invitation stats";
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
