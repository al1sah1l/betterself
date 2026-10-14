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
  AccountabilityGrouping,
} = concepts;

export const MyGroups = former(
  "the groups of (user)",
  ({ user }, { group, name, topic }) =>
    each(
      AccountabilityGrouping._groupsForUser({
        user,
      }).is({
        group,
        name,
        topic,
      }),
    ).form({
      group,
      name,
      topic,
    }),
);

export const ListMyGroups = endpoint(
  "/dashboard/groups",

  ({ session, user }) =>
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
          groups: MyGroups({ user }),
        }),
      ),

  {
    input: {
      required: ["session"],
    },
  },
);
