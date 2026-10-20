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
import { GoalDetail } from "./goal-detail.ts";
import { GoalResults } from "./results.ts";
import { StrategyState } from "./strategy-state.ts";

const {
  Sessioning,
  GoalPlanning,
  Reasoning,
} = concepts;

export const ReviewContext = former(
  "the review context of (goal)",

  ({ goal }, _bindings) =>
    where(
      GoalPlanning._goal({ goal }).is({}),
    ).form({
      detail: GoalDetail({ goal }),
      results: GoalResults({ goal }),
      state: StrategyState({ goal }),
    }),
);

export const ReviewProgress = endpoint(
  "/reviews/propose",

  ({
    session,
    user,
    goal,
    analysis,
    strategy,
    revision,
  }) =>
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
            Reasoning.reviewProgress({
              context: goal,
            }).responds({
              analysis,
              strategy,
              revision,
            }),
          )
          .then(
            respond({
              analysis,
              strategy,
              revision,
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

export const ApplyReviewStrategy = endpoint(
  "/reviews/apply",

  ({
    session,
    user,
    goal,
    strategy,
    expectedRevision,
  }) =>
    receive({
      session,
      goal,
      strategy,
      expectedRevision,
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
            GoalPlanning.acceptStrategyRevision({
              goal,
              strategy,
              expectedRevision,
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
        "strategy",
        "expectedRevision",
      ],
    },
  },
);
