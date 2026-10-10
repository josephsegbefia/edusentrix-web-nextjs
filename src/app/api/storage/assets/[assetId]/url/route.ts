import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireLearnMobileStudent } from "@/lib/learn/mobile-auth";
import { resolveStorageActor, storageErrorResponse } from "@/lib/storage/http";
import { grantAssetDownload } from "@/lib/storage/service";
import { StorageAuthorizationError, type StorageActor } from "@/lib/storage/types";

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store",
  Vary: "Authorization, Cookie",
};

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE_HEADERS });
}

/**
 * Short-lived signed URL for one stored asset, for clients that cannot send
 * the Web session cookie with an image request (EduSentrix Konect, Learn).
 * The caller is authenticated before the asset is looked up.
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ assetId: string }> }
) {
  try {
    const { assetId } = await context.params;
    const disposition =
      req.nextUrl.searchParams.get("disposition") === "inline" ? "inline" : "attachment";

    let actor: StorageActor | null = null;
    try {
      actor = await resolveStorageActor();
    } catch (error) {
      if (!(error instanceof StorageAuthorizationError)) throw error;
      if (error.status === 403) {
        return json({ success: false, error: error.message }, 403);
      }
    }

    if (!actor && req.headers.get("authorization")) {
      const learn = await requireLearnMobileStudent(req);
      if (learn.ok) {
        actor = {
          userId: null,
          schoolId: learn.context.schoolId,
          roles: [],
          learnStudentId: learn.context.studentId,
        };
      }
    }

    if (!actor) {
      return json({ success: false, error: "Unauthorized" }, 401);
    }

    await connectToDatabase();
    const signedAt = Date.now();
    const grant = await grantAssetDownload({ actor, assetId, disposition });
    const expiresAt = new Date(signedAt + grant.expiresInSeconds * 1000).toISOString();
    return json({
      success: true,
      data: {
        url: grant.redirectUrl,
        expiresAt,
        expiresInSeconds: grant.expiresInSeconds,
      },
    });
  } catch (error) {
    const mapped = storageErrorResponse(error);
    return json(mapped.body, mapped.status);
  }
}
