import {
  endpoint,
  receive,
  respond,
} from "@mit-sdg/sync-engine/boundary";

import {
  each,
  former,
} from "@mit-sdg/sync-engine/language";

import { concepts } from "../concepts.ts";

const {
  Sessioning,
  GoalPlanning,
} = concepts;

export const MyGoals = former(
  "the goals of (user)",
  (
    { user },
    {
      goal,
      outcome,
      currentContext,
      constraints,
      timeline,
      successDefinition,
    },
  ) =>
    each(
      GoalPlanning._goalsByOwner({
        owner: user,
      }).is({
        goal,
        outcome,
        currentContext,
        constraints,
        timeline,
        successDefinition,
      }),
    ).form({
      goal,
      outcome,
      currentContext,
      constraints,
      timeline,
      successDefinition,
    }),
);

export const ListMyGoals = endpoint(
  "/dashboard/goals",

  ({
    session,
    user,
  }) =>
    receive({
      session,
    })
      .then(
        Sessioning.current({
          session,
        }).responds({
          subject: user,
        }),
      )
      .then(
        respond({
          goals: MyGoals({
            user,
          }),
        }),
      ),

  {
    input: {
      required: ["session"],
    },
  },
);
