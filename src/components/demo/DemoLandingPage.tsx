import { DemoLandingForm } from "./DemoLandingForm";

export function DemoLandingPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-neutral-950 px-4 text-white antialiased">
      <div className="w-full max-w-lg space-y-8 py-16">
        <div className="text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-1.5 text-xs font-medium text-blue-300">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-blue-400" />
            Live demo environment
          </div>

          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Try{" "}
            <span className="bg-linear-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              EduSentrix
            </span>
          </h1>
          <p className="mt-4 text-base text-gray-400 sm:text-lg">
            Explore the full platform with realistic school data.
            <br className="hidden sm:block" />
            No account needed — start in seconds.
          </p>
        </div>

        <DemoLandingForm />

        <div className="space-y-4 text-center text-sm text-gray-500">
          <div className="flex items-center justify-center gap-6">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
              Pre-loaded data
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
              Switch personas
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
              5 min idle timeout
            </span>
          </div>
        </div>
      </div>
    </main>
  );
}
