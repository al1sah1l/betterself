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
  Reasoning,
} = concepts;

export const ProposeStrategy = endpoint(
  "/strategies/propose",

  ({
    session,
    user,
    goal,
    outcome,
    currentContext,
    constraints,
    timeline,
    successDefinition,
    strategy,
  }) =>
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
          GoalPlanning._goal({
            goal,
          }).is({
            owner: user,
            outcome,
            currentContext,
            constraints,
            timeline,
            successDefinition,
          }),
        )
          .then(
            Reasoning.proposeStrategy({
              outcome,
              currentContext,
              constraints,
              timeline,
              successDefinition,
            }).responds({
              strategy,
            }),
          )
          .then(
            respond({
              strategy,
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
          .named("forbidden"),
      ),

  {
    input: {
      required: [
        "session",
        "goal",
      ],
    },
  },
);
