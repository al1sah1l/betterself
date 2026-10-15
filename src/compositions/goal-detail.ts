import {
  endpoint,
  receive,
  respond,
} from "@mit-sdg/sync-engine/boundary";

import {
  each,
  former,
  no,
  whether,
  where,
} from "@mit-sdg/sync-engine/language";

import { concepts } from "../concepts.ts";

const {
  Sessioning,
  GoalPlanning,
  CommitmentTracking,
  AccountabilityGrouping,
  ProofVerifying,
} = concepts;

export const GoalDetail = former(
  "the detail of (goal)",
  (
    { goal },
    {
      outcome,
      currentContext,
      constraints,
      timeline,
      successDefinition,
      currentStrategy,
      group,
      commitment,
      description,
      recurring,
      schedule,
      active,
      sourceStep,
      completion,
      occurrence,
      proof,
      evidence,
      reviewer,
      decision,
      note,
    },
  ) =>
    where(
      GoalPlanning._goal({ goal }).is({
        outcome,
        currentContext,
        constraints,
        timeline,
        successDefinition,
      }),
      whether(
        GoalPlanning._goal({ goal }).is({
          currentStrategy,
        }),
      ),
      whether(
        AccountabilityGrouping._groupForGoal({
          goal,
        }).is({
          group,
        }),
      ),
    ).form({
      goal,
      outcome,
      currentContext,
      constraints,
      timeline,
      successDefinition,
      currentStrategy,
      group,
      commitments: each(
        CommitmentTracking._commitmentsByGoal({
          goal,
        }).is({
          commitment,
          description,
          recurring,
          schedule,
          active,
        }),
      )
        .where(
          whether(
            CommitmentTracking._commitment({
              commitment,
            }).is({
              sourceStep,
            }),
          ),
        )
        .form({
          commitment,
          description,
          recurring,
          schedule,
          active,
          sourceStep,
          proofs: each(
            ProofVerifying._proofsByCommitment({
              commitment,
            }).is({
              proof,
              occurrence,
              evidence,
            }),
          ).form({
            proof,
            occurrence,
            evidence,
            verifications: each(
              ProofVerifying._verificationsByProof({
                proof,
              }).is({
                reviewer,
                decision,
                note,
              }),
            ).form({
              reviewer,
              decision,
              note,
            }),
          }),
          completions: each(
            CommitmentTracking._completionsByCommitment({
              commitment,
            }).is({
              completion,
              occurrence,
            }),
          ).form({
            completion,
            occurrence,
            proofs: each(
              ProofVerifying._proofForOccurrence({
                commitment,
                occurrence,
              }).is({
                proof,
              }),
            ).form({
              proof,
              verifications: each(
                ProofVerifying._verificationsByProof({
                  proof,
                }).is({
                  reviewer,
                  decision,
                  note,
                }),
              ).form({
                reviewer,
                decision,
                note,
              }),
            }),
          }),
        }),
    }),
);

export const GetGoalDetail = endpoint(
  "/dashboard/goal",

  ({ session, user, goal }) =>
    receive({
      session,
      goal,
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
          GoalPlanning._goal({ goal }).is({
            owner: user,
          }),
        )
          .then(
            respond({
              detail: GoalDetail({ goal }),
            }),
          )
          .named("authorized"),

        where(
          no(
            GoalPlanning._goal({ goal }),
          ),
        )
          .then(
            respond({
              error: "GOAL_NOT_FOUND",
            }),
          )
          .named("missingGoal"),

        where(
          GoalPlanning._goal({ goal }).is({}),
          no(
            GoalPlanning._goal({ goal }).is({
              owner: user,
            }),
          ),
        )
          .then(
            respond({
              error: "FORBIDDEN",
            }),
          )
          .named("forbidden"),
      ),

  {
    input: {
      required: ["session", "goal"],
    },
  },
);
