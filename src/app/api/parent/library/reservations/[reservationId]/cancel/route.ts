import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { getParentWardIds, requireParent } from "@/lib/auth/requireParent";
import {
  cancelParentLibraryReservation,
  libraryReservationListFromDocs,
} from "@/lib/library/library-reservation.service";

type RouteCtx = { params: Promise<{ reservationId: string }> };

export async function POST(_req: Request, ctx: RouteCtx) {
  try {
    const member = await requireParent();
    const { reservationId } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(reservationId)) {
      return NextResponse.json(
        { success: false, error: { code: "validation", message: "Invalid reservation id" } },
        { status: 400 }
      );
    }
    await connectToDatabase();
    const schoolId = member.schoolId;
    const userId = member.userId;
    const wardIds = await getParentWardIds(userId);
    if (wardIds.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: "forbidden", message: "No linked students" } },
        { status: 403 }
      );
    }
    const rid = new mongoose.Types.ObjectId(reservationId);
    try {
      const doc = await cancelParentLibraryReservation(schoolId, userId, rid, wardIds);
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
