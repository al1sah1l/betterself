import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";

import spec from "@design/concepts/ProofVerifying.md" with { type: "text" };

import {
  ProofVerifyingConcept,
  ProofAlreadySubmitted,
  ProofNotFound,
  CannotReviewOwnProof,
  ProofAlreadyReviewed,
} from "./ProofVerifying.ts";

export const proofVerifying = registerConcept({
  class: ProofVerifyingConcept,
  spec,

  refusals: {
    PROOF_ALREADY_SUBMITTED: ProofAlreadySubmitted,
    PROOF_NOT_FOUND: ProofNotFound,
    CANNOT_REVIEW_OWN_PROOF: CannotReviewOwnProof,
    PROOF_ALREADY_REVIEWED: ProofAlreadyReviewed,
  },

  floors: {
    mongo: ({ db }: { db: Db }) =>
      new ProofVerifyingConcept<string, string, string, string>(db),
  },
});
