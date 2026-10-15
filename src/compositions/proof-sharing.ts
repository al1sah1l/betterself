import { reaction, when } from "@mit-sdg/sync-engine/language";
import { concepts } from "../concepts.ts";

const { ProofVerifying, AccountabilityGrouping } = concepts;

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