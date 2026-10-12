# CommitmentTracking

## Purpose

Keep track of concrete actions a user commits to for a goal, while keeping planned actions separate from claims that those actions were actually completed.

## Principle

A commitment belongs to a goal and may represent either a one-time or recurring action. A user can claim a scheduled occurrence as completed while the commitment is active. A commitment can later be retired without deleting its earlier completion history.

## Types

```types
external Goal
  The goal this commitment supports.
```

## State

```state
a set of Commitments with
  a goal Goal
  a description String
  a recurring Flag
  a schedule String
  an active Flag
  a createdAt DateTime

a set of Completions with
  a commitment Commitment
  an occurrence DateTime
  unique commitment and occurrence
```

## Actions

```actions
createCommitment(goal: Goal, description: String, recurring: Flag, schedule: String) : returns (commitment: Commitment)
  where true
  then
    add a new Commitment with goal, description, recurring, schedule, active true, and the current creation time
    returns commitment

claimComplete(commitment: Commitment, occurrence: DateTime) : returns (completion: Completion)
  where commitment is in Commitments and commitment is active and commitment is recurring and no Completion has this commitment and occurrence
  then
    add a new Completion with commitment and occurrence
    returns completion

  where commitment is in Commitments and commitment is active and commitment is not recurring and no Completion has this commitment
  then
    add a new Completion with commitment and occurrence
    returns completion

  where commitment is not in Commitments
  then
    refuses COMMITMENT_NOT_FOUND "There is no such commitment."

  where commitment is in Commitments and commitment is not active
  then
    refuses COMMITMENT_RETIRED "This commitment is no longer active."

  where commitment is in Commitments and commitment is active and commitment is recurring and a Completion already has this commitment and occurrence
  then
    refuses COMPLETION_ALREADY_CLAIMED "This occurrence has already been completed."

  where commitment is in Commitments and commitment is active and commitment is not recurring and a Completion already has this commitment
  then
    refuses ONE_TIME_ALREADY_COMPLETED "This one-time commitment has already been completed."

retireCommitment(commitment: Commitment) : returns (commitment: Commitment)
  where commitment is in Commitments and commitment is active
  then
    set the commitment's active field to false
    returns commitment
  where commitment is not in Commitments
  then
    refuses COMMITMENT_NOT_FOUND "There is no such commitment."
  where commitment is in Commitments and commitment is not active
  then
    refuses COMMITMENT_ALREADY_RETIRED "This commitment is already retired."
```

## Queries

```queries
_commitment(commitment: Commitment) : optional (goal: Goal, description: String, recurring: Flag, schedule: String, active: Flag)
  Returns the commitment's current fields, or no row when the commitment does not exist.

_commitmentsByGoal(goal: Goal) : many (commitment: Commitment, description: String, recurring: Flag, schedule: String, active: Flag)
  Returns all commitments for this goal in creation order, or no rows when the goal has no commitments.

_completionsByCommitment(commitment: Commitment) : many (completion: Completion, occurrence: DateTime)
  Returns all completion claims for this commitment ordered by occurrence time, or no rows when the commitment has no completions.
```