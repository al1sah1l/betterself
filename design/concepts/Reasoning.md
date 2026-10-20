# Reasoning

## Purpose

Generate advisory strategies and progress reviews without changing the user's plan.

## Principle

Given goal context, the concept proposes an initial strategy. Given execution evidence, peer reviews, and observed results, it can analyze progress and propose a revised strategy. The user decides whether to accept, edit, or reject the proposal.

## Types

```types
opaque Strategy
  An ordered sequence of strategy steps. Each step has a description and a success criterion.

opaque ReviewInput
  A complete review context or a string reference resolved by an injected server context provider.

opaque ReviewContext
  Goal context, current strategy revision, commitments, completion claims, proofs, peer reviews, and observed results supplied together for review.
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
    generate a proposed strategy using the supplied goal context
    returns strategy
  where the generated strategy is empty or contains an invalid strategy step
  then
    refuses INVALID_STRATEGY_PROPOSAL "The reasoner did not produce a valid strategy."

reviewProgress(context: ReviewInput) : returns (analysis: String, strategy: Strategy, revision: String)
  where the resolved context contains a saved strategy and generation produces a valid proposal
  then
    resolve a string reference using the injected provider when necessary
    generate advisory analysis and a proposed strategy without changing the plan
    use the resolved context's strategy revision as revision
    returns analysis, strategy, revision
  where the resolved context has no saved strategy or the generated proposal is invalid
  then
    refuses INVALID_REVIEW "The review requires a saved strategy and a valid proposal."
  where context resolution or generation fails
  then
    refuses REVIEW_UNAVAILABLE "AI review is unavailable. Please try again."
```

## Queries

```queries
```
