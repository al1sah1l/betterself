import {
  endpoint,
  receive,
  respond,
} from "@mit-sdg/sync-engine/boundary";

import {
  each,
  former,
  no,
  view,
  where,
} from "@mit-sdg/sync-engine/language";

import { concepts } from "../concepts.ts";

const {
  Sessioning,
  AccountabilityGrouping,
  ProofVerifying,
} = concepts;

export const GroupMember = view(
  "(user) is a member of (group)",
  ({ user, group }, _outputs, _bindings) =>
    where(
      AccountabilityGrouping._members({
        group,
      }).is({ user }),
    ),
).holds();

export const GroupProofs = former(
  "the shared proofs in (group)",
  (
    { group },
    {
      proof,
      submitter,
      goal,
      commitment,
      occurrence,
      evidence,
      reviewer,
      decision,
      note,
    },
  ) =>
    each(
      AccountabilityGrouping._sharedProofs({
        group,
      }).is({ proof }),
    )
      .where(
        ProofVerifying._proof({ proof }).is({
          submitter,
          goal,
          commitment,
          occurrence,
          evidence,
        }),
      )
      .form({
        proof,
        submitter,
        goal,
        commitment,
        occurrence,
        evidence,
        verifications: each(
          ProofVerifying._verificationsByProof({
            proof,
          }).is({
            reviewer,
            decision,
            note,
          }),
        ).form({
          reviewer,
          decision,
          note,
        }),
      }),
);

export const ListGroupProofs = endpoint(
  "/dashboard/group-proofs",

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
          GroupMember({ user, group }).is({}),
        )
          .then(
            respond({
              proofs: GroupProofs({ group }),
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
          .named("missingGroup"),

        where(
          AccountabilityGrouping._group({
            group,
          }).is({}),
          no(
            GroupMember({ user, group }).is({}),
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
