import { NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { resolveStorageActor, storageErrorResponse } from "@/lib/storage/http";
import { grantAssetDownload } from "@/lib/storage/service";
import { StorageAuthorizationError } from "@/lib/storage/types";

export async function GET(
  req: Request,
  context: { params: Promise<{ assetId: string }> }
) {
  try {
    const { assetId } = await context.params;
    const url = new URL(req.url);
    const disposition =
      url.searchParams.get("disposition") === "inline" ? "inline" : "attachment";

    await connectToDatabase();

    let actor = null;
    try {
      actor = await resolveStorageActor();
    } catch (error) {
      if (!(error instanceof StorageAuthorizationError)) {
        throw error;
      }
    }

    const grant = await grantAssetDownload({ actor, assetId, disposition });
    const response = NextResponse.redirect(grant.redirectUrl, 302);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) {
    const mapped = storageErrorResponse(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
