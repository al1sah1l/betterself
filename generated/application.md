<!-- Generated from the Application assembly. Do not edit. -->
<!-- Manifest producer: @mit-sdg/sync-engine@1.1.0; concept specification: sync-engine.concept-specification@1; renderer: @mit-sdg/sync-engine@1.1.0. -->

# Application — assembled read-back

_Assembled by sync-engine from registered concepts and composition. Edit the concept_
_specifications and composition source, then regenerate this file._

## Concepts

### AccountabilityGrouping

Defined in [AccountabilityGrouping](../design/concepts/AccountabilityGrouping.md), line 1.

#### Actions

- `createGroup(owner: User, name: String, topic: String) : returns (group: Group)`
- `joinGroup(group: Group, user: User) : returns (group: Group)`
  - Refuses `GROUP_NOT_FOUND`: There is no such group.
  - Refuses `ALREADY_MEMBER`: This user is already a member of this group.
- `attachGoal(group: Group, user: User, goal: Goal) : returns (group: Group)`
  - Refuses `GROUP_NOT_FOUND`: There is no such group.
  - Refuses `NOT_GROUP_MEMBER`: This user is not a member of this group.
  - Refuses `GOAL_ALREADY_ATTACHED`: This goal is already attached to an accountability group.
- `shareProof(goal: Goal, proof: Proof) : returns (group: Group)`
  - Refuses `GOAL_NOT_ATTACHED`: This goal is not attached to an accountability group.
  - Refuses `PROOF_ALREADY_SHARED`: This proof has already been shared with this group.
- `checkMember(goal: Goal, user: User) : returns (group: Group)`
  - Refuses `GOAL_NOT_ATTACHED`: This goal is not attached to an accountability group.
  - Refuses `NOT_GROUP_MEMBER`: This user is not a member of this group.

#### Queries

- `_group(group: Group) : optional (name: String, topic: String)`
- `_groupsForUser(user: User) : many (group: Group, name: String, topic: String)`
- `_members(group: Group) : many (user: User)`
- `_groupForGoal(goal: Goal) : optional (group: Group)`
- `_sharedProofs(group: Group) : many (proof: Proof)`

#### Instances

- `AccountabilityGrouping` — instance of `AccountabilityGrouping` — [BetterSelf Types and Instances](../design/types.md), line 28.
  - `Goal` is `GoalPlanning.Goal` — [BetterSelf Types and Instances](../design/types.md), line 30.
  - `Proof` is `ProofVerifying.Proof` — [BetterSelf Types and Instances](../design/types.md), line 31.
  - `User` is `Person` — [BetterSelf Types and Instances](../design/types.md), line 29.

### CommitmentTracking

Defined in [CommitmentTracking](../design/concepts/CommitmentTracking.md), line 1.

#### Actions

- `createCommitment(goal: Goal, description: String, recurring: Flag, schedule: String) : returns (commitment: Commitment)`
- `claimComplete(commitment: Commitment, occurrence: DateTime) : returns (completion: Completion)`
  - Refuses `COMMITMENT_NOT_FOUND`: There is no such commitment.
  - Refuses `COMMITMENT_RETIRED`: This commitment is no longer active.
  - Refuses `COMPLETION_ALREADY_CLAIMED`: This occurrence has already been completed.
  - Refuses `ONE_TIME_ALREADY_COMPLETED`: This one-time commitment has already been completed.
- `retireCommitment(commitment: Commitment) : returns (commitment: Commitment)`
  - Refuses `COMMITMENT_NOT_FOUND`: There is no such commitment.
  - Refuses `COMMITMENT_ALREADY_RETIRED`: This commitment is already retired.

#### Queries

- `_commitment(commitment: Commitment) : optional (goal: Goal, description: String, recurring: Flag, schedule: String, active: Flag)`
- `_commitmentsByGoal(goal: Goal) : many (commitment: Commitment, description: String, recurring: Flag, schedule: String, active: Flag)`
- `_completionsByCommitment(commitment: Commitment) : many (completion: Completion, occurrence: DateTime)`

#### Instances

- `CommitmentTracking` — instance of `CommitmentTracking` — [BetterSelf Types and Instances](../design/types.md), line 19.
  - `Goal` is `GoalPlanning.Goal` — [BetterSelf Types and Instances](../design/types.md), line 20.

### GoalPlanning

Defined in [GoalPlanning](../design/concepts/GoalPlanning.md), line 1.

#### Actions

- `createGoal(owner: User, outcome: String, currentContext: String, constraints: String, timeline: String, successDefinition: String) : returns (goal: Goal)`
- `setStrategy(goal: Goal, strategy: Strategy) : returns (goal: Goal)`
  - Refuses `GOAL_NOT_FOUND`: There is no such goal.
  - Refuses `STRATEGY_ALREADY_SET`: This goal already has a strategy.
- `reviseStrategy(goal: Goal, strategy: Strategy) : returns (goal: Goal)`
  - Refuses `GOAL_NOT_FOUND`: There is no such goal.
  - Refuses `STRATEGY_NOT_SET`: This goal does not have a strategy yet.
- `updateGoal(goal: Goal, outcome: String, currentContext: String, constraints: String, timeline: String, successDefinition: String) : returns (goal: Goal)`
  - Refuses `GOAL_NOT_FOUND`: There is no such goal.
- `deleteGoal(goal: Goal) : returns (goal: Goal)`
  - Refuses `GOAL_NOT_FOUND`: There is no such goal.

#### Queries

- `_goal(goal: Goal) : optional (owner: User, outcome: String, currentContext: String, constraints: String, timeline: String, successDefinition: String, currentStrategy?: Strategy)`
- `_goalsByOwner(owner: User) : many (goal: Goal, outcome: String, currentContext: String, constraints: String, timeline: String, successDefinition: String, currentStrategy?: Strategy)`

#### Instances

- `GoalPlanning` — instance of `GoalPlanning` — [BetterSelf Types and Instances](../design/types.md), line 16.
  - `User` is `Person` — [BetterSelf Types and Instances](../design/types.md), line 17.

### ProofVerifying

Defined in [ProofVerifying](../design/concepts/ProofVerifying.md), line 1.

#### Actions

- `submitProof(submitter: User, goal: Goal, commitment: Commitment, occurrence: DateTime, evidence: EvidenceBundle) : returns (proof: Proof)`
  - Refuses `EVIDENCE_REQUIRED`: At least one piece of evidence is required.
  - Refuses `PROOF_ALREADY_SUBMITTED`: Proof has already been submitted for this occurrence.
- `reviewProof(reviewer: User, proof: Proof, decision: VerificationDecision, note: String) : returns (proof: Proof)`
  - Refuses `PROOF_NOT_FOUND`: There is no such proof.
  - Refuses `CANNOT_REVIEW_OWN_PROOF`: A user cannot review their own proof.
  - Refuses `PROOF_ALREADY_REVIEWED`: This user has already reviewed this proof.

#### Queries

- `_proof(proof: Proof) : optional (submitter: User, goal: Goal, commitment: Commitment, occurrence: DateTime, evidence: EvidenceBundle)`
- `_proofForOccurrence(commitment: Commitment, occurrence: DateTime) : optional (proof: Proof, submitter: User, goal: Goal, evidence: EvidenceBundle)`
- `_verificationsByProof(proof: Proof) : many (reviewer: User, decision: VerificationDecision, note: String)`

#### Instances

- `ProofVerifying` — instance of `ProofVerifying` — [BetterSelf Types and Instances](../design/types.md), line 22.
  - `Commitment` is `CommitmentTracking.Commitment` — [BetterSelf Types and Instances](../design/types.md), line 25.
  - `Evidence` is `TextEvidence` — [BetterSelf Types and Instances](../design/types.md), line 26.
  - `Goal` is `GoalPlanning.Goal` — [BetterSelf Types and Instances](../design/types.md), line 24.
  - `User` is `Person` — [BetterSelf Types and Instances](../design/types.md), line 23.

## Application types

Concrete types:

- `Person` — [BetterSelf Types and Instances](../design/types.md), line 6.
- `TextEvidence` — [BetterSelf Types and Instances](../design/types.md), line 9.

## Reactions

### DeliverFaultToAsker

```reaction
when any action is faulted, not asked by DeliverFaultToAsker
where
  earlier, RequestBoundary.request (requestId)
then
  RequestBoundary.respondFramework (error: "INTERNAL_ERROR", requestId)
```

### DeliverRefusalToAsker

```reaction
when any action is refused (message), except RequestBoundary
where
  earlier, RequestBoundary.request (requestId)
then
  RequestBoundary.respond (error: message, requestId)
```

