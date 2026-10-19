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
} = concepts;

export const UpdateGoal = endpoint(
  "/goals/update",

  ({
    session,
    user,
    goal,
    outcome,
    currentContext,
    constraints,
    timeline,
    successDefinition,
  }) =>
    receive({
      session,
      goal,
      outcome,
      currentContext,
      constraints,
      timeline,
      successDefinition,
    })
      .then(
        Sessioning.current({ session }).responds({
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
            GoalPlanning.updateGoal({
              goal,
              outcome,
              currentContext,
              constraints,
              timeline,
              successDefinition,
            }).responds({}),
          )
          .then(respond({ goal }))
          .named("authorized"),

        where(
          no(GoalPlanning._goal({ goal })),
        )
          .then(
            respond({ error: "GOAL_NOT_FOUND" }),
          )
          .named("missing"),

        where(
          GoalPlanning._goal({ goal }).is({}),
          no(
            GoalPlanning._goal({ goal }).is({
              owner: user,
            }),
          ),
        )
          .then(
            respond({ error: "FORBIDDEN" }),
          )
          .named("forbidden"),
      ),

  {
    input: {
      required: [
        "session",
        "goal",
        "outcome",
        "currentContext",
        "constraints",
        "timeline",
        "successDefinition",
      ],
    },
  },
);

export const RetireCommitment = endpoint(
  "/commitments/retire",

  ({ session, user, goal, commitment }) =>
    receive({
      session,
      goal,
      commitment,
    })
      .then(
        Sessioning.current({ session }).responds({
          subject: user,
        }),
      )
      .then(
        where(
          GoalPlanning._goal({ goal }).is({
            owner: user,
          }),
          CommitmentTracking._commitment({
            commitment,
          }).is({ goal }),
        )
          .then(
            CommitmentTracking.retireCommitment({
              commitment,
            }).responds({}),
          )
          .then(respond({ commitment }))
          .named("authorized"),

        where(
          no(GoalPlanning._goal({ goal })),
        )
          .then(
            respond({ error: "GOAL_NOT_FOUND" }),
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
            respond({ error: "FORBIDDEN" }),
          )
          .named("forbidden"),

        where(
          GoalPlanning._goal({ goal }).is({
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
          GoalPlanning._goal({ goal }).is({
            owner: user,
          }),
          CommitmentTracking._commitment({
            commitment,
          }).is({}),
          no(
            CommitmentTracking._commitment({
              commitment,
            }).is({ goal }),
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
      ],
    },
  },
);
