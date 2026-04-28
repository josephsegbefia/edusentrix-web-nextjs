import type mongoose from "mongoose";

/** Maps delegation-aware auth to Activity metadata (DELEGATIONS_FEATURE_SPEC §18). */
export function delegationAuditFields(input: {
  /** True when the actor is acting only via an active delegation (not school admin / finance staff path). */
  isDelegatedActor: boolean;
  activeDelegationId: mongoose.Types.ObjectId | null;
  module: string;
  action: string;
}) {
  return {
    actorRole: input.isDelegatedActor ? ("delegate" as const) : ("admin" as const),
    actorDelegationId: input.isDelegatedActor ? input.activeDelegationId : null,
    delegationModule: input.module,
    delegationAction: input.action,
  };
}
