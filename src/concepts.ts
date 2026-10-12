import { conceptSet } from "@mit-sdg/sync-engine/assembly";

import { goalPlanning } from "./concepts/GoalPlanning/GoalPlanning.registry.ts";
import { commitmentTracking } from "./concepts/CommitmentTracking/CommitmentTracking.registry.ts";
import { proofVerifying } from "./concepts/ProofVerifying/ProofVerifying.registry.ts";
import { accountabilityGrouping } from "./concepts/AccountabilityGrouping/AccountabilityGrouping.registry.ts";

export const applicationConceptSet = conceptSet({
  GoalPlanning: goalPlanning,
  CommitmentTracking: commitmentTracking,
  ProofVerifying: proofVerifying,
  AccountabilityGrouping: accountabilityGrouping,
});

export const { concepts } = applicationConceptSet;
