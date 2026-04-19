"use client";

import type { LucideIcon } from "lucide-react";
import {
  Atom,
  Binary,
  Calculator,
  Dumbbell,
  FlaskConical,
  Globe,
  Landmark,
  Languages,
  Leaf,
  Music4,
  Palette,
  ScrollText,
  Shapes,
} from "lucide-react";
import type { SubjectDTO } from "@/hooks/admin/useSubjects";

export type SubjectVisual = {
  icon: LucideIcon;
  card: string;
  glow: string;
  accent: string;
  iconShell: string;
  iconColor: string;
  codeBadge: string;
  statIcon: string;
};

const visualMap: Record<string, Omit<SubjectVisual, "icon">> = {
  amber: {
    card:
      "border-amber-400/15 from-amber-950/65 via-slate-950/92 to-black/80 hover:border-amber-300/25",
    glow: "bg-amber-300/18",
    accent: "bg-linear-to-b from-amber-200 via-amber-400 to-orange-500",
    iconShell:
      "border-amber-300/20 bg-linear-to-br from-amber-300/18 via-orange-300/10 to-transparent",
    iconColor: "text-amber-100",
    codeBadge: "border-amber-300/15 bg-amber-300/10 text-amber-50/85",
    statIcon: "text-amber-200/80",
  },
  teal: {
    card:
      "border-teal-400/15 from-teal-950/60 via-slate-950/92 to-black/80 hover:border-teal-300/25",
    glow: "bg-teal-300/18",
    accent: "bg-linear-to-b from-teal-200 via-teal-400 to-cyan-500",
    iconShell:
      "border-teal-300/20 bg-linear-to-br from-teal-300/16 via-cyan-300/10 to-transparent",
    iconColor: "text-teal-100",
    codeBadge: "border-teal-300/15 bg-teal-300/10 text-teal-50/85",
    statIcon: "text-teal-200/80",
  },
  violet: {
    card:
      "border-violet-400/15 from-violet-950/60 via-slate-950/92 to-black/80 hover:border-violet-300/25",
    glow: "bg-violet-300/18",
    accent: "bg-linear-to-b from-violet-200 via-violet-400 to-fuchsia-500",
    iconShell:
      "border-violet-300/20 bg-linear-to-br from-violet-300/16 via-fuchsia-300/10 to-transparent",
    iconColor: "text-violet-100",
    codeBadge: "border-violet-300/15 bg-violet-300/10 text-violet-50/85",
    statIcon: "text-violet-200/80",
  },
  emerald: {
    card:
      "border-emerald-400/15 from-emerald-950/60 via-slate-950/92 to-black/80 hover:border-emerald-300/25",
    glow: "bg-emerald-300/18",
    accent: "bg-linear-to-b from-emerald-200 via-emerald-400 to-lime-500",
    iconShell:
      "border-emerald-300/20 bg-linear-to-br from-emerald-300/16 via-lime-300/10 to-transparent",
    iconColor: "text-emerald-100",
    codeBadge: "border-emerald-300/15 bg-emerald-300/10 text-emerald-50/85",
    statIcon: "text-emerald-200/80",
  },
  rose: {
    card:
      "border-rose-400/15 from-rose-950/60 via-slate-950/92 to-black/80 hover:border-rose-300/25",
    glow: "bg-rose-300/18",
    accent: "bg-linear-to-b from-rose-200 via-rose-400 to-pink-500",
    iconShell:
      "border-rose-300/20 bg-linear-to-br from-rose-300/16 via-pink-300/10 to-transparent",
    iconColor: "text-rose-100",
    codeBadge: "border-rose-300/15 bg-rose-300/10 text-rose-50/85",
    statIcon: "text-rose-200/80",
  },
  stone: {
    card:
      "border-orange-300/12 from-orange-950/55 via-slate-950/92 to-black/80 hover:border-orange-200/22",
    glow: "bg-orange-200/14",
    accent: "bg-linear-to-b from-orange-100 via-orange-300 to-amber-500",
    iconShell:
      "border-orange-200/18 bg-linear-to-br from-orange-200/14 via-amber-200/8 to-transparent",
    iconColor: "text-orange-50",
    codeBadge: "border-orange-200/12 bg-orange-200/8 text-orange-50/80",
    statIcon: "text-orange-100/80",
  },
  sky: {
    card:
      "border-sky-400/15 from-sky-950/60 via-slate-950/92 to-black/80 hover:border-sky-300/25",
    glow: "bg-sky-300/18",
    accent: "bg-linear-to-b from-sky-200 via-sky-400 to-blue-500",
    iconShell:
      "border-sky-300/20 bg-linear-to-br from-sky-300/16 via-blue-300/10 to-transparent",
    iconColor: "text-sky-100",
    codeBadge: "border-sky-300/15 bg-sky-300/10 text-sky-50/85",
    statIcon: "text-sky-200/80",
  },
};

export function resolveSubjectVisual(subject: SubjectDTO): SubjectVisual {
  const haystack = `${subject.name} ${subject.code ?? ""}`.toLowerCase();

  if (
    /(math|mathematics|further math|furthermath|statistics|algebra|geometry|calculus|arith|quant)/.test(
      haystack
    )
  ) {
    return { icon: Calculator, ...visualMap.amber };
  }

  if (/(physics|physical science|elective science)/.test(haystack)) {
    return { icon: Atom, ...visualMap.violet };
  }

  if (/(chem|science|laboratory|lab|stem)/.test(haystack)) {
    return { icon: FlaskConical, ...visualMap.sky };
  }

  if (/(bio|agric|environment|nature|crop|food|nutrition|home econ)/.test(haystack)) {
    return { icon: Leaf, ...visualMap.emerald };
  }

  if (/(english|language|french|spanish|literature|reading|writing|phonics)/.test(haystack)) {
    return { icon: Languages, ...visualMap.teal };
  }

  if (/(history|government|civic|social|relig|economics|business|commerce)/.test(haystack)) {
    return { icon: Landmark, ...visualMap.stone };
  }

  if (/(geo|global|world)/.test(haystack)) {
    return { icon: Globe, ...visualMap.teal };
  }

  if (/(ict|comput|coding|program|robot|digital|technology)/.test(haystack)) {
    return { icon: Binary, ...visualMap.violet };
  }

  if (/(art|design|creative|drawing|craft|visual)/.test(haystack)) {
    return { icon: Palette, ...visualMap.rose };
  }

  if (/(music|choir|band|orchestra)/.test(haystack)) {
    return { icon: Music4, ...visualMap.rose };
  }

  if (/(sport|physical|pe\b|p\\.e|fitness|athlet)/.test(haystack)) {
    return { icon: Dumbbell, ...visualMap.emerald };
  }

  if (/(rme|religious|ethics|moral|cultural)/.test(haystack)) {
    return { icon: ScrollText, ...visualMap.stone };
  }

  return { icon: Shapes, ...visualMap.teal };
}
