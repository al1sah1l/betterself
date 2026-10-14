# Dashboard

An authenticated user can [list their goals](reaction:BetterSelf.dashboard.ListMyGoals).

The authenticated account is derived from the session. The client supplies only the session identifier.

The response contains [the goals of the authenticated user](former:BetterSelf.dashboard.MyGoals), formed from `GoalPlanning._goalsByOwner`.

Each goal includes its identifier, outcome, current context, constraints, timeline, and success definition.

Only goals owned by the authenticated user are returned. A user with no goals receives an empty list.

```endpoints
BetterSelf.dashboard.ListMyGoals at /dashboard/goals
```