import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdminOrDelegatedAnyPermission } from "@/lib/delegations/requireDelegatedModulePermission";
import { LIBRARY_PERMISSIONS } from "@/lib/library/library.permissions";
import { auditLibraryReservationCancelled } from "@/lib/library/library-audit";
import {
  cancelLibraryReservation,
  getLibraryReservationById,
  libraryReservationListFromDocs,
} from "@/lib/library/library-reservation.service";

function toOid(id: unknown) {
  return new mongoose.Types.ObjectId(String(id));
}

type RouteCtx = { params: Promise<{ reservationId: string }> };

export async function POST(req: NextRequest, ctx: RouteCtx) {
  try {
    const { schoolId, userId } = await requireSchoolAdminOrDelegatedAnyPermission([
      LIBRARY_PERMISSIONS.RESERVATIONS_MANAGE,
    ]);
    const { reservationId } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(reservationId)) {
      return NextResponse.json(
        { success: false, error: { code: "validation", message: "Invalid reservation id" } },
        { status: 400 }
      );
    }
    await connectToDatabase();
    const schoolOid = toOid(schoolId);
    const userOid = toOid(userId);
    const rid = new mongoose.Types.ObjectId(reservationId);
    const before = await getLibraryReservationById(schoolOid, rid);
    if (!before) {
      return NextResponse.json(
        { success: false, error: { code: "not_found", message: "Reservation not found" } },
        { status: 404 }
      );
    }
    try {
      const doc = await cancelLibraryReservation(schoolOid, userOid, rid);
      if (!doc) {
        return NextResponse.json(
          { success: false, error: { code: "not_found", message: "Reservation not found" } },
          { status: 404 }
        );
      }
      await auditLibraryReservationCancelled(req, schoolOid, userOid, rid, {
        previousStatus: before.status,
        bookId: String(before.bookId),
      });
      const [dto] = await libraryReservationListFromDocs(schoolOid, [doc]);
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
