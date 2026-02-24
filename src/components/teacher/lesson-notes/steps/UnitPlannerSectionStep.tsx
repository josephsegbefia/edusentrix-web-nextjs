"use client";

import * as React from "react";
import { Plus, X, Lightbulb } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CompactRichText } from "@/components/ui/rich-text-editor";
import {
  PremiumSelect,
  PremiumSelectContent,
  PremiumSelectItem,
  PremiumSelectTrigger,
  PremiumSelectValue,
} from "@/components/ui/premium-select";
import type { UnitPlannerSection, CurriculumMetadataField } from "@/constants/curriculum-lesson-templates";

type UnitPlannerSectionStepProps = {
  section: UnitPlannerSection;
  data: Record<string, unknown>;
  onUpdate: (updates: Record<string, unknown>) => void;
};

export function UnitPlannerSectionStep({ section, data, onUpdate }: UnitPlannerSectionStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white">{section.label}</h2>
        {section.description && (
          <p className="text-sm text-white/60">{section.description}</p>
        )}
      </div>

      {section.fields.map((field) => (
        <DynamicField
          key={field.key}
          field={field}
          value={data[field.key]}
          onChange={(val) => onUpdate({ [field.key]: val })}
        />
      ))}
    </div>
  );
}

function DynamicField({
  field,
  value,
  onChange,
}: {
  field: CurriculumMetadataField;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  switch (field.type) {
    case "text":
      return (
        <div className="space-y-2">
          <Label className="text-white/70">
            {field.label}
            {field.required && <span className="text-rose-400 ml-1">*</span>}
          </Label>
          <Input
            value={(value as string) || ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            className="border-white/10 bg-white/5 text-white"
          />
        </div>
      );

    case "richtext":
      return (
        <div className="space-y-2">
          <Label className="text-white/70">
            {field.label}
            {field.required && <span className="text-rose-400 ml-1">*</span>}
          </Label>
          <CompactRichText
            value={(value as string) || ""}
            onChange={(val) => onChange(val)}
            placeholder={field.placeholder}
          />
        </div>
      );

    case "select":
      return (
        <div className="space-y-2">
          <Label className="text-white/70">
            {field.label}
            {field.required && <span className="text-rose-400 ml-1">*</span>}
          </Label>
          <PremiumSelect
            value={(value as string) || ""}
            onValueChange={(val) => onChange(val)}
          >
            <PremiumSelectTrigger>
              <PremiumSelectValue placeholder={field.placeholder} />
            </PremiumSelectTrigger>
            <PremiumSelectContent>
              {(field.options || []).map((opt) => (
                <PremiumSelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </PremiumSelectItem>
              ))}
            </PremiumSelectContent>
          </PremiumSelect>
        </div>
      );

    case "outcome_list":
      return <OutcomeListField field={field} value={value} onChange={onChange} />;

    case "tag_list":
      return <TagListField field={field} value={value} onChange={onChange} />;

    case "indicator_list":
      return <IndicatorListField field={field} value={value} onChange={onChange} />;

    default:
      return null;
  }
}

function OutcomeListField({
  field,
  value,
  onChange,
}: {
  field: CurriculumMetadataField;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const items = (value as string[]) || [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2 text-white/70">
          <Lightbulb className="h-4 w-4" />
          {field.label}
          {field.required && <span className="text-rose-400">*</span>}
        </Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange([...items, ""])}
          className="border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
        >
          <Plus className="mr-1 h-3 w-3" />
          Add
        </Button>
      </div>
      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 bg-white/5 p-4 text-center text-sm text-white/40">
          No items added yet. Click &quot;Add&quot; to begin.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-500/20 text-xs text-violet-200">
                {idx + 1}
              </span>
              <Input
                value={item}
                onChange={(e) => {
                  const copy = [...items];
                  copy[idx] = e.target.value;
                  onChange(copy);
                }}
                placeholder={field.placeholder}
                className="flex-1 border-white/10 bg-white/5 text-white"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onChange(items.filter((_, i) => i !== idx))}
                className="h-9 w-9 p-0 text-rose-400 hover:bg-rose-500/20 hover:text-rose-300"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TagListField({
  field,
  value,
  onChange,
}: {
  field: CurriculumMetadataField;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const tags = (value as string[]) || [];
  const [input, setInput] = React.useState("");

  const addTag = () => {
    const trimmed = input.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
      setInput("");
    }
  };

  return (
    <div className="space-y-2">
      <Label className="text-white/70">
        {field.label}
        {field.required && <span className="text-rose-400 ml-1">*</span>}
      </Label>
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addTag();
            }
          }}
          placeholder={field.placeholder}
          className="flex-1 border-white/10 bg-white/5 text-white"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addTag}
          className="border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag, idx) => (
            <Badge
              key={idx}
              variant="outline"
              className="border-white/10 bg-white/5 text-white/70 text-xs gap-1 pr-1"
            >
              {tag}
              <button
                type="button"
                onClick={() => onChange(tags.filter((_, i) => i !== idx))}
                className="ml-0.5 rounded-full p-0.5 hover:bg-white/10"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

function IndicatorListField({
  field,
  value,
  onChange,
}: {
  field: CurriculumMetadataField;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const items = (value as Array<{ refNo: string; text: string }>) || [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-white/70">{field.label}</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange([...items, { refNo: "", text: "" }])}
          className="border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
        >
          <Plus className="mr-1 h-3 w-3" />
          Add
        </Button>
      </div>
      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 bg-white/5 p-4 text-center text-sm text-white/40">
          No items added yet.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item, idx) => (
            <div key={idx} className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="flex items-start gap-3">
                <div className="w-24 shrink-0">
                  <Input
                    value={item.refNo}
                    onChange={(e) => {
                      const copy = [...items];
                      copy[idx] = { ...copy[idx], refNo: e.target.value };
                      onChange(copy);
                    }}
                    placeholder={field.placeholder}
                    className="border-white/10 bg-white/5 text-white text-xs"
                  />
                </div>
                <div className="flex-1">
                  <Input
                    value={item.text}
                    onChange={(e) => {
                      const copy = [...items];
                      copy[idx] = { ...copy[idx], text: e.target.value };
                      onChange(copy);
                    }}
                    placeholder="Description"
                    className="border-white/10 bg-white/5 text-white"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onChange(items.filter((_, i) => i !== idx))}
                  className="h-9 w-9 p-0 text-rose-400 hover:bg-rose-500/20 hover:text-rose-300"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
