import {
  no,
  reaction,
  when,
} from "@mit-sdg/sync-engine/language";

import { concepts } from "../concepts.ts";

const {
  ProofVerifying,
  AccountabilityGrouping,
  CommitmentTracking,
} = concepts;

export const ShareProofWithGroup = reaction(
  ({ goal, proof }) =>
    when(
      ProofVerifying.submitProof({
        goal,
      }).responds({
        proof,
      }),
    )
      .where(
        AccountabilityGrouping._groupForGoal({
          goal,
        }).is({}),
      )
      .then(
        AccountabilityGrouping.shareProof({
          goal,
          proof,
        }),
      ),
);

export const ShareExistingProofsOnAttach = reaction(
  ({ goal, group, commitment, proof }) =>
    when(
      AccountabilityGrouping.attachGoal({
        goal,
      }).responds({
        group,
      }),
    )
      .where(
        CommitmentTracking._commitmentsByGoal({
          goal,
        }).is({
          commitment,
        }),

        ProofVerifying._proofsByCommitment({
          commitment,
        }).is({
          proof,
          goal,
        }),

        no(
          AccountabilityGrouping._sharedProofs({
            group,
          }).is({
            proof,
          }),
        ),
      )
      .then(
        AccountabilityGrouping.shareProof({
          goal,
          proof,
        }),
      ),
);

export const UnshareDeletedProof = reaction(
  ({ proof }) =>
    when(
      ProofVerifying.deletePendingProof({}).responds({
        proof,
      }),
    ).then(
      AccountabilityGrouping.unshareProof({
        proof,
      }),
    ),
);
