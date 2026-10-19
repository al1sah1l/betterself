# Observed Results

Authenticated goal owners can record, list, and remove dated observations about their goals.

Each endpoint derives the user from the session and checks ownership using GoalPlanning. A missing goal returns GOAL_NOT_FOUND; another owner's goal returns FORBIDDEN.

Results cannot be removed through a different goal.

Dates are calendar-date strings, not completion timestamps. These observations do not create completion claims or change proof verification.

[Record an observation](reaction:BetterSelf.results.RecordResult).

[Read observations](reaction:BetterSelf.results.ListGoalResults).

[Remove an observation](reaction:BetterSelf.results.RemoveResult).

The [goal results former](former:BetterSelf.results.GoalResults) returns each observation's identity, description, and observed date for the selected goal.

```endpoints
BetterSelf.results.RecordResult at /results/record
BetterSelf.results.ListGoalResults at /dashboard/results
BetterSelf.results.RemoveResult at /results/remove
```
