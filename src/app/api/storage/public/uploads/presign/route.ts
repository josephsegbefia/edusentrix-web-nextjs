import { NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { enforceDemoPolicy } from "@/lib/demo/action-policy";
import { enforceKindUploadPolicy, storageErrorResponse } from "@/lib/storage/http";
import {
  parsePublicUploadTokenInput,
  resolvePublicUploadActor,
} from "@/lib/storage/public-token";
import { presignUpload } from "@/lib/storage/service";
import { StorageValidationError } from "@/lib/storage/types";

export async function POST(req: Request) {
  try {
    enforceDemoPolicy("storage", "upload");
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== "object") {
      throw new StorageValidationError("Invalid upload request");
    }

    const fileName = typeof body.fileName === "string" ? body.fileName : "";
    const mimeType = typeof body.mimeType === "string" ? body.mimeType : "";
    if (!fileName || !mimeType) {
      throw new StorageValidationError("fileName and mimeType are required");
    }

    await connectToDatabase();
    const resolved = await resolvePublicUploadActor(parsePublicUploadTokenInput(body));
    if (typeof body.kind === "string" && body.kind !== resolved.kind) {
      throw new StorageValidationError("Upload kind does not match this token");
    }
    await enforceKindUploadPolicy(resolved.actor, resolved.kind);
    const data = await presignUpload({
      actor: resolved.actor,
      kind: resolved.kind,
      fileName,
      mimeType,
      allowTokenKind: true,
    });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    const mapped = storageErrorResponse(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
