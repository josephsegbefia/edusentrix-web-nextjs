import { v2 as cloudinary } from "cloudinary";
import { deleteUploadThingFile } from "@/lib/uploadthing/delete";
import { detectUploadProvider } from "./provider";

type CloudinaryResourceType = "image" | "raw" | "video";

function extractCloudinaryTarget(url: string): {
  publicId: string;
  resourceType: CloudinaryResourceType;
} | null {
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/^\/[^/]+\/(image|raw|video)\/upload\/(.+)$/);
    if (!match) {
      return null;
    }

    const resourceType = match[1] as CloudinaryResourceType;
    const rawPath = match[2];
    const segments = rawPath.split("/").filter(Boolean);
    if (segments.length === 0) {
      return null;
    }

    const versionIndex = segments.findIndex((segment) => /^v\d+$/.test(segment));
    const publicIdSegments =
      versionIndex >= 0 ? segments.slice(versionIndex + 1) : segments;
    if (publicIdSegments.length === 0) {
      return null;
    }

    const last = publicIdSegments[publicIdSegments.length - 1] || "";
    if (resourceType !== "raw") {
      publicIdSegments[publicIdSegments.length - 1] = last.replace(/\.[^.]+$/, "");
    }

    const publicId = decodeURIComponent(publicIdSegments.join("/"));
    if (!publicId) {
      return null;
    }

    return { publicId, resourceType };
  } catch {
    return null;
  }
}

async function deleteCloudinaryFile(url: string): Promise<boolean> {
  const credentials = {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET || process.env.CLOUDINARY_API_SECRET_KEY,
  };

  if (!credentials.cloud_name || !credentials.api_key || !credentials.api_secret) {
    console.warn("Cloudinary credentials missing, skipping file deletion");
    return false;
  }

  const target = extractCloudinaryTarget(url);
  if (!target) {
    return false;
  }

  try {
    cloudinary.config(credentials);
    await cloudinary.uploader.destroy(target.publicId, {
      resource_type: target.resourceType,
      invalidate: true,
    });
    return true;
  } catch (error) {
    console.error("Failed to delete Cloudinary file:", error);
    return false;
  }
}

export async function deleteUploadedFile(url: string): Promise<boolean> {
  if (!url) {
    return true;
  }

  const provider = detectUploadProvider(url);
  if (provider === "uploadthing") {
    return deleteUploadThingFile(url);
  }
  if (provider === "cloudinary") {
    return deleteCloudinaryFile(url);
  }

  return false;
}

export async function deleteUploadedFiles(
  urls: string[]
): Promise<{ deleted: number; failed: number }> {
  let deleted = 0;
  let failed = 0;

  for (const url of urls) {
    const ok = await deleteUploadedFile(url);
    if (ok) {
      deleted += 1;
    } else {
      failed += 1;
    }
  }

  return { deleted, failed };
}
