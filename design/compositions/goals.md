# Goal Management

An authenticated user can [create a goal owned by their account](reaction:BetterSelf.goals.CreateGoal).

The create-goal endpoint receives a session together with the goal information. It resolves the session to the authenticated account and uses that account as the goal owner.

The owner is not accepted directly from the client, so a user cannot create a goal on behalf of another account.

An authenticated user can [set the initial strategy for a goal they own](reaction:BetterSelf.goals.SetStrategy).

The set-strategy endpoint resolves the session to the authenticated account and checks the goal's owner before changing its strategy.

If the goal does not exist, the endpoint returns `GOAL_NOT_FOUND`. If the goal exists but belongs to another account, it returns `FORBIDDEN`.

```endpoints
BetterSelf.goals.CreateGoal at /goals/create
BetterSelf.goals.SetStrategy at /goals/set-strategy
```

## Goal Detail

An authenticated user can [open one of their goals](reaction:BetterSelf.dashboard.GetGoalDetail).

The endpoint derives the account from the session and checks goal ownership before returning [the goal detail](former:BetterSelf.dashboard.GoalDetail).

The detail includes the goal identifier, outcome, current context, constraints, timeline, success definition, saved strategy, and commitments.

If no strategy has been saved, `currentStrategy` is `null`. If there are no commitments, `commitments` is an empty list.

Each commitment includes its identifier, description, recurring flag, schedule, and active flag.

A missing goal returns `GOAL_NOT_FOUND`. A goal owned by another account returns `FORBIDDEN`.

```endpoints
BetterSelf.dashboard.GetGoalDetail at /dashboard/goal
```
