"use client";

import * as React from "react";
import { Mail, Phone, Search, Star, UserPlus, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  type ExistingGuardianSearchResult,
  type GuardianRelationship,
  type GuardianData,
  type GuardianSiblingCandidate,
  useExistingGuardianSearch,
  useLinkExistingGuardian,
} from "@/hooks/admin/useGuardians";

const RELATIONSHIP_OPTIONS: Array<{ value: GuardianRelationship; label: string }> = [
  { value: "mother", label: "Mother" },
  { value: "father", label: "Father" },
  { value: "guardian", label: "Guardian" },
  { value: "step_mother", label: "Step Mother" },
  { value: "step_father", label: "Step Father" },
  { value: "grandmother", label: "Grandmother" },
  { value: "grandfather", label: "Grandfather" },
  { value: "aunt", label: "Aunt" },
  { value: "uncle", label: "Uncle" },
  { value: "other", label: "Other" },
];

type ExistingGuardianLinkerProps = {
  studentId: string;
  onLinked: (result: {
    guardian: GuardianData;
    siblingCandidates: GuardianSiblingCandidate[];
  }) => void;
  onCancel: () => void;
};

function siblingText(result: ExistingGuardianSearchResult) {
  const count = result.siblingCandidates.length;
  if (count === 0) return "No other linked wards found for this parent yet.";
  if (count === 1) return "1 possible sibling already linked to this parent.";
  return `${count} possible siblings already linked to this parent.`;
}

export function ExistingGuardianLinker({
  studentId,
  onLinked,
  onCancel,
}: ExistingGuardianLinkerProps) {
  const [query, setQuery] = React.useState("");
  const [relationshipByUser, setRelationshipByUser] = React.useState<
    Record<string, GuardianRelationship>
  >({});
  const [primaryByUser, setPrimaryByUser] = React.useState<Record<string, boolean>>({});
  const search = useExistingGuardianSearch(studentId, query);
  const linkExisting = useLinkExistingGuardian(studentId);

  const results = search.data || [];

  async function handleLink(result: ExistingGuardianSearchResult) {
    const relationship = relationshipByUser[result.guardian.userId] || result.guardian.relationship || "guardian";
    const linked = await linkExisting.mutateAsync({
      userId: result.guardian.userId,
      relationship,
      phone: result.guardian.phone || null,
      occupation: result.guardian.occupation || null,
      isPrimary: Boolean(primaryByUser[result.guardian.userId]),
    });
    onLinked(linked);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-white/10 bg-black/30 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-white">Link existing parent</p>
            <p className="mt-1 text-xs text-white/55">
              Search by name, email, or phone. Existing parent accounts are linked without sending another invite.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="border-white/15 bg-transparent text-white/70 hover:bg-white/10"
          >
            Back
          </Button>
        </div>
        <div className="relative mt-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search parent name, email, or phone"
            className="border-white/15 bg-white/5 pl-9 text-white placeholder:text-white/35"
          />
        </div>
      </div>

      {query.trim().length < 2 ? (
        <div className="rounded-xl border border-dashed border-white/15 bg-white/5 p-6 text-center text-sm text-white/55">
          Type at least two characters to search existing parents.
        </div>
      ) : search.isLoading ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-center text-sm text-white/55">
          Searching...
        </div>
      ) : search.isError ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
          {search.error instanceof Error ? search.error.message : "Search failed"}
        </div>
      ) : results.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/15 bg-white/5 p-6 text-center text-sm text-white/55">
          No existing parent matched this search. Use Add New Parent instead.
        </div>
      ) : (
        <div className="space-y-3">
          {results.map((result) => {
            const guardian = result.guardian;
            return (
              <div
                key={guardian.userId}
                className="rounded-xl border border-white/10 bg-black/30 p-4"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-white">{guardian.fullName}</p>
                      {result.alreadyLinked ? (
                        <Badge className="border border-amber-400/30 bg-amber-500/15 text-amber-100">
                          Already linked
                        </Badge>
                      ) : null}
                      {guardian.hasPlatformAccount ? (
                        <Badge className="border border-emerald-400/30 bg-emerald-500/15 text-emerald-100">
                          Has login
                        </Badge>
                      ) : (
                        <Badge className="border border-white/15 bg-white/5 text-white/65">
                          No login yet
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-white/60">
                      <span className="inline-flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5" />
                        {guardian.email}
                      </span>
                      {guardian.phone ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5" />
                          {guardian.phone}
                        </span>
                      ) : null}
                    </div>
                    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                      <div className="flex items-center gap-2 text-xs font-medium text-white/75">
                        <Users className="h-3.5 w-3.5 text-cyan-300" />
                        {siblingText(result)}
                      </div>
                      {result.siblingCandidates.length ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {result.siblingCandidates.map((candidate) => (
                            <Badge
                              key={candidate.studentId}
                              variant="outline"
                              className="border-white/15 text-white/65"
                            >
                              {candidate.studentName}
                              {candidate.classGroupName ? ` · ${candidate.classGroupName}` : ""}
                            </Badge>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="w-full space-y-2 lg:w-64">
                    <select
                      value={relationshipByUser[guardian.userId] || guardian.relationship || "guardian"}
                      onChange={(event) =>
                        setRelationshipByUser((prev) => ({
                          ...prev,
                          [guardian.userId]: event.target.value as GuardianRelationship,
                        }))
                      }
                      disabled={result.alreadyLinked || linkExisting.isPending}
                      className="h-10 w-full rounded-md border border-white/15 bg-slate-950 px-3 text-sm text-white"
                    >
                      {RELATIONSHIP_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <label className="flex cursor-pointer items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70">
                      <input
                        type="checkbox"
                        checked={Boolean(primaryByUser[guardian.userId])}
                        onChange={(event) =>
                          setPrimaryByUser((prev) => ({
                            ...prev,
                            [guardian.userId]: event.target.checked,
                          }))
                        }
                        disabled={result.alreadyLinked || linkExisting.isPending}
                      />
                      <Star className="h-3.5 w-3.5 text-amber-300" />
                      Set as primary
                    </label>
                    <Button
                      type="button"
                      onClick={() => void handleLink(result)}
                      disabled={result.alreadyLinked || linkExisting.isPending}
                      className="w-full gap-2 bg-primary text-black hover:opacity-90"
                    >
                      <UserPlus className="h-4 w-4" />
                      {result.alreadyLinked ? "Already linked" : "Link to student"}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
