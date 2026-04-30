import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { patronCreateLibraryReservationBodySchema } from "@/lib/library/library.validators";
import {
  createLibraryReservation,
  libraryReservationListFromDocs,
  listPatronLibraryReservations,
} from "@/lib/library/library-reservation.service";

export async function GET() {
  try {
    const ctx = await requireTeacher();
    await connectToDatabase();
    const items = await listPatronLibraryReservations(
      ctx.schoolId,
      "teacher",
      ctx.teacherId
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
    const ctx = await requireTeacher();
    await connectToDatabase();
    const body = (await req.json()) as unknown;
    const parsed = patronCreateLibraryReservationBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "validation", message: parsed.error.message } },
        { status: 400 }
      );
    }
    try {
      const doc = await createLibraryReservation(ctx.schoolId, ctx.userId, {
        bookId: parsed.data.bookId,
        borrowerType: "teacher",
        borrowerId: String(ctx.teacherId),
      });
      const [dto] = await libraryReservationListFromDocs(ctx.schoolId, [doc]);
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
