# Strategy Proposal

An authenticated user can [request a proposed strategy for one of their goals](reaction:BetterSelf.strategyProposal.ProposeStrategy).

The authenticated account is derived from the session. The client supplies only the goal identifier.

Before generating a strategy, the endpoint checks that the goal exists and belongs to the authenticated user.

The goal's outcome, current context, constraints, timeline, and success definition are read from `GoalPlanning` and passed to `Reasoning`.

The generated strategy is returned to the client as a proposal only. It is not saved automatically. The user may accept or edit the proposal before saving it through the strategy-setting flow.

If the goal does not exist, the endpoint returns `GOAL_NOT_FOUND`.

If the goal belongs to another account, the endpoint returns `FORBIDDEN`.

```endpoints
BetterSelf.strategyProposal.ProposeStrategy at /strategies/propose
```