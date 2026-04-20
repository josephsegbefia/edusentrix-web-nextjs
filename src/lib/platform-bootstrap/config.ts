import "server-only";

/** Email that receives the 6-digit gate code (must match an inbox you control). */
export function getBootstrapNotifyEmail() {
  return (
    process.env.PLATFORM_BOOTSTRAP_NOTIFY_EMAIL?.trim().toLowerCase() ||
    "elsegbefia@gmail.com"
  );
}

/** Random URL segment; same value must appear in the path. Min length enforced at runtime. */
export function getBootstrapPathSecret() {
  return process.env.PLATFORM_ADMIN_BOOTSTRAP_SECRET?.trim() ?? "";
}

export function isBootstrapAllowWhenAdminsExist() {
  return process.env.PLATFORM_BOOTSTRAP_ALLOW_WHEN_ADMINS_EXIST === "true";
}

export const BOOTSTRAP_OTP_TTL_MS = 10 * 60 * 1000;
export const BOOTSTRAP_SESSION_TTL_MS = 30 * 60 * 1000;
export const BOOTSTRAP_MAX_OTP_SENDS_PER_HOUR = 8;
export const BOOTSTRAP_MAX_OTP_ATTEMPTS = 8;

export const BOOTSTRAP_SESSION_COOKIE = "edusentrix_pb_session";
