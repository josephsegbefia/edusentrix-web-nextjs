import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolMember } from "@/lib/auth/requireSchoolMember";
import { Student } from "@/models/Student";
import { patronCreateLibraryReservationBodySchema } from "@/lib/library/library.validators";
import {
  createLibraryReservation,
  libraryReservationListFromDocs,
  listPatronLibraryReservations,
} from "@/lib/library/library-reservation.service";

export async function GET() {
  try {
    const ctx = await requireSchoolMember({ allowedRoles: ["student"] });
    await connectToDatabase();
    const schoolId = ctx.schoolId as unknown as mongoose.Types.ObjectId;
    const student = await Student.findOne({
      userId: ctx.userId,
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
    const items = await listPatronLibraryReservations(
      schoolId,
      "student",
      student._id as mongoose.Types.ObjectId
    );
    return NextResponse.json({ success: true, data: { items } });
  } catch (e) {
    if (e instanceof Response) return e;
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json(
      { success: false, error: { code: "error", message: msg } },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireSchoolMember({ allowedRoles: ["student"] });
    await connectToDatabase();
    const schoolId = ctx.schoolId as unknown as mongoose.Types.ObjectId;
    const userId = ctx.userId as unknown as mongoose.Types.ObjectId;
    const student = await Student.findOne({
      userId: ctx.userId,
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
    const body = (await req.json()) as unknown;
    const parsed = patronCreateLibraryReservationBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "validation", message: parsed.error.message } },
        { status: 400 }
      );
    }
    try {
      const doc = await createLibraryReservation(schoolId, userId, {
        bookId: parsed.data.bookId,
        borrowerType: "student",
        borrowerId: String(student._id),
      });
      const [dto] = await libraryReservationListFromDocs(schoolId, [doc]);
      return NextResponse.json({ success: true, data: dto }, { status: 201 });
    } catch (err) {
      const m = err instanceof Error ? err.message : "Could not reserve";
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
