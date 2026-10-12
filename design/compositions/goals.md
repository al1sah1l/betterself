# Goal Management

An authenticated user can [create a goal owned by their account](reaction:BetterSelf.goals.CreateGoal).

The endpoint receives a session together with the goal information. It resolves the session to the authenticated account and uses that account as the goal owner.

The owner is not accepted directly from the client, so a user cannot create a goal on behalf of another account.

```endpoints
BetterSelf.goals.CreateGoal at /goals/create
```
