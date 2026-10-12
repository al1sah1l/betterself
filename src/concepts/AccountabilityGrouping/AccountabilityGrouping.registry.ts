import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";

import spec from "@design/concepts/AccountabilityGrouping.md" with { type: "text" };

import {
  AccountabilityGroupingConcept,
  GroupNotFound,
  AlreadyMember,
  NotGroupMember,
  GoalAlreadyAttached,
  GoalNotAttached,
  ProofAlreadyShared,
} from "./AccountabilityGrouping.ts";

export const accountabilityGrouping = registerConcept({
  class: AccountabilityGroupingConcept,
  spec,

  refusals: {
    GROUP_NOT_FOUND: GroupNotFound,
    ALREADY_MEMBER: AlreadyMember,
    NOT_GROUP_MEMBER: NotGroupMember,
    GOAL_ALREADY_ATTACHED: GoalAlreadyAttached,
    GOAL_NOT_ATTACHED: GoalNotAttached,
    PROOF_ALREADY_SHARED: ProofAlreadyShared,
  },

  floors: {
    mongo: ({ db }: { db: Db }) =>
      new AccountabilityGroupingConcept<string, string, string>(db),
  },
});
