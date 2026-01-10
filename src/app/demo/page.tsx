// src/app/demo/page.tsx
"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GraduationCap, Users, FileText, CreditCard, BarChart3, Loader2, CheckCircle2, AlertCircle, Mail } from "lucide-react";

const FEATURES = [
  { icon: Users, title: "Student Management", description: "Enroll, track, and manage student records" },
  { icon: GraduationCap, title: "Teacher Management", description: "Organize faculty and assignments" },
  { icon: FileText, title: "Class Scheduling", description: "Create classes and assign subjects" },
  { icon: CreditCard, title: "Fee & Invoicing", description: "Generate invoices and track payments" },
  { icon: BarChart3, title: "Reports & Analytics", description: "Insights into school performance" },
];

type DemoRole = "admin" | "teacher" | "finance" | "it" | "other";
type DemoSchoolSize = "small" | "medium" | "large" | "xlarge";

function DemoLandingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const errorParam = searchParams.get("error");

  const [formData, setFormData] = useState({
    email: "",
    fullName: "",
    organization: "",
    role: "" as DemoRole | "",
    schoolSize: "" as DemoSchoolSize | "",
    phone: "",
    country: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scheduleUrl, setScheduleUrl] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/demo/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error === "returning_visitor") {
          setScheduleUrl(data.scheduleUrl);
          setError(data.message);
        } else {
          setError(data.error || "Something went wrong");
        }
        return;
      }

      setSubmitted(true);
    } catch (err) {
      setError("Failed to submit. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getErrorMessage = (code: string | null) => {
    switch (code) {
      case "invalid_token":
        return "Invalid or missing verification token.";
      case "expired_or_invalid":
        return "Your magic link has expired. Please request a new one.";
      case "server_error":
        return "Something went wrong. Please try again.";
      default:
        return null;
    }
  };

  const urlError = getErrorMessage(errorParam);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-indigo-500/20 text-indigo-300 px-4 py-2 rounded-full mb-6">
            <GraduationCap className="h-5 w-5" />
            <span className="text-sm font-medium">EduSentrix Demo</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">
            Experience the Future of
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">
              School Management
            </span>
          </h1>
          <p className="text-lg text-slate-300 max-w-2xl mx-auto">
            Get hands-on with EduSentrix. Explore a fully-functional demo with realistic
            school data. No credit card required.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-12">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4 text-center hover:bg-white/10 transition-colors"
            >
              <feature.icon className="h-8 w-8 text-indigo-400 mx-auto mb-2" />
              <h3 className="text-white font-medium text-sm">{feature.title}</h3>
              <p className="text-slate-400 text-xs mt-1">{feature.description}</p>
            </div>
          ))}
        </div>

        {/* Error from URL */}
        {urlError && (
          <div className="max-w-md mx-auto mb-6">
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
              <p className="text-red-300 text-sm">{urlError}</p>
            </div>
          </div>
        )}

        {/* Signup Form */}
        <Card className="max-w-md mx-auto bg-white/5 backdrop-blur-lg border-white/10">
          <CardHeader className="text-center">
            {submitted ? (
              <>
                <div className="mx-auto w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mb-4">
                  <Mail className="h-8 w-8 text-green-400" />
                </div>
                <CardTitle className="text-white">Check Your Email!</CardTitle>
                <CardDescription className="text-slate-300">
                  We&apos;ve sent a magic link to <strong>{formData.email}</strong>. Click the link to access your demo.
                </CardDescription>
              </>
            ) : (
              <>
                <CardTitle className="text-white">Start Your Free Demo</CardTitle>
                <CardDescription className="text-slate-300">
                  Enter your details to receive instant access
                </CardDescription>
              </>
            )}
          </CardHeader>

          {!submitted && (
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-200">
                    Work Email *
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    placeholder="you@school.edu"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="bg-white/10 border-white/20 text-white placeholder:text-slate-400"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fullName" className="text-slate-200">
                    Full Name *
                  </Label>
                  <Input
                    id="fullName"
                    type="text"
                    required
                    placeholder="John Mensah"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    className="bg-white/10 border-white/20 text-white placeholder:text-slate-400"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="organization" className="text-slate-200">
                    School/Organization *
                  </Label>
                  <Input
                    id="organization"
                    type="text"
                    required
                    placeholder="Riverside Academy"
                    value={formData.organization}
                    onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
                    className="bg-white/10 border-white/20 text-white placeholder:text-slate-400"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role" className="text-slate-200">
                    Your Role *
                  </Label>
                  <Select
                    value={formData.role}
                    onValueChange={(value: DemoRole) => setFormData({ ...formData, role: value })}
                    required
                  >
                    <SelectTrigger className="bg-white/10 border-white/20 text-white">
                      <SelectValue placeholder="Select your role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">School Administrator</SelectItem>
                      <SelectItem value="teacher">Teacher</SelectItem>
                      <SelectItem value="finance">Finance/Bursar</SelectItem>
                      <SelectItem value="it">IT Staff</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="schoolSize" className="text-slate-200">
                    School Size (Optional)
                  </Label>
                  <Select
                    value={formData.schoolSize}
                    onValueChange={(value: DemoSchoolSize) => setFormData({ ...formData, schoolSize: value })}
                  >
                    <SelectTrigger className="bg-white/10 border-white/20 text-white">
                      <SelectValue placeholder="Select school size" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="small">Less than 100 students</SelectItem>
                      <SelectItem value="medium">100 - 500 students</SelectItem>
                      <SelectItem value="large">500 - 1000 students</SelectItem>
                      <SelectItem value="xlarge">1000+ students</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {error && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-red-300 text-sm">{error}</p>
                      {scheduleUrl && (
                        <Button
                          type="button"
                          variant="link"
                          className="text-indigo-400 p-0 h-auto mt-1"
                          onClick={() => router.push(scheduleUrl)}
                        >
                          Schedule a call instead →
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white font-semibold py-6"
                  disabled={isSubmitting || !formData.email || !formData.fullName || !formData.organization || !formData.role}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Sending magic link...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Get Instant Access
                    </>
                  )}
                </Button>

                <p className="text-xs text-slate-400 text-center">
                  By signing up, you agree to our Terms of Service and Privacy Policy.
                  Your demo session lasts up to 2 hours.
                </p>
              </form>
            </CardContent>
          )}
        </Card>

        {/* Trust indicators */}
        <div className="mt-12 text-center">
          <p className="text-slate-400 text-sm mb-4">Trusted by schools across Ghana</p>
          <div className="flex items-center justify-center gap-8 opacity-50">
            {/* Placeholder for school logos */}
            <div className="w-24 h-8 bg-white/10 rounded" />
            <div className="w-24 h-8 bg-white/10 rounded" />
            <div className="w-24 h-8 bg-white/10 rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}

// Wrapper with Suspense for useSearchParams
export default function DemoPage() {
  return (
    <Suspense fallback={<DemoLoadingFallback />}>
      <DemoLandingPage />
    </Suspense>
  );
}

function DemoLoadingFallback() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center">
      <Loader2 className="h-8 w-8 text-indigo-400 animate-spin" />
    </div>
  );
}
