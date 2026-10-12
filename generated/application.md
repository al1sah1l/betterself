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

- `AccountabilityGrouping` — instance of `AccountabilityGrouping` — [BetterSelf Types and Instances](../design/types.md), line 30.
  - `Goal` is `GoalPlanning.Goal` — [BetterSelf Types and Instances](../design/types.md), line 32.
  - `Proof` is `ProofVerifying.Proof` — [BetterSelf Types and Instances](../design/types.md), line 33.
  - `User` is `Authenticating.Account` — [BetterSelf Types and Instances](../design/types.md), line 31.

### Authenticating

Defined in [Authenticating](../design/concepts/Authenticating.md), line 1.

#### Actions

- `register(username: String, password: String) : returns (account: Account)`
  - Refuses `INVALID_USERNAME`: A username must contain 3 to 32 letters, numbers, underscores, or hyphens.
  - Refuses `WEAK_PASSWORD`: A password must contain 8 to 128 characters.
  - Refuses `USERNAME_TAKEN`: That username is already registered.
- `authenticate(username: String, password: String) : returns (account: Account)`
  - Refuses `INVALID_CREDENTIALS`: The username or password is incorrect.

#### Queries

- `_registered(username: String) : one (registered: Flag)`

#### Instances

- `Authenticating` — instance of `Authenticating` — [BetterSelf Types and Instances](../design/types.md), line 13.

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

- `CommitmentTracking` — instance of `CommitmentTracking` — [BetterSelf Types and Instances](../design/types.md), line 21.
  - `Goal` is `GoalPlanning.Goal` — [BetterSelf Types and Instances](../design/types.md), line 22.

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

- `GoalPlanning` — instance of `GoalPlanning` — [BetterSelf Types and Instances](../design/types.md), line 18.
  - `User` is `Authenticating.Account` — [BetterSelf Types and Instances](../design/types.md), line 19.

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

- `ProofVerifying` — instance of `ProofVerifying` — [BetterSelf Types and Instances](../design/types.md), line 24.
  - `Commitment` is `CommitmentTracking.Commitment` — [BetterSelf Types and Instances](../design/types.md), line 27.
  - `Evidence` is `TextEvidence` — [BetterSelf Types and Instances](../design/types.md), line 28.
  - `Goal` is `GoalPlanning.Goal` — [BetterSelf Types and Instances](../design/types.md), line 26.
  - `User` is `Authenticating.Account` — [BetterSelf Types and Instances](../design/types.md), line 25.

### Sessioning

Defined in [Sessioning](../design/concepts/Sessioning.md), line 1.

#### Actions

- `start(subject: Subject) : returns (session: Session, expiresAt: DateTime)`
- `current(session: Session) : returns (subject: Subject)`
  - Refuses `UNKNOWN_SESSION`: This session is not active.
- `end(session: Session) : returns (ended: Flag)`
  - Refuses `UNKNOWN_SESSION`: This session is not active.

#### Queries

- `_active(session: Session) : optional (subject: Subject, expiresAt: DateTime)`

#### Instances

- `Sessioning` — instance of `Sessioning` — [BetterSelf Types and Instances](../design/types.md), line 15.
  - `Subject` is `Authenticating.Account` — [BetterSelf Types and Instances](../design/types.md), line 16.

## Application types

Concrete types:

- `TextEvidence` — [BetterSelf Types and Instances](../design/types.md), line 6.

## Reactions

### BetterSelf.authentication.CurrentUser

Authored path: `BetterSelf.authentication.CurrentUser`.
- Covered by [Authentication](../design/compositions/authentication.md), line 7.
- Covered by [Authentication](../design/compositions/authentication.md), line 16.

```reaction
when RequestBoundary.request (path: "/auth/current", requestId, session)
then
  Sessioning.current (session)
```

### BetterSelf.authentication.CurrentUser#2

Authored path: `BetterSelf.authentication.CurrentUser`.
- Covered by [Authentication](../design/compositions/authentication.md), line 7.
- Covered by [Authentication](../design/compositions/authentication.md), line 16.

```reaction
when Sessioning.current (session, subject: account), asked by BetterSelf.authentication.CurrentUser
where
  earlier, RequestBoundary.request (path: "/auth/current", requestId, session)
then
  RequestBoundary.respond (account, requestId)
```

### BetterSelf.authentication.Register

Authored path: `BetterSelf.authentication.Register`.
- Covered by [Authentication](../design/compositions/authentication.md), line 3.
- Covered by [Authentication](../design/compositions/authentication.md), line 14.

```reaction
when RequestBoundary.request (password, path: "/auth/register", requestId, username)
then
  Authenticating.register (password, username)
```

### BetterSelf.authentication.Register#2

Authored path: `BetterSelf.authentication.Register`.
- Covered by [Authentication](../design/compositions/authentication.md), line 3.
- Covered by [Authentication](../design/compositions/authentication.md), line 14.

```reaction
when Authenticating.register (password, username, account), asked by BetterSelf.authentication.Register
then
  Sessioning.start (subject: account)
```

### BetterSelf.authentication.Register#3

Authored path: `BetterSelf.authentication.Register`.
- Covered by [Authentication](../design/compositions/authentication.md), line 3.
- Covered by [Authentication](../design/compositions/authentication.md), line 14.

```reaction
when Sessioning.start (subject: account, expiresAt, session), asked by BetterSelf.authentication.Register#2
where
  earlier, RequestBoundary.request (password, path: "/auth/register", requestId, username)
then
  RequestBoundary.respond (account, expiresAt, requestId, session)
```

### BetterSelf.authentication.SignIn

Authored path: `BetterSelf.authentication.SignIn`.
- Covered by [Authentication](../design/compositions/authentication.md), line 5.
- Covered by [Authentication](../design/compositions/authentication.md), line 15.

```reaction
when RequestBoundary.request (password, path: "/auth/sign-in", requestId, username)
then
  Authenticating.authenticate (password, username)
```

### BetterSelf.authentication.SignIn#2

Authored path: `BetterSelf.authentication.SignIn`.
- Covered by [Authentication](../design/compositions/authentication.md), line 5.
- Covered by [Authentication](../design/compositions/authentication.md), line 15.

```reaction
when Authenticating.authenticate (password, username, account), asked by BetterSelf.authentication.SignIn
then
  Sessioning.start (subject: account)
```

### BetterSelf.authentication.SignIn#3

Authored path: `BetterSelf.authentication.SignIn`.
- Covered by [Authentication](../design/compositions/authentication.md), line 5.
- Covered by [Authentication](../design/compositions/authentication.md), line 15.

```reaction
when Sessioning.start (subject: account, expiresAt, session), asked by BetterSelf.authentication.SignIn#2
where
  earlier, RequestBoundary.request (password, path: "/auth/sign-in", requestId, username)
then
  RequestBoundary.respond (account, expiresAt, requestId, session)
```

### BetterSelf.authentication.SignOut

Authored path: `BetterSelf.authentication.SignOut`.
- Covered by [Authentication](../design/compositions/authentication.md), line 9.
- Covered by [Authentication](../design/compositions/authentication.md), line 17.

```reaction
when RequestBoundary.request (path: "/auth/sign-out", requestId, session)
then
  Sessioning.end (session)
```

### BetterSelf.authentication.SignOut#2

Authored path: `BetterSelf.authentication.SignOut`.
- Covered by [Authentication](../design/compositions/authentication.md), line 9.
- Covered by [Authentication](../design/compositions/authentication.md), line 17.

```reaction
when Sessioning.end (session, ended: signedOut), asked by BetterSelf.authentication.SignOut
where
  earlier, RequestBoundary.request (path: "/auth/sign-out", requestId, session)
then
  RequestBoundary.respond (requestId, signedOut)
```

### BetterSelf.completion.RecordCompletionFromProof

Authored path: `BetterSelf.completion.RecordCompletionFromProof`.
- Covered by [Commitment Completion](../design/compositions/completion.md), line 3.

```reaction
when ProofVerifying.submitProof (commitment, occurrence)
then
  CommitmentTracking.claimComplete (commitment, occurrence)
```

### BetterSelf.goals.CreateGoal

Authored path: `BetterSelf.goals.CreateGoal`.
- Covered by [Goal Management](../design/compositions/goals.md), line 3.
- Covered by [Goal Management](../design/compositions/goals.md), line 10.

```reaction
when RequestBoundary.request (constraints, currentContext, outcome, path: "/goals/create", requestId, session, successDefinition, timeline)
then
  Sessioning.current (session)
```

### BetterSelf.goals.CreateGoal#2

Authored path: `BetterSelf.goals.CreateGoal`.
- Covered by [Goal Management](../design/compositions/goals.md), line 3.
- Covered by [Goal Management](../design/compositions/goals.md), line 10.

```reaction
when Sessioning.current (session, subject: owner), asked by BetterSelf.goals.CreateGoal
where
  earlier, RequestBoundary.request (constraints, currentContext, outcome, path: "/goals/create", requestId, session, successDefinition, timeline)
then
  GoalPlanning.createGoal (constraints, currentContext, outcome, owner, successDefinition, timeline)
```

### BetterSelf.goals.CreateGoal#3

Authored path: `BetterSelf.goals.CreateGoal`.
- Covered by [Goal Management](../design/compositions/goals.md), line 3.
- Covered by [Goal Management](../design/compositions/goals.md), line 10.

```reaction
when GoalPlanning.createGoal (constraints, currentContext, outcome, owner, successDefinition, timeline, goal), asked by BetterSelf.goals.CreateGoal#2
where
  earlier, RequestBoundary.request (constraints, currentContext, outcome, path: "/goals/create", requestId, session, successDefinition, timeline)
then
  RequestBoundary.respond (goal, requestId)
```

### BetterSelf.proofSharing.ShareProofWithGroup

Authored path: `BetterSelf.proofSharing.ShareProofWithGroup`.
- Covered by [Proof Sharing](../design/compositions/proof-sharing.md), line 3.

```reaction
when ProofVerifying.submitProof (goal, proof)
where
  AccountabilityGrouping._groupForGoal (goal)
then
  AccountabilityGrouping.shareProof (goal, proof)
```

### BetterSelf.verification.ReviewProof

Authored path: `BetterSelf.verification.ReviewProof`.
- Covered by [Proof Verification Access](../design/compositions/verification.md), line 3.
- Covered by [Proof Verification Access](../design/compositions/verification.md), line 16.

```reaction
when RequestBoundary.request (decision, note, path: "/proofs/review", proof, requestId, session)
then
  Sessioning.current (session)
```

### BetterSelf.verification.ReviewProof:authorized#2

Authored path: `BetterSelf.verification.ReviewProof`.
- Covered by [Proof Verification Access](../design/compositions/verification.md), line 3.
- Covered by [Proof Verification Access](../design/compositions/verification.md), line 16.

```reaction
when Sessioning.current (session, subject: reviewer), asked by BetterSelf.verification.ReviewProof
where
  earlier, RequestBoundary.request (decision, note, path: "/proofs/review", proof, requestId, session)
  ProofVerifying._proof (proof) has (goal)
then
  AccountabilityGrouping.checkMember (goal, user: reviewer)
```

### BetterSelf.verification.ReviewProof:authorized#3

Authored path: `BetterSelf.verification.ReviewProof`.
- Covered by [Proof Verification Access](../design/compositions/verification.md), line 3.
- Covered by [Proof Verification Access](../design/compositions/verification.md), line 16.

```reaction
when AccountabilityGrouping.checkMember (goal, user: reviewer), asked by BetterSelf.verification.ReviewProof:authorized#2
where
  earlier, RequestBoundary.request (decision, note, path: "/proofs/review", proof, requestId, session)
then
  ProofVerifying.reviewProof (decision, note, proof, reviewer)
```

### BetterSelf.verification.ReviewProof:authorized#4

Authored path: `BetterSelf.verification.ReviewProof`.
- Covered by [Proof Verification Access](../design/compositions/verification.md), line 3.
- Covered by [Proof Verification Access](../design/compositions/verification.md), line 16.

```reaction
when ProofVerifying.reviewProof (decision, note, proof, reviewer), asked by BetterSelf.verification.ReviewProof:authorized#3
where
  earlier, RequestBoundary.request (decision, note, path: "/proofs/review", proof, requestId, session)
then
  RequestBoundary.respond (proof, requestId)
```

### BetterSelf.verification.ReviewProof:missing#2

Authored path: `BetterSelf.verification.ReviewProof`.
- Covered by [Proof Verification Access](../design/compositions/verification.md), line 3.
- Covered by [Proof Verification Access](../design/compositions/verification.md), line 16.

```reaction
when Sessioning.current (session, subject: reviewer), asked by BetterSelf.verification.ReviewProof
where
  earlier, RequestBoundary.request (decision, note, path: "/proofs/review", proof, requestId, session)
  no ProofVerifying._proof (proof)
then
  RequestBoundary.respond (error: "PROOF_NOT_FOUND", requestId)
```

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

## Endpoint input contracts

Before recording an action ask, the boundary rejects a body that is not an
object or lacks a required key. The response uses `INVALID_INPUT` and names
the path or missing key. A declared default fills an absent key. Endpoints
not listed here have no explicit input contract.

- `/auth/current` — requires `session`
- `/auth/register` — requires `username`, `password`
- `/auth/sign-in` — requires `username`, `password`
- `/auth/sign-out` — requires `session`
- `/goals/create` — requires `session`, `outcome`, `currentContext`, `constraints`, `timeline`, `successDefinition`
- `/proofs/review` — requires `session`, `proof`, `decision`, `note`
