"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { formatGhanaPhoneInput } from "@/lib/phone/ghana";

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

export const GhanaPhoneInput = React.forwardRef<HTMLInputElement, GhanaPhoneInputProps>(
  function GhanaPhoneInput(
    {
      onChange,
      onValueChange,
      value,
      defaultValue,
      placeholder = "+233 24 123 4567",
      autoComplete = "tel",
      inputMode = "tel",
      unstyled = false,
      ...props
    },
    forwardedRef
  ) {
    const innerRef = React.useRef<HTMLInputElement | null>(null);

    const syncDisplayedValue = React.useCallback(() => {
      if (!innerRef.current) return;
      const formatted = formatGhanaPhoneInput(innerRef.current.value);
      if (formatted !== innerRef.current.value) {
        innerRef.current.value = formatted;
      }
    }, []);

    React.useEffect(() => {
      syncDisplayedValue();
    }, [syncDisplayedValue, value, defaultValue]);

    const formattedValue =
      value === undefined ? undefined : formatGhanaPhoneInput(value ?? "");
    const formattedDefaultValue =
      defaultValue === undefined
        ? undefined
        : formatGhanaPhoneInput(defaultValue ?? "");

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const formatted = formatGhanaPhoneInput(event.target.value);

      if (innerRef.current && innerRef.current.value !== formatted) {
        innerRef.current.value = formatted;
      }

      onValueChange?.(formatted);

      if (onChange) {
        const nextEvent = {
          ...event,
          target: { ...event.target, value: formatted },
          currentTarget: { ...event.currentTarget, value: formatted },
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
      placeholder,
      defaultValue: formattedDefaultValue,
      onChange: handleChange,
    };

    if (formattedValue !== undefined) {
      sharedProps.value = formattedValue;
    }

    if (unstyled) {
      return <input {...sharedProps} />;
    }

    return <Input {...sharedProps} />;
  }
);
