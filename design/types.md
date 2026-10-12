# BetterSelf Types and Instances

## Types

```types
concrete Person
  A stable identity for a BetterSelf user.

concrete TextEvidence
  Text evidence submitted to support completion of a commitment.
```

## Instances

```instances
instantiate GoalPlanning with
  User is Person

instantiate CommitmentTracking with
  Goal is GoalPlanning.Goal

instantiate ProofVerifying with
  User is Person
  Goal is GoalPlanning.Goal
  Commitment is CommitmentTracking.Commitment
  Evidence is TextEvidence

instantiate AccountabilityGrouping with
  User is Person
  Goal is GoalPlanning.Goal
  Proof is ProofVerifying.Proof

instantiate Sessioning with
  Subject is Person
```