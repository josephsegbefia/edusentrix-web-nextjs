"use client";

import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  premiumSelectTrigger,
  premiumSelectContent,
  premiumSelectItem,
  premiumSelectItemIndicator,
  premiumSelectLabel,
  premiumSelectScrollButton,
} from "./premium";

// ============================================================================
// Root Components
// ============================================================================

const PremiumSelect = SelectPrimitive.Root;
const PremiumSelectGroup = SelectPrimitive.Group;
const PremiumSelectValue = SelectPrimitive.Value;

// ============================================================================
// Trigger
// ============================================================================

interface PremiumSelectTriggerProps
  extends React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger> {
  icon?: React.ReactNode;
}

const PremiumSelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  PremiumSelectTriggerProps
>(({ className, children, icon, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(premiumSelectTrigger, className)}
    {...props}
  >
    {icon && <span className="text-white/40">{icon}</span>}
    <span className="flex-1 text-left truncate">{children}</span>
    <SelectPrimitive.Icon asChild>
      <ChevronDownIcon className="h-4 w-4 text-white/40 transition-transform duration-200 group-data-[state=open]:rotate-180" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
PremiumSelectTrigger.displayName = "PremiumSelectTrigger";

// ============================================================================
// Content
// ============================================================================

const PremiumSelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = "popper", ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      className={cn(
        premiumSelectContent,
        "z-100 max-h-(--radix-select-content-available-height) min-w-32",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
        "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2",
        "data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        position === "popper" &&
          "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
        className
      )}
      position={position}
      {...props}
    >
      <PremiumSelectScrollUpButton />
      <SelectPrimitive.Viewport
        className={cn(
          "p-0.5",
          position === "popper" &&
            "h-(--radix-select-trigger-height) w-full min-w-(--radix-select-trigger-width)"
        )}
      >
        {children}
      </SelectPrimitive.Viewport>
      <PremiumSelectScrollDownButton />
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
PremiumSelectContent.displayName = "PremiumSelectContent";

// ============================================================================
// Item
// ============================================================================

interface PremiumSelectItemProps
  extends React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item> {
  icon?: React.ReactNode;
  description?: string;
}

const PremiumSelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  PremiumSelectItemProps
>(({ className, children, icon, description, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(premiumSelectItem, className)}
    {...props}
  >
    {icon && <span className="mr-2 text-white/50">{icon}</span>}
    <div className="flex-1">
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      {description && (
        <p className="text-xs text-white/40 mt-0.5">{description}</p>
      )}
    </div>
    <span className={premiumSelectItemIndicator}>
      <SelectPrimitive.ItemIndicator>
        <CheckIcon className="h-4 w-4" />
      </SelectPrimitive.ItemIndicator>
    </span>
  </SelectPrimitive.Item>
));
PremiumSelectItem.displayName = "PremiumSelectItem";

// ============================================================================
// Label
// ============================================================================

const PremiumSelectLabel = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={cn(premiumSelectLabel, className)}
    {...props}
  />
));
PremiumSelectLabel.displayName = "PremiumSelectLabel";

// ============================================================================
// Separator
// ============================================================================

const PremiumSelectSeparator = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator
    ref={ref}
    className={cn("bg-white/10 -mx-1 my-1.5 h-px", className)}
    {...props}
  />
));
PremiumSelectSeparator.displayName = "PremiumSelectSeparator";

// ============================================================================
// Scroll Buttons
// ============================================================================

const PremiumSelectScrollUpButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollUpButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollUpButton
    ref={ref}
    className={cn(premiumSelectScrollButton, className)}
    {...props}
  >
    <ChevronUpIcon className="h-4 w-4" />
  </SelectPrimitive.ScrollUpButton>
));
PremiumSelectScrollUpButton.displayName = "PremiumSelectScrollUpButton";

const PremiumSelectScrollDownButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollDownButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollDownButton
    ref={ref}
    className={cn(premiumSelectScrollButton, className)}
    {...props}
  >
    <ChevronDownIcon className="h-4 w-4" />
  </SelectPrimitive.ScrollDownButton>
));
PremiumSelectScrollDownButton.displayName = "PremiumSelectScrollDownButton";

// ============================================================================
// Exports
// ============================================================================

export {
  PremiumSelect,
  PremiumSelectGroup,
  PremiumSelectValue,
  PremiumSelectTrigger,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectLabel,
  PremiumSelectSeparator,
  PremiumSelectScrollUpButton,
  PremiumSelectScrollDownButton,
};
