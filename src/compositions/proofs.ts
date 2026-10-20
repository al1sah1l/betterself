import {
  endpoint,
  receive,
  respond,
} from "@mit-sdg/sync-engine/boundary";

import {
  no,
  where,
} from "@mit-sdg/sync-engine/language";

import { concepts } from "../concepts.ts";

const {
  Sessioning,
  GoalPlanning,
  CommitmentTracking,
  ProofVerifying,
} = concepts;

export const SubmitProof = endpoint(
  "/proofs/submit",

  ({
    session,
    user,
    goal,
    commitment,
    occurrence,
    evidence,
    recurring,
    proof,
  }) =>
    receive({
      session,
      goal,
      commitment,
      occurrence,
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
          GoalPlanning._goal({
            goal,
          }).is({
            owner: user,
          }),

          CommitmentTracking._commitment({
            commitment,
          }).is({
            goal,
          }),
        )
          .then(
            CommitmentTracking.checkProofSubmission({
              commitment,
              occurrence,
            }).responds({
              recurring,
            }),
          )
          .then(
            ProofVerifying.submitProof({
              submitter: user,
              goal,
              commitment,
              occurrence,
              evidence,
              recurring,
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
            GoalPlanning._goal({
              goal,
            }),
          ),
        )
          .then(
            respond({
              error: "GOAL_NOT_FOUND",
            }),
          )
          .named("missingGoal"),

        where(
          GoalPlanning._goal({
            goal,
          }).is({}),

          no(
            GoalPlanning._goal({
              goal,
            }).is({
              owner: user,
            }),
          ),
        )
          .then(
            respond({
              error: "FORBIDDEN",
            }),
          )
          .named("forbiddenGoal"),

        where(
          GoalPlanning._goal({
            goal,
          }).is({
            owner: user,
          }),

          no(
            CommitmentTracking._commitment({
              commitment,
            }),
          ),
        )
          .then(
            respond({
              error: "COMMITMENT_NOT_FOUND",
            }),
          )
          .named("missingCommitment"),

        where(
          GoalPlanning._goal({
            goal,
          }).is({
            owner: user,
          }),

          CommitmentTracking._commitment({
            commitment,
          }).is({}),

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
              error: "COMMITMENT_GOAL_MISMATCH",
            }),
          )
          .named("wrongGoal"),
      ),

  {
    input: {
      required: [
        "session",
        "goal",
        "commitment",
        "occurrence",
        "evidence",
      ],
    },
  },
);

export const DeletePendingProof = endpoint(
  "/proofs/delete",

  ({ session, submitter, proof }) =>
    receive({
      session,
      proof,
    })
      .then(
        Sessioning.current({
          session,
        }).responds({
          subject: submitter,
        }),
      )
      .then(
        ProofVerifying.deletePendingProof({
          submitter,
          proof,
        }).responds({}),
      )
      .then(
        respond({
          proof,
        }),
      ),

  {
    input: {
      required: [
        "session",
        "proof",
      ],
    },
  },
);
