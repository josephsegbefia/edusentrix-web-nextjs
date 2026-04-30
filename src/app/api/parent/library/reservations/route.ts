import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { getParentWardIds, requireParent } from "@/lib/auth/requireParent";
import { Student } from "@/models/Student";
import {
  parentCreateLibraryReservationBodySchema,
} from "@/lib/library/library.validators";
import {
  createLibraryReservation,
  libraryReservationListFromDocs,
  listParentWardLibraryReservations,
} from "@/lib/library/library-reservation.service";

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireParent();
    await connectToDatabase();
    const wardIds = await getParentWardIds(ctx.userId);
    if (wardIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: { wards: [], items: [] as unknown[] },
      });
    }
    const bookIdRaw = req.nextUrl.searchParams.get("bookId")?.trim();
    const bookOid =
      bookIdRaw && mongoose.Types.ObjectId.isValid(bookIdRaw)
        ? new mongoose.Types.ObjectId(bookIdRaw)
        : undefined;

    const wards = await Student.find({
      _id: { $in: wardIds },
      schoolId: ctx.schoolId,
      status: "active",
    })
      .select("firstName lastName")
      .lean();

    const items = await listParentWardLibraryReservations(
      ctx.schoolId,
      wardIds,
      bookOid ? { bookId: bookOid } : undefined
    );

    return NextResponse.json({
      success: true,
      data: {
        wards: wards.map((s) => ({
          id: String((s as { _id: mongoose.Types.ObjectId })._id),
          firstName: (s as { firstName: string }).firstName,
          lastName: (s as { lastName: string }).lastName,
        })),
        items,
      },
    });
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
    const ctx = await requireParent();
    await connectToDatabase();
    const schoolId = ctx.schoolId;
    const userId = ctx.userId;
    const wardIds = await getParentWardIds(userId);
    if (wardIds.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "forbidden", message: "No linked students" },
        },
        { status: 403 }
      );
    }
    const body = (await req.json()) as unknown;
    const parsed = parentCreateLibraryReservationBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "validation", message: parsed.error.message } },
        { status: 400 }
      );
    }
    if (!mongoose.Types.ObjectId.isValid(parsed.data.studentId)) {
      return NextResponse.json(
        { success: false, error: { code: "validation", message: "Invalid student id" } },
        { status: 400 }
      );
    }
    const studentOid = new mongoose.Types.ObjectId(parsed.data.studentId);
    const allowed = wardIds.some((id) => String(id) === String(studentOid));
    if (!allowed) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "forbidden", message: "Student is not linked to this account" },
        },
        { status: 403 }
      );
    }
    try {
      const doc = await createLibraryReservation(schoolId, userId, {
        bookId: parsed.data.bookId,
        borrowerType: "student",
        borrowerId: String(studentOid),
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
