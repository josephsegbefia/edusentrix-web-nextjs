"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  formatGhanaLocalPhoneInput,
  normalizeGhanaPhoneForStorage,
} from "@/lib/phone/ghana";

type GhanaPhoneInputProps = Omit<
  React.ComponentProps<"input">,
  "type" | "value" | "defaultValue"
> & {
  value?: string | null | undefined;
  defaultValue?: string | null | undefined;
  onValueChange?: (value: string) => void;
  unstyled?: boolean;
};

function assignRef<T>(ref: React.Ref<T> | undefined, value: T) {
  if (typeof ref === "function") {
    ref(value);
    return;
  }
  if (ref) {
    (ref as React.MutableRefObject<T>).current = value;
  }
}

function resolvePhonePlaceholder(placeholder: string) {
  const formatted = formatGhanaLocalPhoneInput(placeholder);
  if (formatted) return formatted;
  return placeholder;
}

export const GhanaPhoneInput = React.forwardRef<HTMLInputElement, GhanaPhoneInputProps>(
  function GhanaPhoneInput(
    {
      onChange,
      onValueChange,
      value,
      defaultValue,
      placeholder = "24 123 4567",
      autoComplete = "tel",
      inputMode = "tel",
      unstyled = false,
      className,
      ...props
    },
    forwardedRef
  ) {
    const innerRef = React.useRef<HTMLInputElement | null>(null);
    const resolvedPlaceholder = resolvePhonePlaceholder(placeholder);

    const syncDisplayedValue = React.useCallback(() => {
      if (!innerRef.current) return;
      const formatted = formatGhanaLocalPhoneInput(innerRef.current.value);
      if (formatted !== innerRef.current.value) {
        innerRef.current.value = formatted;
      }
    }, []);

    React.useEffect(() => {
      syncDisplayedValue();
    }, [syncDisplayedValue, value, defaultValue]);

    const formattedValue =
      value === undefined ? undefined : formatGhanaLocalPhoneInput(value ?? "");
    const formattedDefaultValue =
      defaultValue === undefined
        ? undefined
        : formatGhanaLocalPhoneInput(defaultValue ?? "");

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const displayValue = formatGhanaLocalPhoneInput(event.target.value);
      const normalized = normalizeGhanaPhoneForStorage(event.target.value);

      if (innerRef.current && innerRef.current.value !== displayValue) {
        innerRef.current.value = displayValue;
      }

      onValueChange?.(normalized);

      if (onChange) {
        const nextEvent = {
          ...event,
          target: { ...event.target, value: normalized },
          currentTarget: { ...event.currentTarget, value: normalized },
        } as React.ChangeEvent<HTMLInputElement>;
        onChange(nextEvent);
      }
    };

    const sharedProps: React.ComponentProps<"input"> = {
      ...props,
      ref: (node) => {
        innerRef.current = node;
        assignRef(forwardedRef, node);
      },
      type: "tel",
      autoComplete,
      inputMode,
      placeholder: resolvedPlaceholder,
      defaultValue: formattedDefaultValue,
      onChange: handleChange,
    };

    if (formattedValue !== undefined) {
      sharedProps.value = formattedValue;
    }

    if (unstyled) {
      return (
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-sm text-white/55">
            +233
          </span>
          <input
            {...sharedProps}
            className={cn("pl-16", className)}
          />
        </div>
      );
    }

    return (
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-3 z-10 flex items-center text-sm text-muted-foreground">
          +233
        </span>
        <Input {...sharedProps} className={cn("pl-14", className)} />
      </div>
    );
  }
);
