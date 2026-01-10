// src/components/demo/DemoActionButton.tsx
"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Lock, Phone, Sparkles } from "lucide-react";
import { useDemoFeature, useDemo } from "./DemoContext";

interface DemoActionButtonProps extends React.ComponentProps<typeof Button> {
  feature: string;
  onAllowedClick?: () => void;
  children: React.ReactNode;
}

/**
 * Button wrapper that handles demo mode restrictions
 * - If feature allowed: behaves normally
 * - If feature simulated: shows success modal with upsell
 * - If feature blocked: shows restriction modal with upsell
 */
export function DemoActionButton({
  feature,
  onAllowedClick,
  children,
  disabled,
  ...props
}: DemoActionButtonProps) {
  const { allowed, simulated, message, onAttempt } = useDemoFeature(feature);
  const { showContactSales } = useDemo();
  const [showModal, setShowModal] = useState(false);

  const handleClick = () => {
    onAttempt();

    if (allowed) {
      onAllowedClick?.();
      return;
    }

    // Show modal for restricted/simulated actions
    setShowModal(true);
  };

  const isRestricted = !allowed;

  return (
    <>
      <Button
        {...props}
        disabled={disabled}
        onClick={handleClick}
        className={props.className}
      >
        {isRestricted && <Lock className="h-3.5 w-3.5 mr-1.5 opacity-60" />}
        {children}
      </Button>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center mb-4">
              {simulated ? (
                <Sparkles className="h-6 w-6 text-white" />
              ) : (
                <Lock className="h-6 w-6 text-white" />
              )}
            </div>
            <DialogTitle className="text-center">
              {simulated ? "Action Simulated!" : "Demo Restriction"}
            </DialogTitle>
            <DialogDescription className="text-center">
              {simulated
                ? "In the full version, this action would be completed. Want to see it in action?"
                : message || "This feature is not available in demo mode."}
            </DialogDescription>
          </DialogHeader>

          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/50 dark:to-purple-950/50 rounded-lg p-4 my-4">
            <h4 className="font-medium text-sm mb-2">With EduSentrix Full Access:</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>✓ Unlimited student & teacher records</li>
              <li>✓ Full invoice & payment processing</li>
              <li>✓ Advanced reporting & analytics</li>
              <li>✓ Email & SMS notifications</li>
              <li>✓ Priority support</li>
            </ul>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setShowModal(false)}
              className="w-full sm:w-auto"
            >
              Continue Exploring
            </Button>
            <Button
              onClick={() => {
                setShowModal(false);
                showContactSales();
              }}
              className="w-full sm:w-auto bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600"
            >
              <Phone className="h-4 w-4 mr-2" />
              Talk to Sales
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
