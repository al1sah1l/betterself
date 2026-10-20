import {
  endpoint,
  receive,
  respond,
} from "@mit-sdg/sync-engine/boundary";

import {
  former,
  no,
  where,
} from "@mit-sdg/sync-engine/language";

import { concepts } from "../concepts.ts";

const {
  GoalPlanning,
  Sessioning,
} = concepts;

export const StrategyState = former(
  "the strategy state of (goal)",

  ({ goal }, { strategy, revision }) =>
    where(
      GoalPlanning._strategySnapshot({ goal }).is({
        strategy,
        revision,
      }),
    ).form({
      strategy,
      revision,
    }),
);

export const GetStrategyState = endpoint(
  "/dashboard/strategy-state",

  ({ session, user, goal }) =>
    receive({ session, goal })
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
            respond({
              state: StrategyState({ goal }),
            }),
          )
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
      required: ["session", "goal"],
    },
  },
);
