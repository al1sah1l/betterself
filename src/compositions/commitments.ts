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

export const CreateCommitment = endpoint(
  "/commitments/create",
  ({
    session,
    user,
    goal,
    description,
    recurring,
    schedule,
    commitment,
  }) =>
    receive({
      session,
      goal,
      description,
      recurring,
      schedule,
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
        )
          .then(
            CommitmentTracking.createCommitment({
              goal,
              description,
              recurring,
              schedule,
            }).responds({
              commitment,
            }),
          )
          .then(
            respond({
              commitment,
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
          .named("missing"),

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
          .named("forbidden"),
      ),
  {
    input: {
      required: [
        "session",
        "goal",
        "description",
        "recurring",
        "schedule",
      ],
    },
  },
);
