// src/app/(public)/apply/[schoolId]/[cycleSlug]/page.tsx
// Public, unauthenticated application page rendered to anyone with the link.
// Server-fetches cycle + form schema, then hands off to a client flow.
//
// Channel detection via query params: ?via=embed|qr|whatsapp|invite&ref=<code>

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { PublicApplicationFlow } from "@/components/admissions/public/PublicApplicationFlow";
import { EmbedResizeBroadcaster } from "@/components/admissions/public/EmbedResizeBroadcaster";
import type {
  PublicCycleDTO,
  PublicFormDTO,
} from "@/lib/admissions/public-shape";
import type { AdmissionChannel } from "@/lib/admissions/types";

type Params = Promise<{ schoolId: string; cycleSlug: string }>;
type Search = Promise<{ via?: string; ref?: string }>;

const CHANNEL_MAP: Record<string, AdmissionChannel> = {
  embed: "embed",
  qr: "qr",
  invite: "direct_invite",
  whatsapp: "whatsapp",
};

async function fetchCycle(
  schoolId: string,
  cycleSlug: string
): Promise<{ cycle: PublicCycleDTO; form: PublicFormDTO | null } | null> {
  const hdrs = await headers();
  const host = hdrs.get("host") ?? "localhost:3000";
  const proto = hdrs.get("x-forwarded-proto") ?? "http";
  const url = `${proto}://${host}/api/public/admissions/${schoolId}/${cycleSlug}`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const json = await res.json();
    if (!json?.success) return null;
    return json.data;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { schoolId, cycleSlug } = await params;
  const data = await fetchCycle(schoolId, cycleSlug);
  if (!data) return { title: "Apply" };
  return {
    title: `${data.cycle.name} · ${data.cycle.schoolName} · Apply`,
    description: `Apply for ${data.cycle.name} at ${data.cycle.schoolName}.`,
    robots: { index: false, follow: false },
  };
}

export default async function PublicApplyPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  const { schoolId, cycleSlug } = await params;
  const sp = await searchParams;

  const data = await fetchCycle(schoolId, cycleSlug);
  if (!data) notFound();

  if (!data.form) {
    return (
      <div className="mx-auto max-w-md p-10 text-center">
        <h1 className="text-lg font-semibold">Application not ready</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The school is still setting up this application. Please check back later.
        </p>
      </div>
    );
  }

  const via = (sp.via ?? "").toLowerCase();
  const channel: AdmissionChannel = CHANNEL_MAP[via] ?? "public_link";

  return (
    <>
      <PublicApplicationFlow
        cycle={data.cycle}
        form={data.form}
        channel={channel}
        inviteCode={sp.ref ?? null}
      />
      {channel === "embed" ? <EmbedResizeBroadcaster /> : null}
    </>
  );
}
