import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";

import spec from "@design/concepts/CommitmentTracking.md" with { type: "text" };

import {
  CommitmentTrackingConcept,
  CommitmentNotFound,
  CommitmentRetired,
  CompletionAlreadyClaimed,
  CommitmentAlreadyRetired,
  OneTimeAlreadyCompleted,
} from "./CommitmentTracking.ts";

export const commitmentTracking = registerConcept({
  class: CommitmentTrackingConcept,
  spec,

  refusals: {
    COMMITMENT_NOT_FOUND: CommitmentNotFound,
    COMMITMENT_RETIRED: CommitmentRetired,
    COMPLETION_ALREADY_CLAIMED: CompletionAlreadyClaimed,
    COMMITMENT_ALREADY_RETIRED: CommitmentAlreadyRetired,
    ONE_TIME_ALREADY_COMPLETED: OneTimeAlreadyCompleted,
  },

  floors: {
    mongo: ({ db }: { db: Db }) => new CommitmentTrackingConcept<string>(db),
  },
});
