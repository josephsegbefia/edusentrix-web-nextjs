// src/app/demo/schedule-call/page.tsx
"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Mail, Phone, MessageSquare, GraduationCap, Loader2 } from "lucide-react";
import Link from "next/link";

function ScheduleCallContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-4">
      <Card className="max-w-lg w-full bg-white/5 backdrop-blur-lg border-white/10">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-indigo-500/20 rounded-full flex items-center justify-center mb-4">
            <GraduationCap className="h-8 w-8 text-indigo-400" />
          </div>
          <CardTitle className="text-white text-2xl">Let&apos;s Talk!</CardTitle>
          <CardDescription className="text-slate-300 text-base">
            Thank you for your interest in EduSentrix. Since you&apos;ve already explored our demo,
            let&apos;s schedule a personalized walkthrough with our team.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Contact Options */}
          <div className="space-y-3">
            <a
              href="https://calendly.com/edusentrix/demo"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-4 p-4 bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/30 rounded-xl transition-colors group"
            >
              <div className="w-12 h-12 bg-indigo-500/30 rounded-lg flex items-center justify-center group-hover:bg-indigo-500/50 transition-colors">
                <Calendar className="h-6 w-6 text-indigo-300" />
              </div>
              <div className="flex-1">
                <h3 className="text-white font-semibold">Schedule a Call</h3>
                <p className="text-slate-400 text-sm">Book a 30-minute demo with our team</p>
              </div>
            </a>

            <a
              href={`mailto:sales@edusentrix.com?subject=Demo%20Follow-up&body=Hi%20EduSentrix%20Team,%0A%0AI%20recently%20tried%20your%20demo%20and%20would%20like%20to%20learn%20more.%0A%0AMy%20email:%20${encodeURIComponent(email)}`}
              className="flex items-center gap-4 p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-colors group"
            >
              <div className="w-12 h-12 bg-white/10 rounded-lg flex items-center justify-center group-hover:bg-white/20 transition-colors">
                <Mail className="h-6 w-6 text-slate-300" />
              </div>
              <div className="flex-1">
                <h3 className="text-white font-semibold">Email Us</h3>
                <p className="text-slate-400 text-sm">sales@edusentrix.com</p>
              </div>
            </a>

            <a
              href="tel:+233XXXXXXXXX"
              className="flex items-center gap-4 p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-colors group"
            >
              <div className="w-12 h-12 bg-white/10 rounded-lg flex items-center justify-center group-hover:bg-white/20 transition-colors">
                <Phone className="h-6 w-6 text-slate-300" />
              </div>
              <div className="flex-1">
                <h3 className="text-white font-semibold">Call Us</h3>
                <p className="text-slate-400 text-sm">+233 XXX XXX XXX</p>
              </div>
            </a>

            <a
              href="https://wa.me/233XXXXXXXXX"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-4 p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-colors group"
            >
              <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center group-hover:bg-green-500/30 transition-colors">
                <MessageSquare className="h-6 w-6 text-green-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-white font-semibold">WhatsApp</h3>
                <p className="text-slate-400 text-sm">Chat with us instantly</p>
              </div>
            </a>
          </div>

          <div className="pt-4 border-t border-white/10">
            <Link href="/">
              <Button variant="ghost" className="w-full text-slate-400 hover:text-white">
                ← Back to Home
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ScheduleCallPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-indigo-400 animate-spin" />
      </div>
    }>
      <ScheduleCallContent />
    </Suspense>
  );
}
