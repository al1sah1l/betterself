# BetterSelf Types and Instances

## Types

```types
concrete TextEvidence
  Text evidence submitted to support completion of a commitment.
```

## Instances

```instances
instantiate Authenticating

instantiate Sessioning with
  Subject is Authenticating.Account

instantiate GoalPlanning with
  User is Authenticating.Account

instantiate CommitmentTracking with
  Goal is GoalPlanning.Goal

instantiate ProofVerifying with
  User is Authenticating.Account
  Goal is GoalPlanning.Goal
  Commitment is CommitmentTracking.Commitment
  Evidence is TextEvidence

instantiate AccountabilityGrouping with
  User is Authenticating.Account
  Goal is GoalPlanning.Goal
  Proof is ProofVerifying.Proof

instantiate ResultTracking with
  Goal is GoalPlanning.Goal

instantiate Reasoning
```
