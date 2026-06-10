import { NextRequest, NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";

function getRequestOrigin(req: NextRequest) {
  const forwardedProto = req.headers.get("x-forwarded-proto");
  const forwardedHost = req.headers.get("x-forwarded-host");
  if (forwardedProto && forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  return req.nextUrl.origin;
}

function isDevTeacherLoginBypassEnabled() {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.E2E_TEACHER_LOGIN_BYPASS_ENABLED === "true"
  );
}

function getDevTeacherPassword() {
  return process.env.E2E_TEACHER_DEFAULT_PASSWORD?.trim() || "TeacherTest123!";
}

function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function addAppRedirectToSignInTokenUrl(tokenUrl: string, req: NextRequest) {
  const url = new URL(tokenUrl);
  const callbackUrl = new URL("/auth/callback", getRequestOrigin(req));
  url.searchParams.set("redirect_url", callbackUrl.toString());
  url.searchParams.set("__clerk_redirect_url", callbackUrl.toString());
  return url.toString();
}

export async function GET() {
  return NextResponse.json({
    success: true,
    data: {
      enabled: isDevTeacherLoginBypassEnabled(),
    },
  });
}

export async function POST(req: NextRequest) {
  if (!isDevTeacherLoginBypassEnabled()) {
    return NextResponse.json(
      { success: false, error: "Dev teacher login is not enabled." },
      { status: 404 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid request body." },
      { status: 400 }
    );
  }

  const payload = body as { email?: unknown; password?: unknown };
  const email = normalizeEmail(payload.email);
  const password = typeof payload.password === "string" ? payload.password : "";

  if (!email || !password) {
    return NextResponse.json(
      { success: false, error: "Email and password are required." },
      { status: 400 }
    );
  }

  if (password !== getDevTeacherPassword()) {
    return NextResponse.json(
      { success: false, error: "Invalid test teacher credentials." },
      { status: 401 }
    );
  }

  const clerk = await clerkClient();
  const matches = await clerk.users.getUserList({ emailAddress: [email] });
  const user = matches.data.find((candidate) =>
    candidate.emailAddresses.some(
      (address) => address.emailAddress.toLowerCase() === email
    )
  );

  if (!user) {
    return NextResponse.json(
      { success: false, error: "No test teacher account exists for this email." },
      { status: 404 }
    );
  }

  if (
    user.publicMetadata?.role !== "teacher" ||
    user.privateMetadata?.e2eTeacherLoginBypass !== true
  ) {
    return NextResponse.json(
      { success: false, error: "This account is not enabled for test teacher login." },
      { status: 403 }
    );
  }

  const matchingEmail = user.emailAddresses.find(
    (address) => address.emailAddress.toLowerCase() === email
  );
  if (matchingEmail?.id && matchingEmail.verification?.status !== "verified") {
    await clerk.emailAddresses.updateEmailAddress(matchingEmail.id, {
      verified: true,
      primary: true,
    });
  }

  const token = await clerk.signInTokens.createSignInToken({
    userId: user.id,
    expiresInSeconds: 60,
  });

  return NextResponse.json({
    success: true,
    data: {
      url: addAppRedirectToSignInTokenUrl(token.url, req),
    },
  });
}
