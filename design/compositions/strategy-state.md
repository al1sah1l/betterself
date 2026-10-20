# Strategy State

An owner can [read their current strategy state](reaction:BetterSelf.strategyState.GetStrategyState).

The [strategy state former](former:BetterSelf.strategyState.StrategyState) returns the saved strategy and revision identity from a single goal record.

Missing goals return GOAL_NOT_FOUND, while another owner's goal returns FORBIDDEN. Identity comes from the session.

The initial revision uses existing step:index commitment links.

Each revised strategy receives a fresh identity; its steps use strategy:revision:step:index links.

An old commitment remains visible but does not count as a commitment for a new revision.

Only active commitments hide a step's creation button.

Revising a strategy does not automatically retire old commitments.

```endpoints
BetterSelf.strategyState.GetStrategyState at /dashboard/strategy-state
```
