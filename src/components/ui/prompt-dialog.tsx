"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/responsive-modal";
import { cn } from "@/lib/utils";
import type { ConfirmationDialogIntent } from "@/components/ui/confirmation-dialog";

export type PromptDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  inputLabel?: string;
  placeholder?: string;
  value: string;
  onValueChange: (value: string) => void;
  confirmLabel?: string;
  cancelLabel?: string;
  intent?: ConfirmationDialogIntent;
  onConfirm: () => void;
  onCancel: () => void;
  className?: string;
  zIndexClass?: string;
};

export function PromptDialog({
  open,
  onOpenChange,
  title,
  description,
  inputLabel = "Note",
  placeholder,
  value,
  onValueChange,
  confirmLabel = "Continue",
  cancelLabel = "Cancel",
  intent = "default",
  onConfirm,
  onCancel,
  className,
  zIndexClass = "z-50",
}: PromptDialogProps) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      className={cn("sm:max-w-md", className)}
      zIndexClass={zIndexClass}
    >
      <div className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="prompt-dialog-input" className="text-white/80">
            {inputLabel}
          </Label>
          <Input
            id="prompt-dialog-input"
            value={value}
            onChange={(e) => onValueChange(e.target.value)}
            placeholder={placeholder}
            className="border-white/10 bg-black/40 text-white placeholder:text-white/35 focus-visible:ring-violet-500/30"
            autoComplete="off"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onConfirm();
              }
            }}
          />
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-white/10 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="border-white/10 bg-white/5 text-white hover:bg-white/10"
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            className={cn(
              "text-white",
              intent === "destructive" && "bg-rose-600 hover:bg-rose-700",
              intent === "warning" && "bg-amber-600 hover:bg-amber-700",
              intent === "default" && "bg-brand text-black hover:opacity-90"
            )}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
