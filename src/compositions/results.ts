import {
  endpoint,
  receive,
  respond,
} from "@mit-sdg/sync-engine/boundary";

import {
  each,
  former,
  no,
  where,
} from "@mit-sdg/sync-engine/language";

import { concepts } from "../concepts.ts";

const {
  Sessioning,
  GoalPlanning,
  ResultTracking,
} = concepts;

export const GoalResults = former(
  "the observed results of (goal)",

  ({ goal }, { result, description, observedOn }) =>
    each(
      ResultTracking._resultsByGoal({ goal }).is({
        result,
        description,
        observedOn,
      }),
    ).form({
      result,
      description,
      observedOn,
    }),
);

export const RecordResult = endpoint(
  "/results/record",

  ({
    session,
    user,
    goal,
    description,
    observedOn,
    result,
  }) =>
    receive({
      session,
      goal,
      description,
      observedOn,
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
            ResultTracking.recordResult({
              goal,
              description,
              observedOn,
            }).responds({ result }),
          )
          .then(respond({ result }))
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
        "description",
        "observedOn",
      ],
    },
  },
);

export const ListGoalResults = endpoint(
  "/dashboard/results",

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
              results: GoalResults({ goal }),
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

export const RemoveResult = endpoint(
  "/results/remove",

  ({ session, user, goal, result }) =>
    receive({ session, goal, result })
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
            ResultTracking.removeResult({
              goal,
              result,
            }).responds({}),
          )
          .then(respond({ result }))
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
      required: ["session", "goal", "result"],
    },
  },
);
