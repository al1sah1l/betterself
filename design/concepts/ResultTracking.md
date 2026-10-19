# ResultTracking

## Purpose

Record observed outcomes separately from actions performed and proof verification.

## Principle

A user records a dated observation about a goal, reads its result history, and can remove an incorrect observation. Recording results does not change commitments, completion claims, or peer reviews.

## Types

```types
external Goal
  The goal whose observed outcomes are recorded.
```

## State

```state
a set of Results with
  a goal Goal
  a description String
  an observedOn String
  a createdAt DateTime
```

## Actions

```actions
recordResult(goal: Goal, description: String, observedOn: String) : returns (result: Result)
  where description after trimming has 1 to 2000 characters and observedOn is a valid calendar date in YYYY-MM-DD format
  then
    add a new Result with goal, trimmed description, observedOn, and the current creation time
    returns result
  where description or observedOn is invalid
  then
    refuses INVALID_RESULT "Enter a valid date and a result of 1–2000 characters."

removeResult(goal: Goal, result: Result) : returns (result: Result)
  where result is in Results and its goal is goal
  then
    remove result from Results
    returns result
  where result is not in Results or its goal is not goal
  then
    refuses RESULT_NOT_FOUND "There is no such result for this goal."
```

## Queries

```queries
_resultsByGoal(goal: Goal) : many (result: Result, description: String, observedOn: String)
  Returns observations for this goal by observed date descending, then creation time descending, with result identity as a tie breaker.
```
