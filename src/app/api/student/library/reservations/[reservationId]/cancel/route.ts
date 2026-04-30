import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolMember } from "@/lib/auth/requireSchoolMember";
import { Student } from "@/models/Student";
import {
  cancelPatronLibraryReservation,
  libraryReservationListFromDocs,
} from "@/lib/library/library-reservation.service";

type RouteCtx = { params: Promise<{ reservationId: string }> };

export async function POST(_req: Request, ctx: RouteCtx) {
  try {
    const member = await requireSchoolMember({ allowedRoles: ["student"] });
    const { reservationId } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(reservationId)) {
      return NextResponse.json(
        { success: false, error: { code: "validation", message: "Invalid reservation id" } },
        { status: 400 }
      );
    }
    await connectToDatabase();
    const schoolId = member.schoolId as unknown as mongoose.Types.ObjectId;
    const userId = member.userId as unknown as mongoose.Types.ObjectId;
    const student = await Student.findOne({
      userId: member.userId,
      schoolId,
      status: "active",
    })
      .select("_id")
      .lean();
    if (!student) {
      return NextResponse.json(
        { success: false, error: { code: "not_found", message: "Student record not found" } },
        { status: 404 }
      );
    }
    const rid = new mongoose.Types.ObjectId(reservationId);
    try {
      const doc = await cancelPatronLibraryReservation(
        schoolId,
        userId,
        rid,
        "student",
        student._id as mongoose.Types.ObjectId
      );
      if (!doc) {
        return NextResponse.json(
          { success: false, error: { code: "not_found", message: "Reservation not found" } },
          { status: 404 }
        );
      }
      const [dto] = await libraryReservationListFromDocs(schoolId, [doc]);
      return NextResponse.json({ success: true, data: dto });
    } catch (err) {
      const m = err instanceof Error ? err.message : "Cancel failed";
      return NextResponse.json(
        { success: false, error: { code: "validation", message: m } },
        { status: 400 }
      );
    }
  } catch (e) {
    if (e instanceof Response) return e;
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json(
      { success: false, error: { code: "error", message: msg } },
      { status: 500 }
    );
  }
}
