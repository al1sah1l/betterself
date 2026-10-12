import {
  endpoint,
  receive,
  respond,
} from "@mit-sdg/sync-engine/boundary";

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
