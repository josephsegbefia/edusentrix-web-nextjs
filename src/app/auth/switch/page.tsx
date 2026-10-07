"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BrandMark } from "@/components/brand/BrandMark";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { authPageGlowStyle } from "@/components/auth/auth-surfaces";

type MembershipOption = {
  schoolId: string;
  schoolName: string;
  roles: string[];
  homePath: string;
};

export default function AuthSwitchPage() {
  const router = useRouter();
  const [memberships, setMemberships] = useState<MembershipOption[]>([]);
  const [loadingSchoolId, setLoadingSchoolId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        await new Promise((resolve) => setTimeout(resolve, 100));

        const res = await fetch("/api/me", {
          cache: "no-store",
          credentials: "include",
        });

        if (!res.ok) {
          if (res.status === 401) {
            router.replace("/sign-in?error=unauthorized");
            return;
          }
          throw new Error(`API error: ${res.status}`);
        }

        const payload = await res.json();

        if (payload?.needsSchoolSelection && Array.isArray(payload?.memberships)) {
          setMemberships(payload.memberships);
          return;
        }

        if (payload?.redirect) {
          router.replace(payload.redirect);
        } else if (payload?.ok || payload?._id) {
          router.replace("/dashboard");
        } else {
          router.replace("/sign-in?error=unauthorized");
        }
      } catch (error) {
        console.error("Auth switch error:", error);
        setError("We could not finish signing you in. Please try again.");
      }
    })();
  }, [router]);

  async function selectSchool(schoolId: string) {
    setLoadingSchoolId(schoolId);
    setError(null);
    try {
      const res = await fetch("/api/auth/active-school", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ schoolId }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.success) {
        throw new Error(payload?.error || "Could not switch school");
      }
      router.replace(payload.data?.redirect || "/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not switch school");
      setLoadingSchoolId(null);
    }
  }

  return (
    <div className="m-page relative grid min-h-screen place-items-center px-4">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={authPageGlowStyle}
      />
      {memberships.length > 0 ? (
        <div className="m-card-strong relative w-full max-w-xl rounded-2xl p-6 backdrop-blur-xl">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <BrandMark size="sm" />
              <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700 dark:text-cyan-200">
                Choose school
              </p>
              <h1 className="mt-2 text-2xl font-semibold text-(--m-fg)">Where do you want to work?</h1>
              <p className="mt-2 text-sm m-muted">
                This account has access to more than one school. Select the school for this session.
              </p>
            </div>
            <ThemeToggle className="shrink-0" />
          </div>

          <div className="space-y-3">
            {memberships.map((membership) => (
              <button
                key={membership.schoolId}
                type="button"
                onClick={() => selectSchool(membership.schoolId)}
                disabled={loadingSchoolId !== null}
                className="w-full rounded-xl border border-(--m-border) bg-(--m-subtle) px-4 py-3 text-left transition hover:border-cyan-600/40 hover:bg-cyan-500/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-(--m-fg)">{membership.schoolName}</p>
                    <p className="mt-1 text-xs capitalize m-muted">
                      {membership.roles.join(", ").replaceAll("_", " ")}
                    </p>
                  </div>
                  <span className="text-sm text-cyan-700 dark:text-cyan-200">
                    {loadingSchoolId === membership.schoolId ? "Opening..." : "Open"}
                  </span>
                </div>
              </button>
            ))}
          </div>

          {error ? <p className="mt-4 text-sm text-rose-700 dark:text-rose-200">{error}</p> : null}
        </div>
      ) : (
        <div className="m-card-strong relative rounded-2xl px-6 py-4 backdrop-blur-xl">
          <div className="mb-3 flex items-center justify-between gap-4">
            <BrandMark size="sm" />
            <ThemeToggle />
          </div>
          <p className={error ? "text-sm text-rose-700 dark:text-rose-200" : "m-muted"}>
            {error || "Signing you in..."}
          </p>
        </div>
      )}
    </div>
  );
}
