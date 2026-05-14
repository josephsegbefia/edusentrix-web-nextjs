"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { XIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// ========================
// Types
// ========================

interface ResponsiveModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  zIndexClass?: string;
  showCloseButton?: boolean;
}

// ========================
// Component
// ========================

/**
 * ResponsiveModal - A premium modal component that adapts to screen size.
 * Uses dialog pattern with dark theme glass-morphism styling.
 */
export function ResponsiveModal({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
  zIndexClass = "z-50",
  showCloseButton = true,
}: ResponsiveModalProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        {/* Overlay */}
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 bg-black/60 backdrop-blur-sm",
            zIndexClass,
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
          )}
        />

        {/* Content */}
        <DialogPrimitive.Content
          onPointerDownOutside={(e) => {
            if (
              (e.target as HTMLElement).closest(
                "[data-custom-date-picker-popover]"
              )
            ) {
              e.preventDefault();
            }
          }}
          onInteractOutside={(e) => {
            if (
              (e.target as HTMLElement).closest(
                "[data-custom-date-picker-popover]"
              )
            ) {
              e.preventDefault();
            }
          }}
          className={cn(
            // Base positioning
            "fixed",
            zIndexClass,
            // Mobile: bottom sheet style
            "inset-x-4 bottom-4 top-auto max-h-[85vh]",
            // Desktop: centered modal
            "sm:inset-auto sm:top-[50%] sm:left-[50%] sm:translate-x-[-50%] sm:translate-y-[-50%]",
            "sm:bottom-auto sm:w-full sm:max-w-lg",
            // Styling
            "overflow-hidden rounded-2xl border border-white/10",
            "bg-linear-to-br from-slate-900/95 via-slate-950/95 to-black/95",
            "shadow-xl shadow-black/20",
            // Animation
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:slide-out-to-bottom-4 data-[state=open]:slide-in-from-bottom-4",
            "sm:data-[state=closed]:zoom-out-95 sm:data-[state=open]:zoom-in-95",
            "sm:data-[state=closed]:slide-out-to-bottom-0 sm:data-[state=open]:slide-in-from-bottom-0",
            "duration-200",
            className
          )}
        >
          {/* Header */}
          <div className="sticky top-0 z-10 border-b border-white/10 bg-slate-900/80 backdrop-blur-sm px-6 py-4">
            <div className="pr-8">
              <DialogPrimitive.Title className="text-lg font-semibold text-white">
                {title}
              </DialogPrimitive.Title>
              {description && (
                <DialogPrimitive.Description className="mt-1 whitespace-pre-line text-sm leading-relaxed text-white/50">
                  {description}
                </DialogPrimitive.Description>
              )}
            </div>

            {/* Close Button */}
            {showCloseButton && (
              <DialogPrimitive.Close
                className={cn(
                  "absolute right-4 top-4 p-2 rounded-xl",
                  "text-white/40 hover:text-white hover:bg-white/10",
                  "transition-colors focus:outline-none focus:ring-2 focus:ring-white/20"
                )}
              >
                <XIcon className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </DialogPrimitive.Close>
            )}
          </div>

          {/* Scrollable Content */}
          <div className="overflow-y-auto max-h-[calc(85vh-4rem)] sm:max-h-[70vh] px-6 py-4">
            {children}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

// ========================
// Exports
// ========================

export { ResponsiveModal as Modal };
