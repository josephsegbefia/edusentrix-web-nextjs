import { Bell, TrendingUp } from "lucide-react";

const NAV = ["Dashboard", "Students", "Teachers", "Fees & Billing"];

export function MarketingHeroPreview() {
  return (
    <div className="relative">
      <div
        aria-hidden
        className="absolute inset-0 scale-95 rounded-3xl blur-2xl"
        style={{ background: "var(--m-glow-violet)" }}
      />
      <div className="m-card-strong relative overflow-hidden rounded-2xl backdrop-blur-xl lg:rounded-3xl">
        <div
          className="flex items-center gap-2 border-b px-4 py-3"
          style={{ borderColor: "var(--m-border)", backgroundColor: "var(--m-subtle)" }}
        >
          <div className="flex gap-1.5" aria-hidden>
            <div className="h-3 w-3 rounded-full bg-red-400" />
            <div className="h-3 w-3 rounded-full bg-amber-400" />
            <div className="h-3 w-3 rounded-full bg-emerald-400" />
          </div>
          <div className="mx-3 flex h-7 flex-1 items-center rounded-md px-3" style={{ backgroundColor: "var(--m-subtle)" }}>
            <span className="m-faint text-xs">app.edusentrix.com/admin</span>
          </div>
        </div>

        <div className="grid min-h-[280px] grid-cols-[4.5rem_1fr] sm:grid-cols-[7.5rem_1fr] sm:min-h-[340px]">
          <aside className="border-r p-2 sm:p-3" style={{ borderColor: "var(--m-border)" }}>
            <div className="mb-3 text-[10px] font-semibold tracking-tight sm:text-xs">EduSentrix</div>
            <ul className="space-y-1">
              {NAV.map((item) => (
                <li
                  key={item}
                  className={
                    item === "Students"
                      ? "rounded-lg bg-violet-500/15 px-2 py-1.5 text-[10px] font-medium text-violet-600 sm:text-xs dark:text-violet-300"
                      : "m-faint rounded-lg px-2 py-1.5 text-[10px] sm:text-xs"
                  }
                >
                  {item}
                </li>
              ))}
            </ul>
          </aside>

          <div className="space-y-3 p-3 sm:p-4">
            <div>
              <div className="text-sm font-semibold sm:text-base">Student Profile</div>
              <p className="m-faint text-[10px] sm:text-xs">View and manage student information, academics, fees, and more.</p>
            </div>
            <div className="m-card rounded-xl p-3 sm:p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-linear-to-br from-violet-500 to-cyan-400 text-sm font-semibold text-white">
                    EA
                  </div>
                  <div>
                    <div className="text-sm font-semibold sm:text-base">Esther Ama Agbleze</div>
                    <div className="m-faint mt-1 flex flex-wrap gap-1.5 text-[10px]">
                      <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-violet-700 dark:text-violet-200">JHS 3</span>
                      <span className="rounded-full px-2 py-0.5" style={{ backgroundColor: "var(--m-subtle)" }}>Age 14</span>
                      <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-emerald-700 dark:text-emerald-300">Active</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <MiniStat label="Outstanding" value="GH₵ 2,450" />
                  <MiniStat label="Total Paid" value="GH₵ 8,200" />
                </div>
              </div>
            </div>
            <div className="m-card hidden rounded-xl p-3 sm:block">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium">Recent Performance Overview</span>
                <span className="m-faint text-[10px]">Last 6 terms</span>
              </div>
              <svg viewBox="0 0 240 72" className="h-16 w-full text-violet-500" aria-hidden>
                <polyline
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  points="0,48 40,40 80,46 120,28 160,36 200,22 240,30"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>

      <div className="m-card-strong absolute -top-4 right-2 hidden max-w-[11rem] rounded-xl px-3 py-2.5 sm:block">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/15 text-violet-600 dark:text-violet-300">
            <Bell className="h-4 w-4" />
          </div>
          <div>
            <div className="text-xs font-semibold">12 new payments</div>
            <div className="m-faint text-[10px]">Just now</div>
          </div>
        </div>
      </div>

      <div className="m-card-strong absolute -bottom-4 -left-2 hidden rounded-xl px-3 py-2.5 sm:block">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-300">
            <TrendingUp className="h-4 w-4" />
          </div>
          <div>
            <div className="m-faint text-[10px]">Collections this term</div>
            <div className="text-sm font-bold">GH₵ 128,450</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl px-2.5 py-2" style={{ backgroundColor: "var(--m-subtle)" }}>
      <div className="m-faint text-[10px]">{label}</div>
      <div className="text-xs font-semibold">{value}</div>
    </div>
  );
}
