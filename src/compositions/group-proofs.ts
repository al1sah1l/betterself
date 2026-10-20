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
  whether,
  where,
} from "@mit-sdg/sync-engine/language";

import { concepts } from "../concepts.ts";

const {
  Sessioning,
  AccountabilityGrouping,
  ProofVerifying,
  GoalPlanning,
  CommitmentTracking,
} = concepts;

export const GroupMember = view(
  "(user) is a member of (group)",
  ({ user, group }, _outputs, _bindings) =>
    where(
      AccountabilityGrouping._members({
        group,
      }).is({
        user,
      }),
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
      outcome,
      successDefinition,
      description,
      recurring,
      schedule,
      sourceStep,
      strategy,
      revision,
      attempt,
      current,
    },
  ) =>
    each(
      AccountabilityGrouping._sharedProofs({
        group,
      }).is({
        proof,
      }),
    )
      .where(
        ProofVerifying._proof({
          proof,
        }).is({
          submitter,
          goal,
          commitment,
          occurrence,
          evidence,
        }),

        ProofVerifying._proofAttempt({
          proof,
        }).is({
          attempt,
          current,
        }),

        whether(
          GoalPlanning._goal({
            goal,
          }).is({
            outcome,
            successDefinition,
          }),
        ),

        whether(
          CommitmentTracking._commitment({
            commitment,
          }).is({
            goal,
            description,
            recurring,
            schedule,
          }),
        ),

        whether(
          CommitmentTracking._commitment({
            commitment,
          }).is({
            goal,
            sourceStep,
          }),
        ),

        whether(
          GoalPlanning._strategySnapshot({
            goal,
          }).is({
            strategy,
            revision,
          }),
        ),
      )
      .form({
        proof,
        submitter,
        goal,
        commitment,
        occurrence,
        evidence,
        outcome,
        successDefinition,
        description,
        recurring,
        schedule,
        sourceStep,
        strategy,
        strategyRevision: revision,
        attempt,
        current,

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

          GroupMember({
            user,
            group,
          }).is({}),
        )
          .then(
            respond({
              proofs: GroupProofs({
                group,
              }),
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
            GroupMember({
              user,
              group,
            }).is({}),
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
