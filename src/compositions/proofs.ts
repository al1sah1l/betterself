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
            recurring: true,
            active: true,
          }),
        )
          .then(
            ProofVerifying.submitProof({
              submitter: user,
              goal,
              commitment,
              occurrence,
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
          .named("authorizedRecurring"),

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
            recurring: false,
            active: true,
          }),
          no(
            CommitmentTracking._completionsByCommitment({
              commitment,
            }),
          ),
        )
          .then(
            ProofVerifying.submitProof({
              submitter: user,
              goal,
              commitment,
              occurrence,
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
          .named("authorizedOneTime"),

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
            recurring: false,
            active: true,
          }),
          CommitmentTracking._completionsByCommitment({
            commitment,
          }).is({
            occurrence,
          }),
          no(
            ProofVerifying._proofForOccurrence({
              commitment,
              occurrence,
            }),
          ),
        )
          .then(
            ProofVerifying.submitProof({
              submitter: user,
              goal,
              commitment,
              occurrence,
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
          .named("replaceDeletedProof"),

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
            recurring: false,
            active: true,
          }),
          CommitmentTracking._completionsByCommitment({
            commitment,
          }).is({}),
          no(
            CommitmentTracking._completionsByCommitment({
              commitment,
            }).is({
              occurrence,
            }),
          ),
        )
          .then(
            respond({
              error: "ONE_TIME_ALREADY_COMPLETED",
            }),
          )
          .named("alreadyCompleted"),

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
            recurring: false,
            active: true,
          }),
          CommitmentTracking._completionsByCommitment({
            commitment,
          }).is({
            occurrence,
          }),
          ProofVerifying._proofForOccurrence({
            commitment,
            occurrence,
          }).is({}),
        )
          .then(
            respond({
              error: "PROOF_ALREADY_SUBMITTED",
            }),
          )
          .named("existingProof"),

        where(
          GoalPlanning._goal({ goal }).is({ owner: user }),
          CommitmentTracking._commitment({ commitment }).is({
            goal,
            active: false,
          }),
        )
          .then(
            respond({ error: "COMMITMENT_RETIRED" }),
          )
          .named("retiredCommitment"),

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
      required: ["session", "proof"],
    },
  },
);
