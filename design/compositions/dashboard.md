# Dashboard

An authenticated user can [list their goals](reaction:BetterSelf.dashboard.ListMyGoals).

The authenticated account is derived from the session. The client supplies only the session identifier.

The response contains [the goals of the authenticated user](former:BetterSelf.dashboard.MyGoals), formed from `GoalPlanning._goalsByOwner`.

Each goal includes its identifier, outcome, current context, constraints, timeline, and success definition.

Only goals owned by the authenticated user are returned. A user with no goals receives an empty list.

```endpoints
BetterSelf.dashboard.ListMyGoals at /dashboard/goals
```

## My Groups

An authenticated user can [list their accountability groups](reaction:BetterSelf.dashboard.ListMyGroups).

The account is derived from the session. The client supplies only the session identifier.

The response contains [the groups the user belongs to](former:BetterSelf.dashboard.MyGroups), formed from `AccountabilityGrouping._groupsForUser`.

Each group includes its identifier, name, and topic. Groups where the user is not a member are excluded.

A user with no group memberships receives an empty list.

```endpoints
BetterSelf.dashboard.ListMyGroups at /dashboard/groups
```

## Shared Group Proofs

An authenticated user can [list the proofs shared in a group](reaction:BetterSelf.dashboard.ListGroupProofs).

The account is derived from the session. Access requires that [the user is a member of the group](view:BetterSelf.dashboard.GroupMember).

The response contains [the group's shared proofs](former:BetterSelf.dashboard.GroupProofs).

Each proof includes its identifier, submitter, goal, commitment, occurrence, evidence, and peer verifications. Each verification includes its reviewer, decision, and note.

Goal detail includes all proofs submitted for each commitment and their peer reviews, independently of whether a completion claim was recorded.

Proof evidence and peer verification remain separate fields. A proof with no verifications has an empty verification list.

Each completion claim includes its matching proof, if present, and that proof's peer reviews. Reviews include the reviewer, decision, and note.

Claims without matching proof remain visible with an empty proofs list.

A group with no shared proofs returns an empty proof list.

A missing group returns `GROUP_NOT_FOUND`. A user who is not a group member receives `FORBIDDEN`.

```endpoints
BetterSelf.dashboard.ListGroupProofs at /dashboard/group-proofs
```

