# Reasoning

## Purpose

Generate an advisory strategy proposal from structured context about a user's goal without changing the goal itself.

## Principle

Given a desired outcome, current context, constraints, timeline, and definition of success, the concept generates an ordered strategy proposal. The proposal is advisory: another part of the application decides whether the strategy is accepted, edited, rejected, or saved.

## Types

```types
opaque Strategy
  An ordered sequence of strategy steps. Each step has a description and a success criterion.
```

## State

```state
Rule: This concept stores no persistent state.
```

## Actions

```actions
proposeStrategy(outcome: String, currentContext: String, constraints: String, timeline: String, successDefinition: String) : returns (strategy: Strategy)
  where true
  then
    generate a proposed strategy using the supplied outcome, current context, constraints, timeline, and success definition
    returns strategy
  where the generated strategy is empty or contains an invalid strategy step
  then
    refuses INVALID_STRATEGY_PROPOSAL "The reasoner did not produce a valid strategy."
```

## Queries

```queries
```
