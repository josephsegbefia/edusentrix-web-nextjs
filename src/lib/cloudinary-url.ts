/**
 * Build a transformed Cloudinary URL for avatars
 * background removal if enabled
 * white background
 * square 1:1, face-aware crop
 * light enhancement
 * web friendly delivery
 */

export function buildAvatarUrl(
  publicId: string,
  opts?: { w?: number; h?: number; enableBgRemove?: boolean }
) {
  const cloud =
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ||
    process.env.CLOUDINARY_CLOUD_NAME;
  if (!cloud) {
    throw new Error("Cloudinary cloud name not found");
  }

  const width = opts?.w ?? 512;
  const height = opts?.h ?? 512;

  const trans = [
    "c_fill",
    "g_face",
    "ar_1:1",
    `w_${width}`,
    `h_${height}`,
    ...(opts?.enableBgRemove ?? true ? ["e_background_removal"] : []),
    "b_white",
    "e_improve",
    "q_auto",
    "f_auto",
  ].join(",");

  return `https://res.cloudinary.com/${cloud}/image/upload/${trans}/${publicId}`;
}
