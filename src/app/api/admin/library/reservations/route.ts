import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdminOrDelegatedAnyPermission } from "@/lib/delegations/requireDelegatedModulePermission";
import { LIBRARY_PERMISSIONS } from "@/lib/library/library.permissions";
import {
  auditLibraryReservationCreated,
} from "@/lib/library/library-audit";
import {
  createLibraryReservationBodySchema,
  listLibraryReservationsQuerySchema,
} from "@/lib/library/library.validators";
import {
  createLibraryReservation,
  libraryReservationListFromDocs,
  listLibraryReservations,
} from "@/lib/library/library-reservation.service";

function toOid(id: unknown) {
  return new mongoose.Types.ObjectId(String(id));
}

export async function GET(req: NextRequest) {
  try {
    const { schoolId } = await requireSchoolAdminOrDelegatedAnyPermission([
      LIBRARY_PERMISSIONS.RESERVATIONS_READ,
    ]);
    await connectToDatabase();
    const raw = Object.fromEntries(req.nextUrl.searchParams.entries());
    const parsed = listLibraryReservationsQuerySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "validation", message: parsed.error.message } },
        { status: 400 }
      );
    }
    const schoolOid = toOid(schoolId);
    const { items, total } = await listLibraryReservations(schoolOid, parsed.data);
    const page = parsed.data.page;
    const limit = parsed.data.limit;
    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
    return NextResponse.json({
      success: true,
      data: {
        items,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
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
    const { schoolId, userId } = await requireSchoolAdminOrDelegatedAnyPermission([
      LIBRARY_PERMISSIONS.RESERVATIONS_MANAGE,
    ]);
    await connectToDatabase();
    const body = (await req.json()) as unknown;
    const parsed = createLibraryReservationBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "validation", message: parsed.error.message } },
        { status: 400 }
      );
    }
    const schoolOid = toOid(schoolId);
    const userOid = toOid(userId);
    try {
      const doc = await createLibraryReservation(schoolOid, userOid, parsed.data);
      const rid = doc._id as mongoose.Types.ObjectId;
      await auditLibraryReservationCreated(req, schoolOid, userOid, rid, {
        bookId: String(doc.bookId),
        borrowerType: doc.borrowerType,
        borrowerId: String(doc.borrowerId),
        status: doc.status,
        queuePosition: doc.queuePosition,
      });
      const [dto] = await libraryReservationListFromDocs(schoolOid, [doc]);
      return NextResponse.json({ success: true, data: dto }, { status: 201 });
    } catch (err) {
      const m = err instanceof Error ? err.message : "Create failed";
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
