import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Teacher } from "@/models/Teacher";
import mongoose from "mongoose";

export async function GET() {
  const { schoolId } = await requireSchoolAdmin();
  await connectToDatabase();

  try {
    // Ensure schoolId is properly converted to ObjectId
    const schoolIdObj =
      schoolId instanceof mongoose.Types.ObjectId
        ? schoolId
        : new mongoose.Types.ObjectId(String(schoolId));

    const [total, active, inactive, homeroom] = await Promise.all([
      Teacher.countDocuments({ schoolId: schoolIdObj }),
      Teacher.countDocuments({ schoolId: schoolIdObj, status: "active" }),
      Teacher.countDocuments({ schoolId: schoolIdObj, status: "inactive" }),
      Teacher.countDocuments({
        schoolId: schoolIdObj,
        homeroomClassGroupId: { $ne: null },
        status: "active", // Only count active teachers with homeroom
      }),
    ]);

    return Response.json({
      success: true,
      data: { total, active, inactive, homeroom },
    });
  } catch (error) {
    console.error("Teacher stats error", error);
    return Response.json(
      { error: "Failed to fetch teacher stats" },
      { status: 500 }
    );
  }
}
