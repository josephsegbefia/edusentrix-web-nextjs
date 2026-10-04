import { NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { enforceDemoPolicy } from "@/lib/demo/action-policy";
import {
  enforceKindUploadPolicy,
  resolveStorageActor,
  storageErrorResponse,
} from "@/lib/storage/http";
import { parseStorageKind } from "@/lib/storage/kinds";
import { presignUpload } from "@/lib/storage/service";
import {
  StorageValidationError,
  isStorageAssociationType,
  type StorageAssociation,
} from "@/lib/storage/types";

export async function POST(req: Request) {
  try {
    enforceDemoPolicy("storage", "upload");
    const actor = await resolveStorageActor();
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== "object") {
      throw new StorageValidationError("Invalid upload request");
    }

    const kind = parseStorageKind(body.kind);
    const fileName = typeof body.fileName === "string" ? body.fileName : "";
    const mimeType = typeof body.mimeType === "string" ? body.mimeType : "";
    if (!fileName || !mimeType) {
      throw new StorageValidationError("fileName and mimeType are required");
    }

    let association: StorageAssociation | undefined;
    if (body.association && typeof body.association === "object") {
      const raw = body.association as { type?: unknown; id?: unknown };
      if (!isStorageAssociationType(raw.type) || typeof raw.id !== "string") {
        throw new StorageValidationError("Invalid association");
      }
      association = { type: raw.type, id: raw.id };
    }

    await connectToDatabase();
    await enforceKindUploadPolicy(actor, kind);
    const data = await presignUpload({
      actor,
      kind,
      fileName,
      mimeType,
      association,
    });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    const mapped = storageErrorResponse(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
