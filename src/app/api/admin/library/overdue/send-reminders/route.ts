import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdminOrDelegatedAnyPermission } from "@/lib/delegations/requireDelegatedModulePermission";
import { LIBRARY_PERMISSIONS } from "@/lib/library/library.permissions";
import { librarySendRemindersSchema } from "@/lib/library/library.validators";
import { enqueueLibraryOverdueReminderNotifications } from "@/lib/library/library-notifications";

function toOid(id: unknown) {
  return new mongoose.Types.ObjectId(String(id));
}

export async function POST(req: NextRequest) {
  try {
    const { schoolId } = await requireSchoolAdminOrDelegatedAnyPermission([
      LIBRARY_PERMISSIONS.LOANS_READ,
    ]);
    await connectToDatabase();
    const body = (await req.json()) as unknown;
    const parsed = librarySendRemindersSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "validation", message: parsed.error.message } },
        { status: 400 }
      );
    }
    const ids = parsed.data.loanIds
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));
    if (ids.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: "validation", message: "No valid loan ids" } },
        { status: 400 }
      );
    }
    const { enqueued, skippedLoans } = await enqueueLibraryOverdueReminderNotifications({
      schoolId: toOid(schoolId),
      loanIds: ids,
      body: parsed.data.message,
    });
    return NextResponse.json({ success: true, data: { enqueued, skippedLoans } });
  } catch (e) {
    if (e instanceof Response) return e;
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json(
      { success: false, error: { code: "error", message: msg } },
      { status: 500 }
    );
  }
}
