# Commitment Management

An authenticated user can [create a commitment for a goal they own](reaction:BetterSelf.commitments.CreateCommitment).

The endpoint receives a session, goal, description, recurrence setting, and schedule.

It resolves the session to the authenticated account and checks that the goal belongs to that account before creating the commitment.

If the goal does not exist, the endpoint returns `GOAL_NOT_FOUND`. If the goal belongs to another account, it returns `FORBIDDEN`.

```endpoints
BetterSelf.commitments.CreateCommitment at /commitments/create
```