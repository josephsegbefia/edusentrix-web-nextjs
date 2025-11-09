/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import { z } from "zod";
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
import { Textarea } from "@/components/ui/textarea";
import { useBusyToast } from "@/hooks/useBusyToast";

const FormSchema = z.object({
  adminFirstName: z.string().min(2, "First name is too short"),
  adminLastName: z.string().min(2, "Last name is too short"),
  adminEmail: z.string().email("Enter a valid email"),
  adminPhone: z.string().optional(),
  schoolName: z.string().min(2, "School name is too short"),
  schoolType: z.enum(["Basic", "Secondary"], {
    message: "Select a school type",
  }),
  city: z.string().optional(),
  region: z.string().optional(),
  message: z.string().optional(),
});

export default function EnrollPage() {
  const [loading, setLoading] = useState(false);
  const [ok, setOk] = useState(false);
  const [schoolType, setSchoolType] = useState<"Basic" | "Secondary" | "">("");
  const { promise, error } = useBusyToast();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget as HTMLFormElement);
    const raw = Object.fromEntries(fd.entries());

    let parsed: z.infer<typeof FormSchema>;
    try {
      parsed = FormSchema.parse({
        ...raw,
        schoolType: schoolType || raw.schoolType,
      });
    } catch (err: any) {
      error(
        err?.issues?.[0]?.message ?? "Please review your inputs and try again."
      );
      return;
    }

    setLoading(true);
    const req = fetch("/api/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed),
    });

    try {
      await promise(req, {
        loading: "Submitting application…",
        success: "Application received. We’ll email you after review.",
        error: "Failed to submit. Please try again.",
      });
      setOk(true);
      (e.currentTarget as any).reset();
      setSchoolType("");
    } finally {
      setLoading(false);
    }
  }

  if (ok) {
    return (
      <div className="mx-auto max-w-lg p-8 text-center">
        <div className="bg-green-50 border border-green-200 rounded-2xl p-8 mb-6">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">🎉</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Thanks! 🎉</h1>
          <p className="text-gray-600">
            We&apos;ve received your application. We&apos;ll email you once
            it&apos;s reviewed.
          </p>
        </div>
        <Button
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 cursor-pointer"
          onClick={() => setOk(false)}
        >
          Submit another application
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-50 py-8 px-4">
      <div className="mx-auto max-w-2xl">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
          {/* Header */}
          <div className="bg-linear-to-r from-blue-600 to-indigo-700 px-8 py-6 text-white">
            <h1 className="text-3xl font-bold mb-2">Enroll Your School</h1>
            <p className="text-blue-100 opacity-90">
              Join our educational platform and provide the best learning
              experience for your students
            </p>
          </div>

          {/* Form */}
          <div className="p-8">
            <form onSubmit={onSubmit} className="space-y-6">
              {/* Admin Info */}
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">
                  Administrator Information
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label
                      htmlFor="adminFirstName"
                      className="text-sm font-medium text-gray-700"
                    >
                      First name *
                    </Label>
                    <Input
                      id="adminFirstName"
                      name="adminFirstName"
                      autoComplete="given-name"
                      required
                      className="bg-white text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor="adminLastName"
                      className="text-sm font-medium text-gray-700"
                    >
                      Last name *
                    </Label>
                    <Input
                      id="adminLastName"
                      name="adminLastName"
                      autoComplete="family-name"
                      required
                      className="bg-white text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label
                      htmlFor="adminEmail"
                      className="text-sm font-medium text-gray-700"
                    >
                      Email *
                    </Label>
                    <Input
                      id="adminEmail"
                      name="adminEmail"
                      type="email"
                      autoComplete="email"
                      required
                      className="bg-white text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor="adminPhone"
                      className="text-sm font-medium text-gray-700"
                    >
                      Phone
                    </Label>
                    <Input
                      id="adminPhone"
                      name="adminPhone"
                      placeholder="+233..."
                      autoComplete="tel"
                      className="bg-white text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    />
                  </div>
                </div>
              </div>

              {/* School Info */}
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">
                  School Information
                </h2>
                <div className="space-y-2">
                  <Label
                    htmlFor="schoolName"
                    className="text-sm font-medium text-gray-700"
                  >
                    School name *
                  </Label>
                  <Input
                    id="schoolName"
                    name="schoolName"
                    required
                    className="bg-white text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">
                    School type *
                  </Label>
                  {/* Hidden input ensures FormData includes value */}
                  <input type="hidden" name="schoolType" value={schoolType} />
                  <Select
                    value={schoolType}
                    onValueChange={(v) =>
                      setSchoolType(v as "Basic" | "Secondary")
                    }
                  >
                    <SelectTrigger className="bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors cursor-pointer">
                      <SelectValue placeholder="Select school type" />
                    </SelectTrigger>
                    <SelectContent className="bg-primary">
                      <SelectItem value="Basic" className="cursor-pointer">
                        Basic School
                      </SelectItem>
                      <SelectItem value="Secondary" className="cursor-pointer">
                        Secondary School
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label
                      htmlFor="city"
                      className="text-sm font-medium text-gray-700"
                    >
                      City
                    </Label>
                    <Input
                      id="city"
                      name="city"
                      autoComplete="address-level2"
                      className="bg-white text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor="region"
                      className="text-sm font-medium text-gray-700"
                    >
                      Region
                    </Label>
                    <Input
                      id="region"
                      name="region"
                      autoComplete="address-level1"
                      className="bg-white text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    />
                  </div>
                </div>
              </div>

              {/* Additional */}
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">
                  Additional Information
                </h2>
                <div className="space-y-2">
                  <Label
                    htmlFor="message"
                    className="text-sm font-medium text-gray-700"
                  >
                    Message
                  </Label>
                  <Textarea
                    id="message"
                    name="message"
                    rows={4}
                    placeholder="Tell us about your school or any specific requirements..."
                    className="bg-white text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors resize-none"
                  />
                </div>
              </div>

              {/* Submit */}
              <div className="pt-4">
                <Button
                  type="submit"
                  disabled={loading}
                  aria-busy={loading}
                  className="w-full bg-linear-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white py-3 px-6 rounded-lg font-semibold text-base transition-all duration-200 transform hover:scale-[1.02] disabled:transform-none disabled:opacity-50 cursor-pointer"
                >
                  {loading ? (
                    <span className="flex items-center justify-center">
                      <svg
                        className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      Submitting...
                    </span>
                  ) : (
                    "Submit Application"
                  )}
                </Button>
                <p className="text-xs text-gray-500 text-center mt-3">
                  Fields marked with * are required
                </p>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
