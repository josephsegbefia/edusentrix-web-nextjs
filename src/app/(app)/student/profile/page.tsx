"use client";

import { UserCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function StudentProfilePage() {
  return (
    <div className="min-h-screen p-6 md:p-8">
      <Card className="mx-auto max-w-3xl rounded-2xl border border-white/10 bg-linear-to-br from-slate-900/60 via-slate-950/60 to-black/60">
        <CardHeader>
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-brand/15 text-brand">
            <UserCircle2 className="h-5 w-5" />
          </div>
          <CardTitle className="text-xl text-white">Profile</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-white/65">
          Student profile controls are planned for a dedicated phase. This
          placeholder keeps the account navigation complete and functional.
        </CardContent>
      </Card>
    </div>
  );
}
