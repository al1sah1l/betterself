import {
  endpoint,
  receive,
  respond,
} from "@mit-sdg/sync-engine/boundary";

import {
  no,
  reaction,
  when,
  where,
} from "@mit-sdg/sync-engine/language";

import { concepts } from "../concepts.ts";

const {
  Sessioning,
  CommitmentTracking,
  ProofVerifying,
  AccountabilityGrouping,
} = concepts;

export const ResubmitProof = endpoint(
  "/proofs/resubmit",

  ({
    session,
    user,
    previousProof,
    evidence,
    goal,
    commitment,
    proof,
  }) =>
    receive({
      session,
      previousProof,
      evidence,
    })
      .then(
        Sessioning.current({
          session,
        }).responds({
          subject: user,
        }),
      )
      .then(
        where(
          ProofVerifying._proof({
            proof: previousProof,
          }).is({
            submitter: user,
            goal,
            commitment,
          }),
          CommitmentTracking._commitment({
            commitment,
          }).is({
            goal,
            active: true,
          }),
        )
          .then(
            ProofVerifying.resubmitProof({
              submitter: user,
              previousProof,
              evidence,
            }).responds({
              proof,
            }),
          )
          .then(
            respond({
              proof,
            }),
          )
          .named("authorized"),

        where(
          no(
            ProofVerifying._proof({
              proof: previousProof,
            }),
          ),
        )
          .then(
            respond({
              error: "PROOF_NOT_FOUND",
            }),
          )
          .named("missingProof"),

        where(
          ProofVerifying._proof({
            proof: previousProof,
          }).is({}),
          no(
            ProofVerifying._proof({
              proof: previousProof,
            }).is({
              submitter: user,
            }),
          ),
        )
          .then(
            respond({
              error: "FORBIDDEN",
            }),
          )
          .named("forbidden"),

        where(
          ProofVerifying._proof({
            proof: previousProof,
          }).is({
            submitter: user,
            goal,
            commitment,
          }),
          CommitmentTracking._commitment({
            commitment,
          }).is({
            goal,
            active: false,
          }),
        )
          .then(
            respond({
              error: "COMMITMENT_RETIRED",
            }),
          )
          .named("retired"),

        where(
          ProofVerifying._proof({
            proof: previousProof,
          }).is({
            submitter: user,
            goal,
            commitment,
          }),
          no(
            CommitmentTracking._commitment({
              commitment,
            }).is({
              goal,
            }),
          ),
        )
          .then(
            respond({
              error: "COMMITMENT_NOT_FOUND",
            }),
          )
          .named("missingCommitment"),
      ),

  {
    input: {
      required: ["session", "previousProof", "evidence"],
    },
  },
);

export const ShareResubmittedProof = reaction(
  ({ proof, goal }) =>
    when(
      ProofVerifying.resubmitProof({}).responds({
        proof,
      }),
    )
      .where(
        ProofVerifying._proof({
          proof,
        }).is({
          goal,
        }),
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
