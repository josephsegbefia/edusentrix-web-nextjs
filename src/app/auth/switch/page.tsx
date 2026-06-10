"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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
    <div className="grid min-h-screen place-items-center bg-linear-to-br from-slate-950 via-slate-900 to-black px-4 text-white">
      {memberships.length > 0 ? (
        <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-white/8 p-6 shadow-2xl shadow-black/40 backdrop-blur-xl">
          <div className="mb-5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200/80">
              Choose school
            </p>
            <h1 className="mt-2 text-2xl font-semibold">Where do you want to work?</h1>
            <p className="mt-2 text-sm text-white/65">
              This account has access to more than one school. Select the school for this session.
            </p>
          </div>

          <div className="space-y-3">
            {memberships.map((membership) => (
              <button
                key={membership.schoolId}
                type="button"
                onClick={() => selectSchool(membership.schoolId)}
                disabled={loadingSchoolId !== null}
                className="w-full rounded-xl border border-white/10 bg-white/6 px-4 py-3 text-left transition hover:border-cyan-300/40 hover:bg-cyan-300/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-white">{membership.schoolName}</p>
                    <p className="mt-1 text-xs capitalize text-white/55">
                      {membership.roles.join(", ").replaceAll("_", " ")}
                    </p>
                  </div>
                  <span className="text-sm text-cyan-100">
                    {loadingSchoolId === membership.schoolId ? "Opening..." : "Open"}
                  </span>
                </div>
              </button>
            ))}
          </div>

          {error ? <p className="mt-4 text-sm text-rose-200">{error}</p> : null}
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/8 px-6 py-4 text-white/80 shadow-2xl shadow-black/40 backdrop-blur-xl">
          {error || "Signing you in..."}
        </div>
      )}
    </div>
  );
}
