import type { Metadata } from "next";
import { PlatformBootstrapClient } from "./PlatformBootstrapClient";

export const metadata: Metadata = {
  title: "Platform admin bootstrap",
  robots: { index: false, follow: false },
};

type PageProps = { params: Promise<{ secret: string }> };

export default async function PlatformBootstrapPage({ params }: PageProps) {
  const { secret } = await params;
  return (
    <div className="min-h-screen bg-[#050914]">
      <PlatformBootstrapClient pathSecret={secret} />
    </div>
  );
}
