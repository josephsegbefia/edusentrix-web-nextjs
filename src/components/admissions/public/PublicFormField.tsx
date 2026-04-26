"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import { cn } from "@/lib/utils";
import type {
  AdmissionFormField,
  AdmissionFormFieldOption,
} from "@/lib/admissions/types";
import type { PublicGradeDTO } from "@/lib/admissions/public-shape";

type Value = string | number | boolean | string[] | null;

type PublicFormFieldProps = {
  field: AdmissionFormField;
  value: Value;
  onChange: (next: Value) => void;
  error?: string | null;
  /** Grade options when the field is grade_picker. */
  grades?: PublicGradeDTO[];
};

type FieldA11y = {
  inputId: string;
  helpId?: string;
  errorId?: string;
  describedBy?: string;
};

function useFieldA11y(field: AdmissionFormField, error?: string | null): FieldA11y {
  const reactId = React.useId();
  const inputId = `pf-${field.id || reactId}`;
  const helpId = field.helpText ? `${inputId}-help` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedBy = [helpId, errorId].filter(Boolean).join(" ") || undefined;
  return { inputId, helpId, errorId, describedBy };
}

function FieldShell({
  field,
  error,
  inputId,
  helpId,
  errorId,
  children,
}: {
  field: AdmissionFormField;
  error?: string | null;
  inputId: string;
  helpId?: string;
  errorId?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label
        htmlFor={inputId}
        className="flex items-center gap-1 text-sm font-medium text-foreground"
      >
        {field.label}
        {field.required ? (
          <span aria-hidden className="text-rose-500">
            *
          </span>
        ) : null}
        {field.required ? (
          <span className="sr-only"> (required)</span>
        ) : null}
      </Label>
      {field.helpText ? (
        <p id={helpId} className="text-xs text-muted-foreground">
          {field.helpText}
        </p>
      ) : null}
      {children}
      {error ? (
        <p
          id={errorId}
          role="alert"
          aria-live="polite"
          className="text-xs font-medium text-rose-600 dark:text-rose-400"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function PublicFormField({
  field,
  value,
  onChange,
  error,
  grades,
}: PublicFormFieldProps) {
  const { inputId, helpId, errorId, describedBy } = useFieldA11y(field, error);
  const baseInputClass = cn(
    "w-full bg-background",
    error && "border-rose-500 focus-visible:ring-rose-500/30"
  );
  const ariaCommon = {
    id: inputId,
    "aria-invalid": Boolean(error) || undefined,
    "aria-required": field.required || undefined,
    "aria-describedby": describedBy,
  } as const;

  switch (field.type) {
    case "long_text": {
      return (
        <FieldShell
          field={field}
          error={error}
          inputId={inputId}
          helpId={helpId}
          errorId={errorId}
        >
          <Textarea
            {...ariaCommon}
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            rows={4}
            className={baseInputClass}
          />
        </FieldShell>
      );
    }
    case "address": {
      return (
        <FieldShell
          field={field}
          error={error}
          inputId={inputId}
          helpId={helpId}
          errorId={errorId}
        >
          <Textarea
            {...ariaCommon}
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            rows={2}
            placeholder="House / street, city, region"
            className={baseInputClass}
            autoComplete="street-address"
          />
        </FieldShell>
      );
    }
    case "boolean": {
      return (
        <div className="space-y-1.5">
          <label
            htmlFor={inputId}
            className="flex items-start gap-3 rounded-xl border border-border/60 bg-background px-3 py-3 text-sm text-foreground transition-colors hover:border-border focus-within:border-foreground/40 focus-within:ring-2 focus-within:ring-foreground/10"
          >
            <Checkbox
              id={inputId}
              checked={Boolean(value)}
              onCheckedChange={(checked) => onChange(Boolean(checked))}
              aria-required={field.required || undefined}
              aria-invalid={Boolean(error) || undefined}
              aria-describedby={describedBy}
              className="mt-0.5"
            />
            <span className="leading-snug">
              {field.label}
              {field.required ? (
                <>
                  <span aria-hidden className="ml-0.5 text-rose-500">
                    *
                  </span>
                  <span className="sr-only"> (required)</span>
                </>
              ) : null}
              {field.helpText ? (
                <span
                  id={helpId}
                  className="mt-1 block text-xs text-muted-foreground"
                >
                  {field.helpText}
                </span>
              ) : null}
            </span>
          </label>
          {error ? (
            <p
              id={errorId}
              role="alert"
              aria-live="polite"
              className="text-xs font-medium text-rose-600 dark:text-rose-400"
            >
              {error}
            </p>
          ) : null}
        </div>
      );
    }
    case "single_select": {
      const options = (field.options ?? []) as AdmissionFormFieldOption[];
      return (
        <FieldShell
          field={field}
          error={error}
          inputId={inputId}
          helpId={helpId}
          errorId={errorId}
        >
          <PremiumSelect
            value={(value as string) ?? ""}
            onValueChange={(v) => onChange(v)}
          >
            <PremiumSelectTrigger
              id={inputId}
              aria-required={field.required || undefined}
              aria-invalid={Boolean(error) || undefined}
              aria-describedby={describedBy}
              className={baseInputClass}
            >
              <PremiumSelectValue placeholder="Choose an option" />
            </PremiumSelectTrigger>
            <PremiumSelectContent>
              {options.map((opt) => (
                <PremiumSelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </PremiumSelectItem>
              ))}
            </PremiumSelectContent>
          </PremiumSelect>
        </FieldShell>
      );
    }
    case "multi_select": {
      const options = (field.options ?? []) as AdmissionFormFieldOption[];
      const arr = Array.isArray(value) ? (value as string[]) : [];
      return (
        <FieldShell
          field={field}
          error={error}
          inputId={inputId}
          helpId={helpId}
          errorId={errorId}
        >
          <div
            role="group"
            aria-labelledby={`${inputId}-grouplabel`}
            aria-describedby={describedBy}
            className="grid gap-2 rounded-xl border border-border/60 bg-background p-3 sm:grid-cols-2"
          >
            <span id={`${inputId}-grouplabel`} className="sr-only">
              {field.label}
            </span>
            {options.map((opt, idx) => {
              const checked = arr.includes(opt.value);
              const optId = `${inputId}-${idx}`;
              return (
                <label
                  key={opt.value}
                  htmlFor={optId}
                  className="flex items-center gap-2 text-sm text-foreground"
                >
                  <Checkbox
                    id={optId}
                    checked={checked}
                    onCheckedChange={(value) => {
                      if (value) onChange([...arr, opt.value]);
                      else onChange(arr.filter((v) => v !== opt.value));
                    }}
                  />
                  {opt.label}
                </label>
              );
            })}
          </div>
        </FieldShell>
      );
    }
    case "grade_picker": {
      const options = grades ?? [];
      return (
        <FieldShell
          field={field}
          error={error}
          inputId={inputId}
          helpId={helpId}
          errorId={errorId}
        >
          <PremiumSelect
            value={(value as string) ?? ""}
            onValueChange={(v) => onChange(v)}
          >
            <PremiumSelectTrigger
              id={inputId}
              aria-required={field.required || undefined}
              aria-invalid={Boolean(error) || undefined}
              aria-describedby={describedBy}
              className={baseInputClass}
            >
              <PremiumSelectValue placeholder="Select grade" />
            </PremiumSelectTrigger>
            <PremiumSelectContent>
              {options.length === 0 ? (
                <PremiumSelectItem value="__none" disabled>
                  No grades configured
                </PremiumSelectItem>
              ) : (
                options.map((g) => (
                  <PremiumSelectItem key={g.id} value={g.id}>
                    {g.name}
                  </PremiumSelectItem>
                ))
              )}
            </PremiumSelectContent>
          </PremiumSelect>
        </FieldShell>
      );
    }
    case "date": {
      return (
        <FieldShell
          field={field}
          error={error}
          inputId={inputId}
          helpId={helpId}
          errorId={errorId}
        >
          <Input
            {...ariaCommon}
            type="date"
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            className={baseInputClass}
            autoComplete="bday"
          />
        </FieldShell>
      );
    }
    case "number": {
      return (
        <FieldShell
          field={field}
          error={error}
          inputId={inputId}
          helpId={helpId}
          errorId={errorId}
        >
          <Input
            {...ariaCommon}
            type="number"
            inputMode="numeric"
            value={value === null || value === undefined ? "" : String(value)}
            onChange={(e) =>
              onChange(e.target.value === "" ? null : Number(e.target.value))
            }
            min={field.validators?.min}
            max={field.validators?.max}
            className={baseInputClass}
          />
        </FieldShell>
      );
    }
    case "email": {
      return (
        <FieldShell
          field={field}
          error={error}
          inputId={inputId}
          helpId={helpId}
          errorId={errorId}
        >
          <Input
            {...ariaCommon}
            type="email"
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder="name@example.com"
            className={baseInputClass}
            autoComplete="email"
            inputMode="email"
          />
        </FieldShell>
      );
    }
    case "phone": {
      return (
        <FieldShell
          field={field}
          error={error}
          inputId={inputId}
          helpId={helpId}
          errorId={errorId}
        >
          <Input
            {...ariaCommon}
            type="tel"
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder="+233 ..."
            className={baseInputClass}
            autoComplete="tel"
            inputMode="tel"
          />
        </FieldShell>
      );
    }
    case "file_upload": {
      return (
        <FieldShell
          field={field}
          error={error}
          inputId={inputId}
          helpId={helpId}
          errorId={errorId}
        >
          <div
            id={inputId}
            className="rounded-xl border border-dashed border-border/60 bg-muted/40 p-3 text-xs text-muted-foreground"
          >
            Use the Documents step to upload this file.
          </div>
        </FieldShell>
      );
    }
    case "country":
    case "short_text":
    default: {
      return (
        <FieldShell
          field={field}
          error={error}
          inputId={inputId}
          helpId={helpId}
          errorId={errorId}
        >
          <Input
            {...ariaCommon}
            type="text"
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            className={baseInputClass}
          />
        </FieldShell>
      );
    }
  }
}
