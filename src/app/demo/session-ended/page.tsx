// src/app/demo/session-ended/page.tsx
"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, Calendar, RotateCcw, GraduationCap, Loader2 } from "lucide-react";
import Link from "next/link";

function SessionEndedContent() {
  const searchParams = useSearchParams();
  const reason = searchParams.get("reason");

  const isExpired = reason === "expired";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-4">
      <Card className="max-w-lg w-full bg-white/5 backdrop-blur-lg border-white/10">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-indigo-500/20 rounded-full flex items-center justify-center mb-4">
            {isExpired ? (
              <Clock className="h-8 w-8 text-amber-400" />
            ) : (
              <GraduationCap className="h-8 w-8 text-indigo-400" />
            )}
          </div>
          <CardTitle className="text-white text-2xl">
            {isExpired ? "Demo Session Expired" : "Demo Session Ended"}
          </CardTitle>
          <CardDescription className="text-slate-300 text-base">
            {isExpired
              ? "Your demo session has timed out. Demo sessions last up to 2 hours."
              : "Thank you for exploring EduSentrix! We hope you found it useful."}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="bg-white/5 rounded-xl p-4 text-center">
            <p className="text-slate-300 text-sm">
              {isExpired
                ? "Don't worry - if you'd like to continue exploring, you can schedule a personalized demo with our team."
                : "Ready to bring EduSentrix to your school? Our team is here to help."}
            </p>
          </div>

          <div className="space-y-3">
            <Link href="/demo/schedule-call" className="block">
              <Button className="w-full bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white py-6">
                <Calendar className="h-5 w-5 mr-2" />
                Schedule a Personalized Demo
              </Button>
            </Link>

            <Link href="/demo" className="block">
              <Button
                variant="outline"
                className="w-full border-white/20 text-white hover:bg-white/10 py-6"
              >
                <RotateCcw className="h-5 w-5 mr-2" />
                Request New Demo Access
              </Button>
            </Link>
          </div>

          <div className="pt-4 border-t border-white/10 text-center">
            <Link href="/">
              <Button variant="ghost" className="text-slate-400 hover:text-white">
                ← Back to Home
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SessionEndedPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-indigo-400 animate-spin" />
      </div>
    }>
      <SessionEndedContent />
    </Suspense>
  );
}
