// src/components/demo/DemoUpgradeCard.tsx
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, ArrowRight, Phone, Calendar } from "lucide-react";
import { useDemo } from "./DemoContext";

interface DemoUpgradeCardProps {
  variant?: "compact" | "full";
  className?: string;
}

/**
 * CTA card encouraging demo users to upgrade
 */
export function DemoUpgradeCard({ variant = "full", className = "" }: DemoUpgradeCardProps) {
  const { isDemo, showContactSales } = useDemo();

  if (!isDemo) return null;

  if (variant === "compact") {
    return (
      <Card className={`bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border-indigo-500/20 ${className}`}>
        <CardContent className="p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shrink-0">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="font-medium text-sm">Ready for the full experience?</p>
              <p className="text-xs text-muted-foreground">Get unlimited access to all features</p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={showContactSales}
            className="bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 shrink-0"
          >
            <ArrowRight className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`overflow-hidden ${className}`}>
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">Upgrade to Full Access</h3>
            <p className="text-white/80 text-sm">Transform your school management today</p>
          </div>
        </div>

        <ul className="space-y-2 mb-6 text-sm">
          <li className="flex items-center gap-2">
            <span className="text-green-300">✓</span>
            Unlimited students, teachers & classes
          </li>
          <li className="flex items-center gap-2">
            <span className="text-green-300">✓</span>
            Complete fee & invoice management
          </li>
          <li className="flex items-center gap-2">
            <span className="text-green-300">✓</span>
            Advanced reporting & analytics
          </li>
          <li className="flex items-center gap-2">
            <span className="text-green-300">✓</span>
            Email, SMS & WhatsApp notifications
          </li>
          <li className="flex items-center gap-2">
            <span className="text-green-300">✓</span>
            Priority support & training
          </li>
        </ul>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            onClick={showContactSales}
            className="flex-1 bg-white text-indigo-600 hover:bg-white/90"
          >
            <Phone className="h-4 w-4 mr-2" />
            Talk to Sales
          </Button>
          <Button
            variant="outline"
            className="flex-1 border-white/30 text-white hover:bg-white/10"
            onClick={() => window.open("https://calendly.com/edusentrix/demo", "_blank")}
          >
            <Calendar className="h-4 w-4 mr-2" />
            Book a Demo
          </Button>
        </div>
      </div>
    </Card>
  );
}
