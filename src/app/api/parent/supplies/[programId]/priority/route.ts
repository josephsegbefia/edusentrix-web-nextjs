import { NextResponse } from "next/server";
import { requireParent } from "@/lib/auth/requireParent";

export async function PATCH() {
  try {
    await requireParent();
    return NextResponse.json({ success: true, data: { success: true } });
  } catch (error) {
    if (error instanceof Response) return error;
    const message = error instanceof Error ? error.message : "Failed to update priority";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
