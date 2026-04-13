import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { buildCoverageMatrix } from "@/lib/demo/coverage-matrix";

export async function GET() {
  const auth = await requirePlatformAdmin();
  if (!auth.ok) return auth.res;

  const matrix = buildCoverageMatrix();

  return NextResponse.json({
    success: true,
    data: matrix,
  });
}
