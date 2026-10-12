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
} = concepts;

export const CreateGoal = endpoint(
  "/goals/create",
  ({
    session,
    owner,
    outcome,
    currentContext,
    constraints,
    timeline,
    successDefinition,
    goal,
  }) =>
    receive({
      session,
      outcome,
      currentContext,
      constraints,
      timeline,
      successDefinition,
    })
      .then(
        Sessioning.current({
          session,
        }).responds({
          subject: owner,
        }),
      )
      .then(
        GoalPlanning.createGoal({
          owner,
          outcome,
          currentContext,
          constraints,
          timeline,
          successDefinition,
        }).responds({
          goal,
        }),
      )
      .then(
        respond({
          goal,
        }),
      ),
  {
    input: {
      required: [
        "session",
        "outcome",
        "currentContext",
        "constraints",
        "timeline",
        "successDefinition",
      ],
    },
  },
);

export const SetStrategy = endpoint(
  "/goals/set-strategy",
  ({
    session,
    user,
    goal,
    strategy,
  }) =>
    receive({
      session,
      goal,
      strategy,
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
            GoalPlanning.setStrategy({
              goal,
              strategy,
            }).responds({}),
          )
          .then(
            respond({
              goal,
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
        "strategy",
      ],
    },
  },
);
