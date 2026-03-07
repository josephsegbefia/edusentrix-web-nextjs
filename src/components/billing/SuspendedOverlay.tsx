import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SuspendedOverlay({
  status,
}: {
  status: "suspended" | "cancelled";
}) {
  const label =
    status === "cancelled"
      ? "This subscription is cancelled."
      : "This subscription is suspended.";

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center p-6">
      <div className="w-full max-w-xl rounded-3xl border border-red-500/20 bg-red-500/10 p-8 text-center text-white">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/15">
          <AlertTriangle className="h-6 w-6 text-red-200" />
        </div>
        <h1 className="text-2xl font-semibold">Access Restricted</h1>
        <p className="mt-3 text-sm text-red-100/85">
          {label} Most school operations are blocked until billing access is restored.
        </p>
        <div className="mt-6">
          <Button asChild className="bg-white text-black hover:bg-white/90">
            <Link href="/admin/billing">Review Subscription</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
