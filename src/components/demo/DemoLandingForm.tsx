"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GhanaPhoneInput } from "@/components/ui/ghana-phone-input";

export function DemoLandingForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    schoolName: "",
  });

  const update = (field: keyof typeof form, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    let shouldKeepBusy = false;

    try {
      const res = await fetch("/api/demo/request-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const contentType = res.headers.get("content-type") || "";
      const raw = await res.text();
      const json =
        contentType.includes("application/json") && raw
          ? (JSON.parse(raw) as
              | { success?: boolean; error?: string; data?: { redirectTo?: string } }
              | null)
          : null;

      if (!res.ok || !json?.success) {
        setError(
          json?.error ||
            (res.status >= 500
              ? "The demo server could not start your session right now. Please try again shortly."
              : "Something went wrong. Please try again.")
        );
        return;
      }

      shouldKeepBusy = true;
      setNavigating(true);
      router.push(json.data.redirectTo || "/admin");
    } catch {
      setError("Could not reach the demo server. Please check your connection and try again.");
      setNavigating(false);
    } finally {
      if (!shouldKeepBusy) {
        setLoading(false);
      }
    }
  };

  const isBusy = loading || navigating;

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto w-full max-w-md space-y-4"
    >
      {error && (
        <div className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <div>
        <label
          htmlFor="fullName"
          className="mb-1 block text-sm font-medium text-gray-300"
        >
          Full name
        </label>
        <input
          id="fullName"
          type="text"
          required
          value={form.fullName}
          disabled={isBusy}
          onChange={(e) => update("fullName", e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="Kwame Mensah"
        />
      </div>

      <div>
        <label
          htmlFor="email"
          className="mb-1 block text-sm font-medium text-gray-300"
        >
          Email address
        </label>
        <input
          id="email"
          type="email"
          required
          value={form.email}
          disabled={isBusy}
          onChange={(e) => update("email", e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="you@example.com"
        />
      </div>

      <div>
        <label
          htmlFor="phone"
          className="mb-1 block text-sm font-medium text-gray-300"
        >
          Phone number
        </label>
        <GhanaPhoneInput
          unstyled
          id="phone"
          required
          value={form.phone}
          disabled={isBusy}
          onChange={(e) => update("phone", e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div>
        <label
          htmlFor="schoolName"
          className="mb-1 block text-sm font-medium text-gray-300"
        >
          School name
        </label>
        <input
          id="schoolName"
          type="text"
          required
          value={form.schoolName}
          disabled={isBusy}
          onChange={(e) => update("schoolName", e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="Lighthouse Preparatory School"
        />
      </div>

      <button
        type="submit"
        disabled={isBusy}
        className="w-full rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:opacity-60"
      >
        {navigating ? "Opening your demo..." : loading ? "Starting your demo..." : "Start free demo"}
      </button>

      <p className="text-center text-xs text-gray-500">
        No account needed. Your demo ends after 5 minutes of inactivity.
      </p>
    </form>
  );
}
