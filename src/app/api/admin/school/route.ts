/* eslint-disable @typescript-eslint/no-explicit-any */
// GET /api/admin/school
import { NextRequest } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { School, type ISchool } from "@/models/School";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(_req: NextRequest) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

    const school = (await School.findById(schoolId)
      .select("type name")
      .lean()) as Pick<ISchool, "type" | "name"> | null;

    if (!school) {
      return new Response("School not found", { status: 404 });
    }

    return Response.json(
      {
        success: true,
        data: {
          _id: String(schoolId),
          type: school.type,
          name: school.name,
        },
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error(error);
    const message = error instanceof Error ? error.message : "Failed to fetch school";
    return new Response(message, { status: 500 });
  }
}
