// src/app/demo/verify/page.tsx
// Server component that redirects to the API route for verification
// The API route handles the actual verification and cookie setting

import { redirect } from "next/navigation";

interface PageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function DemoVerifyPage({ searchParams }: PageProps) {
  const { token } = await searchParams;

  if (!token) {
    redirect("/demo?error=invalid_token");
  }

  // Redirect to the API route which handles verification and sets cookies
  redirect(`/api/demo/verify?token=${encodeURIComponent(token)}`);
}
