import { NextRequest } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Teacher } from "@/models/Teacher";
import mongoose from "mongoose";

function randomDigitString(length: number): string {
  let s = "";
  for (let i = 0; i < length; i++) {
    s += String(Math.floor(Math.random() * 10));
  }
  return s;
}

/**
 * GET /api/admin/teachers/suggest-employee-id?length=5|6
 * Returns a numeric employee ID that is not already used in the school.
 */
export async function GET(req: NextRequest) {
  const { schoolId } = await requireSchoolAdmin();
  await connectToDatabase();

  const { searchParams } = new URL(req.url);
  const lenParam = searchParams.get("length");
  let length: 5 | 6 = 6;
  if (lenParam === "5") length = 5;
  else if (lenParam === "6") length = 6;

  const schoolIdObj =
    schoolId instanceof mongoose.Types.ObjectId
      ? schoolId
      : new mongoose.Types.ObjectId(String(schoolId));

  const tryLength = async (len: number) => {
    for (let attempt = 0; attempt < 80; attempt++) {
      const candidate = randomDigitString(len);
      const clash = await Teacher.findOne({
        schoolId: schoolIdObj,
        employeeId: candidate,
      })
        .select("_id")
        .lean();
      if (!clash) {
        return candidate;
      }
    }
    return null;
  };

  let id = await tryLength(length);
  if (!id && length === 5) {
    id = await tryLength(6);
  }
  if (!id) {
    return Response.json(
      { error: "Could not generate a unique employee ID. Try again." },
      { status: 500 }
    );
  }

  return Response.json({
    success: true,
    employeeId: id,
    length: id.length,
  });
}
