"use client";

import * as React from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { CheckIcon, ChevronRightIcon, CircleIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  premiumMenuContent,
  premiumMenuItem,
  premiumMenuItemDestructive,
  premiumMenuItemSuccess,
  premiumMenuItemWarning,
  premiumSeparator,
} from "./premium";

// ============================================================================
// Root Components
// ============================================================================

const PremiumDropdownMenu = DropdownMenuPrimitive.Root;
const PremiumDropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
const PremiumDropdownMenuGroup = DropdownMenuPrimitive.Group;
const PremiumDropdownMenuPortal = DropdownMenuPrimitive.Portal;
const PremiumDropdownMenuSub = DropdownMenuPrimitive.Sub;
const PremiumDropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;

// ============================================================================
// Content
// ============================================================================

const PremiumDropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, sideOffset = 8, ...props }, ref) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        premiumMenuContent,
        "z-100 min-w-45",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
        "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2",
        "data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        className
      )}
      {...props}
    />
  </DropdownMenuPrimitive.Portal>
));
PremiumDropdownMenuContent.displayName = "PremiumDropdownMenuContent";

// ============================================================================
// Menu Item
// ============================================================================

interface PremiumDropdownMenuItemProps
  extends React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> {
  inset?: boolean;
  variant?: "default" | "destructive" | "success" | "warning";
  icon?: React.ReactNode;
}

const PremiumDropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  PremiumDropdownMenuItemProps
>(({ className, inset, variant = "default", icon, children, asChild, ...props }, ref) => {
  const variantStyles = {
    default: premiumMenuItem,
    destructive: premiumMenuItemDestructive,
    success: premiumMenuItemSuccess,
    warning: premiumMenuItemWarning,
  };

  // When asChild is true, we can't wrap content - the child must be a single element
  // The icon should be included in the child element directly
  if (asChild) {
    return (
      <DropdownMenuPrimitive.Item
        ref={ref}
        asChild
        className={cn(
          variantStyles[variant],
          inset && "pl-8",
          "data-disabled:opacity-50 data-disabled:pointer-events-none",
          className
        )}
        {...props}
      >
        {children}
      </DropdownMenuPrimitive.Item>
    );
  }

  return (
    <DropdownMenuPrimitive.Item
      ref={ref}
      className={cn(
        variantStyles[variant],
        inset && "pl-8",
        "data-disabled:opacity-50 data-disabled:pointer-events-none",
        className
      )}
      {...props}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </DropdownMenuPrimitive.Item>
  );
});
PremiumDropdownMenuItem.displayName = "PremiumDropdownMenuItem";

// ============================================================================
// Checkbox Item
// ============================================================================

const PremiumDropdownMenuCheckboxItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.CheckboxItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.CheckboxItem>
>(({ className, children, checked, ...props }, ref) => (
  <DropdownMenuPrimitive.CheckboxItem
    ref={ref}
    className={cn(
      premiumMenuItem,
      "relative pl-8",
      "data-disabled:opacity-50 data-disabled:pointer-events-none",
      className
    )}
    checked={checked}
    {...props}
  >
    <span className="absolute left-2.5 flex h-4 w-4 items-center justify-center">
      <DropdownMenuPrimitive.ItemIndicator>
        <CheckIcon className="h-4 w-4 text-violet-400" />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.CheckboxItem>
));
PremiumDropdownMenuCheckboxItem.displayName = "PremiumDropdownMenuCheckboxItem";

// ============================================================================
// Radio Item
// ============================================================================

const PremiumDropdownMenuRadioItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.RadioItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.RadioItem>
>(({ className, children, ...props }, ref) => (
  <DropdownMenuPrimitive.RadioItem
    ref={ref}
    className={cn(
      premiumMenuItem,
      "relative pl-8",
      "data-disabled:opacity-50 data-disabled:pointer-events-none",
      className
    )}
    {...props}
  >
    <span className="absolute left-2.5 flex h-4 w-4 items-center justify-center">
      <DropdownMenuPrimitive.ItemIndicator>
        <CircleIcon className="h-2 w-2 fill-violet-400 text-violet-400" />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.RadioItem>
));
PremiumDropdownMenuRadioItem.displayName = "PremiumDropdownMenuRadioItem";

// ============================================================================
// Label
// ============================================================================

const PremiumDropdownMenuLabel = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label> & {
    inset?: boolean;
  }
>(({ className, inset, ...props }, ref) => (
  <DropdownMenuPrimitive.Label
    ref={ref}
    className={cn(
      "px-3 py-2 text-xs font-semibold uppercase tracking-wider text-white/40",
      inset && "pl-8",
      className
    )}
    {...props}
  />
));
PremiumDropdownMenuLabel.displayName = "PremiumDropdownMenuLabel";

// ============================================================================
// Separator
// ============================================================================

const PremiumDropdownMenuSeparator = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Separator
    ref={ref}
    className={cn(premiumSeparator, "-mx-1 h-px", className)}
    {...props}
  />
));
PremiumDropdownMenuSeparator.displayName = "PremiumDropdownMenuSeparator";

// ============================================================================
// Shortcut
// ============================================================================

const PremiumDropdownMenuShortcut = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) => (
  <span
    className={cn("ml-auto text-xs tracking-widest text-white/30", className)}
    {...props}
  />
);
PremiumDropdownMenuShortcut.displayName = "PremiumDropdownMenuShortcut";

// ============================================================================
// Sub Menu Trigger
// ============================================================================

const PremiumDropdownMenuSubTrigger = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.SubTrigger>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubTrigger> & {
    inset?: boolean;
    icon?: React.ReactNode;
  }
>(({ className, inset, icon, children, ...props }, ref) => (
  <DropdownMenuPrimitive.SubTrigger
    ref={ref}
    className={cn(
      premiumMenuItem,
      inset && "pl-8",
      "data-[state=open]:bg-white/10",
      className
    )}
    {...props}
  >
    {icon && <span className="shrink-0">{icon}</span>}
    {children}
    <ChevronRightIcon className="ml-auto h-4 w-4 text-white/40" />
  </DropdownMenuPrimitive.SubTrigger>
));
PremiumDropdownMenuSubTrigger.displayName = "PremiumDropdownMenuSubTrigger";

// ============================================================================
// Sub Menu Content
// ============================================================================

const PremiumDropdownMenuSubContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.SubContent>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubContent>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.SubContent
    ref={ref}
    className={cn(
      premiumMenuContent,
      "z-100 min-w-45",
      "data-[state=open]:animate-in data-[state=closed]:animate-out",
      "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
      "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2",
      "data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
      className
    )}
    {...props}
  />
));
PremiumDropdownMenuSubContent.displayName = "PremiumDropdownMenuSubContent";

// ============================================================================
// Exports
// ============================================================================

export {
  PremiumDropdownMenu,
  PremiumDropdownMenuTrigger,
  PremiumDropdownMenuContent,
  PremiumDropdownMenuItem,
  PremiumDropdownMenuCheckboxItem,
  PremiumDropdownMenuRadioItem,
  PremiumDropdownMenuLabel,
  PremiumDropdownMenuSeparator,
  PremiumDropdownMenuShortcut,
  PremiumDropdownMenuGroup,
  PremiumDropdownMenuPortal,
  PremiumDropdownMenuSub,
  PremiumDropdownMenuSubContent,
  PremiumDropdownMenuSubTrigger,
  PremiumDropdownMenuRadioGroup,
};
