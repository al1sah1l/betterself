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
