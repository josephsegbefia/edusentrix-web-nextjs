"use client";

import * as React from "react";
import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Plus,
  RotateCcw,
  Save,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  useAdmissionForm,
  useResetAdmissionForm,
  useSaveAdmissionForm,
  type AdmissionFormDTO,
} from "@/hooks/admissions/useAdmissionForm";
import type {
  AdmissionDocumentRequirement,
  AdmissionFormField,
  AdmissionFormFieldType,
  AdmissionFormSchema,
  AdmissionFormSection,
} from "@/lib/admissions/types";
import { admissionsAdminFieldClass } from "@/components/admissions/admissions-admin-ui";
import { FormBuilderValidations } from "./FormBuilderValidations";
import { LeoAdmissionsGuide } from "@/components/admissions/leo/LeoAdmissionsGuide";

const FIELD_TYPE_LABELS: Record<AdmissionFormFieldType, string> = {
  short_text: "Short text",
  long_text: "Paragraph",
  email: "Email",
  phone: "Phone",
  number: "Number",
  single_select: "Single choice",
  multi_select: "Multiple choice",
  boolean: "Yes / No",
  date: "Date",
  address: "Address",
  country: "Country",
  file_upload: "File upload",
  grade_picker: "Grade picker",
};

const SUPPORTS_OPTIONS = new Set<AdmissionFormFieldType>([
  "single_select",
  "multi_select",
]);

function nextId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

type FormBuilderTabProps = {
  cycleId: string;
};

type EditableState = {
  sections: AdmissionFormSection[];
  documentRequirements: AdmissionDocumentRequirement[];
  consentText: string;
};

function fromDto(dto: AdmissionFormDTO): EditableState {
  return {
    sections: structuredClone(dto.sections),
    documentRequirements: structuredClone(dto.documentRequirements),
    consentText: dto.consentText,
  };
}

export function FormBuilderTab({ cycleId }: FormBuilderTabProps) {
  const { data, isLoading, isError, error } = useAdmissionForm(cycleId);
  const save = useSaveAdmissionForm();
  const reset = useResetAdmissionForm();
  const [state, setState] = React.useState<EditableState | null>(null);
  const [resetOpen, setResetOpen] = React.useState(false);

  React.useEffect(() => {
    if (data?.data) setState(fromDto(data.data));
  }, [data?.data?.id, data?.data?.version]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading || !state) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-white/10 bg-slate-950/60 p-10 text-sm text-white/55">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading form…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-sm text-rose-100">
        {error instanceof Error ? error.message : "Could not load form"}
      </div>
    );
  }

  const dirty = data?.data
    ? JSON.stringify(state) !== JSON.stringify(fromDto(data.data))
    : false;

  const liveSchema: AdmissionFormSchema = {
    sections: state.sections,
    documentRequirements: state.documentRequirements,
    consentText: state.consentText,
    localeDefault: data?.data.localeDefault ?? "en",
  };

  function update(updater: (prev: EditableState) => EditableState) {
    setState((prev) => (prev ? updater(prev) : prev));
  }

  function handleSave() {
    if (!state) return;
    save.mutate(
      {
        cycleId,
        input: {
          sections: state.sections,
          documentRequirements: state.documentRequirements,
          consentText: state.consentText,
        },
      },
      {
        onSuccess: () => toast.success("Form saved"),
        onError: (err) => toast.error(err.message || "Could not save form"),
      }
    );
  }

  function handleReset() {
    reset.mutate(
      { cycleId },
      {
        onSuccess: () => {
          toast.success("Form reset to defaults");
          setResetOpen(false);
        },
        onError: (err) => toast.error(err.message || "Could not reset"),
      }
    );
  }

  return (
    <div className="space-y-5">
      <LeoAdmissionsGuide surface="form" schema={liveSchema} />

      <FormBuilderValidations schema={liveSchema} />

      <div className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-slate-950/60 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-white">Application form</p>
          <p className="text-xs text-white/55">
            Reorder sections, add custom questions, or hide optional fields.
            Fields marked with{" "}
            <Lock className="inline h-3 w-3 align-text-bottom text-white/55" />{" "}
            are required by EduSentrix to provision the student & guardian.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setResetOpen(true)}
            disabled={reset.isPending}
          >
            <RotateCcw className="mr-2 h-3.5 w-3.5" />
            Reset to defaults
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!dirty || save.isPending}
          >
            {save.isPending ? (
              <>
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Save className="mr-2 h-3.5 w-3.5" />
                Save changes
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {state.sections
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((section, sIdx) => (
            <SectionEditor
              key={section.id}
              section={section}
              isFirst={sIdx === 0}
              isLast={sIdx === state.sections.length - 1}
              onMoveUp={() =>
                update((prev) => ({
                  ...prev,
                  sections: swapOrder(prev.sections, section.id, -1),
                }))
              }
              onMoveDown={() =>
                update((prev) => ({
                  ...prev,
                  sections: swapOrder(prev.sections, section.id, 1),
                }))
              }
              onRemove={() =>
                update((prev) => ({
                  ...prev,
                  sections: prev.sections.filter((s) => s.id !== section.id),
                }))
              }
              onUpdate={(updated) =>
                update((prev) => ({
                  ...prev,
                  sections: prev.sections.map((s) =>
                    s.id === section.id ? updated : s
                  ),
                }))
              }
            />
          ))}
      </div>

      <Button
        variant="outline"
        className="w-full border-dashed border-white/15 bg-transparent text-white/70 hover:bg-white/5"
        onClick={() =>
          update((prev) => ({
            ...prev,
            sections: [
              ...prev.sections,
              {
                id: nextId("sec"),
                title: "New section",
                description: "",
                fields: [],
                order: prev.sections.length,
              },
            ],
          }))
        }
      >
        <Plus className="mr-2 h-3.5 w-3.5" />
        Add section
      </Button>

      <DocumentRequirementsEditor
        requirements={state.documentRequirements}
        onChange={(next) =>
          update((prev) => ({ ...prev, documentRequirements: next }))
        }
      />

      <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
        <Label className="text-xs font-semibold uppercase tracking-[0.18em] text-white/55">
          Consent statement
        </Label>
        <Textarea
          value={state.consentText}
          onChange={(e) =>
            update((prev) => ({ ...prev, consentText: e.target.value }))
          }
          rows={3}
          className={cn(admissionsAdminFieldClass, "mt-2")}
        />
      </div>

      <ConfirmationDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="Reset form to defaults?"
        description="This replaces your current form with the platform defaults and bumps the version. Existing applications keep the version they were submitted with."
        confirmLabel={reset.isPending ? "Resetting…" : "Reset form"}
        intent="destructive"
        onConfirm={handleReset}
        onCancel={() => setResetOpen(false)}
      />
    </div>
  );
}

function swapOrder<T extends { id: string; order: number }>(
  items: T[],
  id: string,
  delta: -1 | 1
): T[] {
  const sorted = items.slice().sort((a, b) => a.order - b.order);
  const idx = sorted.findIndex((i) => i.id === id);
  const target = idx + delta;
  if (idx < 0 || target < 0 || target >= sorted.length) return items;
  const a = sorted[idx];
  const b = sorted[target];
  return items.map((i) => {
    if (i.id === a.id) return { ...i, order: b.order };
    if (i.id === b.id) return { ...i, order: a.order };
    return i;
  });
}

function SectionEditor({
  section,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onRemove,
  onUpdate,
}: {
  section: AdmissionFormSection;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  onUpdate: (next: AdmissionFormSection) => void;
}) {
  const lockedSection = Boolean(section.systemKey); // platform sections are kept

  function updateField(fieldId: string, patch: Partial<AdmissionFormField>) {
    onUpdate({
      ...section,
      fields: section.fields.map((f) =>
        f.id === fieldId ? { ...f, ...patch } : f
      ),
    });
  }

  function moveField(fieldId: string, delta: -1 | 1) {
    onUpdate({ ...section, fields: swapOrder(section.fields, fieldId, delta) });
  }

  function removeField(fieldId: string) {
    onUpdate({
      ...section,
      fields: section.fields.filter((f) => f.id !== fieldId),
    });
  }

  function addField() {
    onUpdate({
      ...section,
      fields: [
        ...section.fields,
        {
          id: nextId("fld"),
          label: "New question",
          type: "short_text",
          required: false,
          visible: true,
          order: section.fields.length,
        },
      ],
    });
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/60">
      <div className="flex items-start justify-between gap-3 p-4">
        <div className="flex-1 space-y-2">
          <Input
            value={section.title}
            onChange={(e) => onUpdate({ ...section, title: e.target.value })}
            className={cn(admissionsAdminFieldClass, "text-base font-semibold")}
            placeholder="Section title"
          />
          <Textarea
            value={section.description ?? ""}
            onChange={(e) =>
              onUpdate({ ...section, description: e.target.value })
            }
            rows={2}
            placeholder="Optional helper text shown above the questions"
            className={cn(admissionsAdminFieldClass, "text-xs")}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Button
            variant="ghost"
            size="sm"
            disabled={isFirst}
            onClick={onMoveUp}
            className="h-7 w-7 p-0"
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={isLast}
            onClick={onMoveDown}
            className="h-7 w-7 p-0"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={lockedSection}
            onClick={onRemove}
            className="h-7 w-7 p-0 text-rose-400 hover:text-rose-300"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="space-y-2 px-4 pb-4">
        {section.fields
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((field) => (
            <FieldRow
              key={field.id}
              field={field}
              onChange={(patch) => updateField(field.id, patch)}
              onMoveUp={() => moveField(field.id, -1)}
              onMoveDown={() => moveField(field.id, 1)}
              onRemove={() => removeField(field.id)}
            />
          ))}
        <Button
          variant="ghost"
          size="sm"
          onClick={addField}
          className="w-full border border-dashed border-white/10 hover:bg-white/5"
        >
          <Plus className="mr-2 h-3.5 w-3.5" />
          Add question
        </Button>
      </div>
    </div>
  );
}

function FieldRow({
  field,
  onChange,
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  field: AdmissionFormField;
  onChange: (patch: Partial<AdmissionFormField>) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}) {
  const locked = Boolean(field.isPlatformRequired);
  const supportsOptions = SUPPORTS_OPTIONS.has(field.type);

  return (
    <div
      className={cn(
        "rounded-xl border border-white/10 bg-black/20 p-3",
        !field.visible && "opacity-60"
      )}
    >
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex flex-col gap-1">
          <Button variant="ghost" size="sm" onClick={onMoveUp} className="h-6 w-6 p-0">
            <ChevronUp className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="sm" onClick={onMoveDown} className="h-6 w-6 p-0">
            <ChevronDown className="h-3 w-3" />
          </Button>
        </div>

        <div className="flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={field.label}
              onChange={(e) => onChange({ label: e.target.value })}
              className={cn(
                admissionsAdminFieldClass,
                "h-8 max-w-md flex-1 text-sm"
              )}
            />
            {locked ? (
              <Badge
                variant="outline"
                className="border-amber-500/30 bg-amber-500/10 text-amber-100"
              >
                <Lock className="mr-1 h-3 w-3" /> platform required
              </Badge>
            ) : null}
            {field.systemFieldKey && !locked ? (
              <Badge
                variant="outline"
                className="border-white/10 bg-white/5 text-[11px] text-white/55"
              >
                {field.systemFieldKey}
              </Badge>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <PremiumSelect
              value={field.type}
              onValueChange={(v) =>
                !locked && onChange({ type: v as AdmissionFormFieldType })
              }
            >
              <PremiumSelectTrigger className="h-8 w-44">
                <PremiumSelectValue />
              </PremiumSelectTrigger>
              <PremiumSelectContent>
                {Object.entries(FIELD_TYPE_LABELS).map(([key, label]) => (
                  <PremiumSelectItem key={key} value={key}>
                    {label}
                  </PremiumSelectItem>
                ))}
              </PremiumSelectContent>
            </PremiumSelect>

            <label className="flex items-center gap-1.5 text-xs text-white/70">
              <Checkbox
                checked={field.required}
                onCheckedChange={(v) =>
                  !locked && onChange({ required: Boolean(v) })
                }
                disabled={locked}
              />
              Required
            </label>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => !locked && onChange({ visible: !field.visible })}
              disabled={locked}
              className="h-7 px-2 text-xs text-white/70"
            >
              {field.visible ? (
                <>
                  <Eye className="mr-1 h-3 w-3" />
                  Visible
                </>
              ) : (
                <>
                  <EyeOff className="mr-1 h-3 w-3" />
                  Hidden
                </>
              )}
            </Button>
          </div>

          <Input
            value={field.helpText ?? ""}
            onChange={(e) => onChange({ helpText: e.target.value })}
            placeholder="Helper text (optional)"
            className={cn(admissionsAdminFieldClass, "h-8 text-xs")}
          />

          {supportsOptions ? (
            <OptionsEditor
              options={field.options ?? []}
              onChange={(next) => onChange({ options: next })}
              disabled={locked}
            />
          ) : null}
        </div>

        <Button
          variant="ghost"
          size="sm"
          disabled={locked}
          onClick={onRemove}
          className="h-7 w-7 p-0 text-rose-400 hover:text-rose-300"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function OptionsEditor({
  options,
  onChange,
  disabled,
}: {
  options: Array<{ value: string; label: string }>;
  onChange: (next: Array<{ value: string; label: string }>) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5 rounded-lg border border-white/5 bg-black/20 p-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-white/40">
        Choices
      </p>
      {options.map((opt, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <Input
            value={opt.label}
            onChange={(e) =>
              onChange(
                options.map((o, i) =>
                  i === idx
                    ? {
                        label: e.target.value,
                        value: e.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9]+/g, "_")
                          .replace(/^_+|_+$/g, "")
                          .slice(0, 40) || `option_${idx + 1}`,
                      }
                    : o
                )
              )
            }
            disabled={disabled}
            placeholder="Option label"
            className={cn(admissionsAdminFieldClass, "h-7 text-xs")}
          />
          <Button
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={() => onChange(options.filter((_, i) => i !== idx))}
            className="h-7 w-7 p-0 text-rose-400 hover:text-rose-300"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      ))}
      <Button
        variant="ghost"
        size="sm"
        disabled={disabled}
        onClick={() => onChange([...options, { value: "", label: "" }])}
        className="h-7 text-xs"
      >
        <Plus className="mr-1 h-3 w-3" />
        Add choice
      </Button>
    </div>
  );
}

function DocumentRequirementsEditor({
  requirements,
  onChange,
}: {
  requirements: AdmissionDocumentRequirement[];
  onChange: (next: AdmissionDocumentRequirement[]) => void;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-white">Document uploads</p>
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            onChange([
              ...requirements,
              {
                id: nextId("doc"),
                label: "New document",
                required: false,
                mimeTypes: ["application/pdf", "image/jpeg", "image/png"],
                maxSizeMb: 5,
              },
            ])
          }
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          Add document
        </Button>
      </div>

      <div className="space-y-2">
        {requirements.length === 0 ? (
          <p className="text-xs text-white/40">No document uploads configured.</p>
        ) : (
          requirements.map((req, idx) => (
            <div
              key={req.id}
              className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-black/20 p-3"
            >
              <Input
                value={req.label}
                onChange={(e) =>
                  onChange(
                    requirements.map((r, i) =>
                      i === idx ? { ...r, label: e.target.value } : r
                    )
                  )
                }
                className={cn(
                  admissionsAdminFieldClass,
                  "h-8 max-w-xs flex-1"
                )}
              />
              <Input
                value={req.helpText ?? ""}
                onChange={(e) =>
                  onChange(
                    requirements.map((r, i) =>
                      i === idx ? { ...r, helpText: e.target.value } : r
                    )
                  )
                }
                placeholder="Helper text"
                className={cn(
                  admissionsAdminFieldClass,
                  "h-8 max-w-xs flex-1"
                )}
              />
              <label className="flex items-center gap-1.5 text-xs text-white/70">
                <Checkbox
                  checked={req.required}
                  onCheckedChange={(v) =>
                    onChange(
                      requirements.map((r, i) =>
                        i === idx ? { ...r, required: Boolean(v) } : r
                      )
                    )
                  }
                />
                Required
              </label>
              <Input
                type="number"
                value={req.maxSizeMb ?? 5}
                onChange={(e) =>
                  onChange(
                    requirements.map((r, i) =>
                      i === idx
                        ? { ...r, maxSizeMb: Number(e.target.value) }
                        : r
                    )
                  )
                }
                className={cn(admissionsAdminFieldClass, "h-8 w-20")}
              />
              <span className="text-[11px] text-white/40">MB</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  onChange(requirements.filter((_, i) => i !== idx))
                }
                className="h-7 w-7 p-0 text-rose-400 hover:text-rose-300"
                disabled={req.isPlatformRequired}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
