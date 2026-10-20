import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";

import spec from "@design/concepts/ProofVerifying.md" with { type: "text" };

import {
  ProofVerifyingConcept,
  ProofAlreadySubmitted,
  ProofNotFound,
  CannotReviewOwnProof,
  ProofAlreadyReviewed,
  EvidenceRequired,
  NotProofSubmitter,
  ProofHasReviews,
  NotProofAuthor,
  ProofNotDisputed,
  ProofSuperseded,
  ProofOneTimeAlreadyCompleted,
} from "./ProofVerifying.ts";

export const proofVerifying = registerConcept({
  class: ProofVerifyingConcept,
  spec,

  refusals: {
    PROOF_ALREADY_SUBMITTED: ProofAlreadySubmitted,
    PROOF_NOT_FOUND: ProofNotFound,
    CANNOT_REVIEW_OWN_PROOF: CannotReviewOwnProof,
    PROOF_ALREADY_REVIEWED: ProofAlreadyReviewed,
    EVIDENCE_REQUIRED: EvidenceRequired,
    NOT_PROOF_SUBMITTER: NotProofSubmitter,
    PROOF_HAS_REVIEWS: ProofHasReviews,
    NOT_PROOF_AUTHOR: NotProofAuthor,
    PROOF_NOT_DISPUTED: ProofNotDisputed,
    PROOF_SUPERSEDED: ProofSuperseded,
    ONE_TIME_ALREADY_COMPLETED: ProofOneTimeAlreadyCompleted,
  },

  floors: {
    mongo: ({ db }: { db: Db }) =>
      new ProofVerifyingConcept<
        string,
        string,
        string,
        string
      >(db),
  },
});
