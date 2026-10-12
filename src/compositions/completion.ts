import { reaction, when } from "@mit-sdg/sync-engine/language";
import { concepts } from "../concepts.ts";

const { ProofVerifying, CommitmentTracking } = concepts;

export const RecordCompletionFromProof = reaction(
  ({ commitment, occurrence }) =>
    when(
      ProofVerifying.submitProof({
        commitment,
        occurrence,
      }).responds({}),
    ).then(
      CommitmentTracking.claimComplete({
        commitment,
        occurrence,
      }),
    ),
);
