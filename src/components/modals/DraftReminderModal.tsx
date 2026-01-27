import { useState } from "react";

export function DraftReminderModal({ onClose }: { onClose: () => void }) {
  const [channel, setChannel] = useState<"email" | "sms">("email");
  return (
    <div className="space-y-4">
      <div className="text-sm text-white/70">
        Draft a fee reminder to guardians with outstanding balances.
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setChannel("email")}
          className={`rounded-xl border px-4 py-3 text-sm ${
            channel === "email"
              ? "border-brand bg-brand/10"
              : "border-white/10 bg-white/5"
          }`}
        >
          Email
        </button>
        <button
          onClick={() => setChannel("sms")}
          className={`rounded-xl border px-4 py-3 text-sm ${
            channel === "sms"
              ? "border-brand bg-brand/10"
              : "border-white/10 bg-white/5"
          }`}
        >
          SMS
        </button>
      </div>
      <textarea
        rows={6}
        placeholder="Message..."
        className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm focus:outline-none"
      />
      <div className="flex items-center justify-end gap-2">
        <button
          onClick={onClose}
          className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm"
        >
          Cancel
        </button>
        <button className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-black">
          Send Draft
        </button>
      </div>
    </div>
  );
}
