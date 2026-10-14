import { conceptSet } from "@mit-sdg/sync-engine/assembly";

import { authenticating } from "./concepts/Authenticating/Authenticating.registry.ts";
import { goalPlanning } from "./concepts/GoalPlanning/GoalPlanning.registry.ts";
import { commitmentTracking } from "./concepts/CommitmentTracking/CommitmentTracking.registry.ts";
import { proofVerifying } from "./concepts/ProofVerifying/ProofVerifying.registry.ts";
import { accountabilityGrouping } from "./concepts/AccountabilityGrouping/AccountabilityGrouping.registry.ts";
import { sessioning } from "./concepts/Sessioning/Sessioning.registry.ts";
import { reasoning } from "./concepts/Reasoning/Reasoning.registry.ts";

export const applicationConceptSet = conceptSet({
  Authenticating: authenticating,
  GoalPlanning: goalPlanning,
  CommitmentTracking: commitmentTracking,
  ProofVerifying: proofVerifying,
  AccountabilityGrouping: accountabilityGrouping,
  Sessioning: sessioning,
  Reasoning: reasoning,
});

export const { concepts } = applicationConceptSet;