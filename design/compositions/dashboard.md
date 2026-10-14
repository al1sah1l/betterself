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