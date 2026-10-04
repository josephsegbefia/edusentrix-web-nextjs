import { NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { enforceDemoPolicy } from "@/lib/demo/action-policy";
import { storageErrorResponse } from "@/lib/storage/http";
import {
  parsePublicUploadTokenInput,
  resolvePublicUploadActor,
} from "@/lib/storage/public-token";
import { completeUpload } from "@/lib/storage/service";
import { StorageValidationError } from "@/lib/storage/types";

export async function POST(req: Request) {
  try {
    enforceDemoPolicy("storage", "upload");
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const assetId = typeof body?.assetId === "string" ? body.assetId : "";
    if (!assetId) {
      throw new StorageValidationError("assetId is required");
    }

    await connectToDatabase();
    const resolved = await resolvePublicUploadActor(parsePublicUploadTokenInput(body));
    const data = await completeUpload({
      actor: resolved.actor,
      assetId,
    });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    const mapped = storageErrorResponse(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
