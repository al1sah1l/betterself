import {
  no,
  reaction,
  when,
} from "@mit-sdg/sync-engine/language";

import { concepts } from "../concepts.ts";

const {
  ProofVerifying,
  CommitmentTracking,
} = concepts;

export const RecordCompletionFromProof = reaction(
  ({ commitment, occurrence }) =>
    when(
      ProofVerifying.submitProof({
        commitment,
        occurrence,
      }).responds({}),
    )
      .where(
        no(
          CommitmentTracking._completionsByCommitment({
            commitment,
          }).is({
            occurrence,
          }),
        ),
      )
      .then(
        CommitmentTracking.claimComplete({
          commitment,
          occurrence,
        }),
      ),
);
