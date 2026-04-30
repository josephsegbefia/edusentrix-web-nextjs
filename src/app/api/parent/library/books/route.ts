import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireParent } from "@/lib/auth/requireParent";
import { listLibraryBooks } from "@/lib/library/library-book.service";
import { listLibraryBooksQuerySchema } from "@/lib/library/library.validators";
import { serializeLibraryBookPatron } from "@/lib/library/library.serialize";

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireParent();
    await connectToDatabase();
    const sp = Object.fromEntries(new URL(req.url).searchParams);
    const parsed = listLibraryBooksQuerySchema.safeParse(sp);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "validation", message: parsed.error.message } },
        { status: 400 }
      );
    }
    const q = {
      ...parsed.data,
      status: "active" as const,
      limit: Math.min(parsed.data.limit, 50),
    };
    const { items, total } = await listLibraryBooks(ctx.schoolId, q);
    const page = q.page;
    const limit = q.limit;
    const totalPages = limit > 0 ? Math.max(1, Math.ceil(total / limit)) : 1;
    return NextResponse.json({
      success: true,
      data: {
        items: items.map(serializeLibraryBookPatron),
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
