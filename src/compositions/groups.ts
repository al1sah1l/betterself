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
  AccountabilityGrouping,
} = concepts;

export const CreateGroup = endpoint(
  "/groups/create",

  ({ session, owner, name, topic, visibility, group }) =>
    receive({
      session,
      name,
      topic,
      visibility,
    })
      .then(
        Sessioning.current({
          session,
        }).responds({
          subject: owner,
        }),
      )
      .then(
        AccountabilityGrouping.createGroup({
          owner,
          name,
          topic,
          visibility,
        }).responds({
          group,
        }),
      )
      .then(
        respond({
          group,
        }),
      ),

  {
    input: {
      required: ["session", "name", "topic"],
      defaults: {
        visibility: "private",
      },
    },
  },
);

export const JoinGroup = endpoint(
  "/groups/join",
  ({
    session,
    user,
    group,
  }) =>
    receive({
      session,
      group,
    })
      .then(
        Sessioning.current({
          session,
        }).responds({
          subject: user,
        }),
      )
      .then(
        AccountabilityGrouping.joinGroup({
          group,
          user,
        }).responds({}),
      )
      .then(
        respond({
          group,
        }),
      ),
  {
    input: {
      required: [
        "session",
        "group",
      ],
    },
  },
);

export const AttachGoal = endpoint(
  "/groups/attach-goal",
  ({
    session,
    user,
    group,
    goal,
  }) =>
    receive({
      session,
      group,
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
          }),
        )
          .then(
            AccountabilityGrouping.attachGoal({
              group,
              user,
              goal,
            }).responds({}),
          )
          .then(
            respond({
              group,
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
          .named("forbiddenGoal"),
      ),
  {
    input: {
      required: [
        "session",
        "group",
        "goal",
      ],
    },
  },
);
