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
  AccountabilityGrouping,
} = concepts;

export const PublicGroups = former(
  "the public groups matching (search)",
  ({ search }, { group, name, topic }) =>
    each(
      AccountabilityGrouping._publicGroups({
        search,
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

export const GroupSettings = former(
  "the settings of (group)",
  ({ group }, { owner, name, topic, visibility }) =>
    where(
      AccountabilityGrouping._groupSettings({
        group,
      }).is({
        owner,
        name,
        topic,
        visibility,
      }),
    ).form({
      group,
      owner,
      name,
      topic,
      visibility,
    }),
);

export const SearchPublicGroups = endpoint(
  "/dashboard/public-groups",

  ({ session, user, search }) =>
    receive({
      session,
      search,
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
          groups: PublicGroups({ search }),
        }),
      ),

  {
    input: {
      required: ["session", "search"],
    },
  },
);

export const GetGroupSettings = endpoint(
  "/groups/settings",

  ({ session, user, group }) =>
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
        where(
          AccountabilityGrouping._group({
            group,
          }).is({}),
          AccountabilityGrouping._members({
            group,
          }).is({
            user,
          }),
        )
          .then(
            respond({
              settings: GroupSettings({ group }),
            }),
          )
          .named("authorized"),

        where(
          no(
            AccountabilityGrouping._group({
              group,
            }),
          ),
        )
          .then(
            respond({
              error: "GROUP_NOT_FOUND",
            }),
          )
          .named("missing"),

        where(
          AccountabilityGrouping._group({
            group,
          }).is({}),
          no(
            AccountabilityGrouping._members({
              group,
            }).is({
              user,
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
      required: ["session", "group"],
    },
  },
);

export const UpdateGroup = endpoint(
  "/groups/update",

  ({ session, owner, group, name, topic, visibility }) =>
    receive({
      session,
      group,
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
        AccountabilityGrouping.updateGroup({
          group,
          owner,
          name,
          topic,
          visibility,
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
        "name",
        "topic",
        "visibility",
      ],
    },
  },
);

export const DeleteGroup = endpoint(
  "/groups/delete",

  ({ session, owner, group }) =>
    receive({
      session,
      group,
    })
      .then(
        Sessioning.current({
          session,
        }).responds({
          subject: owner,
        }),
      )
      .then(
        AccountabilityGrouping.deleteGroup({
          group,
          owner,
        }).responds({}),
      )
      .then(
        respond({
          group,
        }),
      ),

  {
    input: {
      required: ["session", "group"],
    },
  },
);
