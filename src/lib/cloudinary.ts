import "server-only";
import { v2 as cloudinary } from "cloudinary";

export function initCloudinary() {
  const apiSecret =
    process.env.CLOUDINARY_API_SECRET || process.env.CLOUDINARY_API_SECRET_KEY;
  if (
    !process.env.CLOUDINARY_CLOUD_NAME ||
    !process.env.CLOUDINARY_API_KEY ||
    !apiSecret
  ) {
    throw new Error("Missing Cloudinary credentials");
  }

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: apiSecret,
    secure: true,
  });

  return cloudinary;
}

export const CLD_BG_REMOVE_ENABLED =
  String(process.env.CLD_ENABLE_BG_REMOVE || "true") === "true";
