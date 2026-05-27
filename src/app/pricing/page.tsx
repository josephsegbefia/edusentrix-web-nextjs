import Link from "next/link";
import { Check } from "lucide-react";
import { EduSentrixWordmark } from "@/components/brand/EduSentrixWordmark";
import { connectToDatabase } from "@/db/connectToDatabase";
import { formatMoney } from "@/lib/fees/money";
import { ensureDefaultSubscriptionTiers } from "@/lib/platform-billing/subscription-tiers";

export default async function PricingPage() {
  await connectToDatabase();
  const tiers = await ensureDefaultSubscriptionTiers();

  return (
    <main className="min-h-screen bg-linear-to-br from-slate-950 via-slate-900 to-black px-6 py-16 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200/70">
            <EduSentrixWordmark className="text-xs uppercase tracking-[0.18em]" /> Pricing
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">
            Pilot pricing built from operational cost visibility
          </h1>
          <p className="mt-4 text-base text-white/65">
            Current tiers are provisional while the pilot program runs. Subscription
            pricing is reviewed against real usage, support load, and infrastructure
            cost before long-term pricing is finalized.
          </p>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          {tiers.map((tier) => (
            <section
              key={String(tier._id)}
              className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xl font-semibold">{tier.name}</p>
                  <p className="mt-2 text-sm text-white/60">
                    {tier.description || "Pilot subscription tier"}
                  </p>
                </div>
                {tier.provisional ? (
                  <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-[11px] font-medium text-amber-100">
                    Provisional
                  </span>
                ) : null}
              </div>

              <div className="mt-6">
                <p className="text-3xl font-semibold">{formatMoney(tier.priceMinor)}</p>
                <p className="text-sm text-white/45">per month</p>
              </div>

              <div className="mt-6 rounded-2xl border border-white/8 bg-black/20 px-4 py-3 text-sm text-white/70">
                {tier.studentLimit !== null
                  ? `Supports up to ${tier.studentLimit} students`
                  : "No student cap configured"}
              </div>

              <ul className="mt-6 space-y-3">
                {(tier.features || []).map((feature) => (
                  <li key={feature} className="flex items-start gap-3 text-sm text-white/70">
                    <span className="mt-0.5 rounded-full bg-emerald-400/10 p-1">
                      <Check className="h-3.5 w-3.5 text-emerald-200" />
                    </span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-4">
          <Link
            href="/sign-in"
            className="inline-flex items-center rounded-2xl bg-cyan-500 px-5 py-3 text-sm font-medium text-black transition-colors hover:bg-cyan-400"
          >
            Sign in to manage billing
          </Link>
          <Link
            href="/"
            className="inline-flex items-center rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
          >
            Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}
