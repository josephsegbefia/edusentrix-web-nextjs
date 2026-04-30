import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import {
  cancelPatronLibraryReservation,
  libraryReservationListFromDocs,
} from "@/lib/library/library-reservation.service";

type RouteCtx = { params: Promise<{ reservationId: string }> };

export async function POST(_req: Request, ctx: RouteCtx) {
  try {
    const t = await requireTeacher();
    const { reservationId } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(reservationId)) {
      return NextResponse.json(
        { success: false, error: { code: "validation", message: "Invalid reservation id" } },
        { status: 400 }
      );
    }
    await connectToDatabase();
    const rid = new mongoose.Types.ObjectId(reservationId);
    try {
      const doc = await cancelPatronLibraryReservation(
        t.schoolId,
        t.userId,
        rid,
        "teacher",
        t.teacherId
      );
      if (!doc) {
        return NextResponse.json(
          { success: false, error: { code: "not_found", message: "Reservation not found" } },
          { status: 404 }
        );
      }
      const [dto] = await libraryReservationListFromDocs(t.schoolId, [doc]);
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
