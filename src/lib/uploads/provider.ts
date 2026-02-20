export type UploadProvider = "uploadthing" | "cloudinary" | "unknown";

export function detectUploadProvider(url: string): UploadProvider {
  if (!url) {
    return "unknown";
  }

  if (url.includes("utfs.io") || url.includes("ufs.sh") || url.includes("uploadthing")) {
    return "uploadthing";
  }

  if (url.includes("cloudinary.com") || url.includes("res.cloudinary.com")) {
    return "cloudinary";
  }

  return "unknown";
}

export function isCloudinaryUrl(url: string): boolean {
  return detectUploadProvider(url) === "cloudinary";
}

export function isUploadThingUrl(url: string): boolean {
  return detectUploadProvider(url) === "uploadthing";
}
