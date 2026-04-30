import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdminOrDelegatedAllPermissions } from "@/lib/delegations/requireDelegatedModulePermission";
import { LIBRARY_PERMISSIONS } from "@/lib/library/library.permissions";
import {
  auditLibraryLoanIssued,
  auditLibraryReservationFulfilled,
} from "@/lib/library/library-audit";
import {
  fulfillLibraryReservation,
  getLibraryReservationById,
  libraryReservationListFromDocs,
} from "@/lib/library/library-reservation.service";
import { getLibraryLoanById, libraryLoanListFromDocs } from "@/lib/library/library-loan.service";

function toOid(id: unknown) {
  return new mongoose.Types.ObjectId(String(id));
}

type RouteCtx = { params: Promise<{ reservationId: string }> };

export async function POST(req: NextRequest, ctx: RouteCtx) {
  try {
    const { schoolId, userId } = await requireSchoolAdminOrDelegatedAllPermissions([
      LIBRARY_PERMISSIONS.RESERVATIONS_MANAGE,
      LIBRARY_PERMISSIONS.LOANS_ISSUE,
    ]);
    const { reservationId } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(reservationId)) {
      return NextResponse.json(
        { success: false, error: { code: "validation", message: "Invalid reservation id" } },
        { status: 400 }
      );
    }
    await connectToDatabase();
    const schoolO = toOid(schoolId);
    const userO = toOid(userId);
    const rid = new mongoose.Types.ObjectId(reservationId);
    const before = await getLibraryReservationById(schoolO, rid);
    if (!before) {
      return NextResponse.json(
        { success: false, error: { code: "not_found", message: "Reservation not found" } },
        { status: 404 }
      );
    }
    try {
      const out = await fulfillLibraryReservation(schoolO, userO, rid);
      if (!out) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "validation",
              message: "Reservation must be ready to fulfill",
            },
          },
          { status: 400 }
        );
      }
      await auditLibraryReservationFulfilled(req, schoolO, userO, rid, {
        bookId: String(before.bookId),
        loanId: String(out.loanId),
      });
      await auditLibraryLoanIssued(req, schoolO, userO, out.loanId, {
        bookId: String(out.reservation.bookId),
        bookCopyId: String(before.bookCopyId ?? ""),
        borrowerType: out.reservation.borrowerType,
        borrowerId: String(out.reservation.borrowerId),
        fromReservationId: String(rid),
      });
      const loanDoc = await getLibraryLoanById(schoolO, out.loanId);
      const [resDto] = await libraryReservationListFromDocs(schoolO, [out.reservation]);
      const loanDto = loanDoc ? (await libraryLoanListFromDocs(schoolO, [loanDoc]))[0] : null;
      return NextResponse.json({
        success: true,
        data: { reservation: resDto, loan: loanDto },
      });
    } catch (err) {
      const m = err instanceof Error ? err.message : "Fulfill failed";
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
