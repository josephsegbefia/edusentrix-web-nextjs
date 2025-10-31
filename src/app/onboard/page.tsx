"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function OnboardPage() {
  const [step, setStep] = useState(1);

  return (
    <div className="mx-auto max-w-2xl p-6 space-y-6">
      <div className="text-sm text-muted-foreground">Onboarding</div>
      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary"
          style={{ width: `${(step / 2) * 100}%` }}
        />
      </div>

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Admin profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Full name</Label>
              <Input placeholder="Prefilled..." />
            </div>
            <div>
              <Label>Phone</Label>
              <Input placeholder="+233..." />
            </div>
            <div className="flex justify-end">
              <Button onClick={() => setStep(2)}>Continue</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>School profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>School name</Label>
              <Input placeholder="Prefilled..." />
            </div>
            <div>
              <Label>Type</Label>
              <Input placeholder="Basic / Secondary" />
            </div>
            <div className="flex items-center justify-between">
              <Button variant="secondary" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button>Finish</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
