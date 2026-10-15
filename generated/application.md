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

- `createCommitment(goal: Goal, description: String, recurring: Flag, schedule: String, sourceStep?: String) : returns (commitment: Commitment)`
- `claimComplete(commitment: Commitment, occurrence: DateTime) : returns (completion: Completion)`
  - Refuses `COMMITMENT_NOT_FOUND`: There is no such commitment.
  - Refuses `COMMITMENT_RETIRED`: This commitment is no longer active.
  - Refuses `COMPLETION_ALREADY_CLAIMED`: This occurrence has already been completed.
  - Refuses `ONE_TIME_ALREADY_COMPLETED`: This one-time commitment has already been completed.
- `retireCommitment(commitment: Commitment) : returns (commitment: Commitment)`
  - Refuses `COMMITMENT_NOT_FOUND`: There is no such commitment.
  - Refuses `COMMITMENT_ALREADY_RETIRED`: This commitment is already retired.

#### Queries

- `_commitment(commitment: Commitment) : optional (goal: Goal, description: String, recurring: Flag, schedule: String, active: Flag, sourceStep?: String)`
- `_commitmentsByGoal(goal: Goal) : many (commitment: Commitment, description: String, recurring: Flag, schedule: String, active: Flag, sourceStep?: String)`
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

### Reasoning

Defined in [Reasoning](../design/concepts/Reasoning.md), line 1.

#### Actions

- `proposeStrategy(outcome: String, currentContext: String, constraints: String, timeline: String, successDefinition: String) : returns (strategy: Strategy)`
  - Refuses `INVALID_STRATEGY_PROPOSAL`: The reasoner did not produce a valid strategy.

#### Instances

- `Reasoning` — instance of `Reasoning` — [BetterSelf Types and Instances](../design/types.md), line 35.

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

## Views

_Views name reusable conditions. Multiple `where` blocks are alternatives._

### (user) is a member of (group)

Authored path: `BetterSelf.dashboard.GroupMember`.
- Covered by [Dashboard](../design/compositions/dashboard.md), line 37.

```view
(user) is a member of (group) — inputs (user, group); outputs (); bindings ()
  where AccountabilityGrouping._members (group) has (user)
```

## Formers

_Formers name result shapes evaluated when asked. The source former owns_
_the authored explanation; this section records the generated shape._

### the detail of (goal)

Authored path: `BetterSelf.dashboard.GoalDetail`.
- Covered by [Goal Management](../design/compositions/goals.md), line 24.

```former
Former "the detail of (goal)" — inputs (goal); bindings (outcome, currentContext, constraints, timeline, successDefinition, currentStrategy, group, commitment, description, recurring, schedule, active, sourceStep, completion, occurrence); promises exactly one record — forms:
  a record of
    where GoalPlanning._goal (goal) has (constraints, currentContext, outcome, successDefinition, timeline)
    where whether GoalPlanning._goal (goal) has (currentStrategy)
    where whether AccountabilityGrouping._groupForGoal (goal) has (group)
    commitments: each CommitmentTracking._commitmentsByGoal (goal) has (active, commitment, description, recurring, schedule)
      where whether CommitmentTracking._commitment (commitment) has (sourceStep)
      form a record of
        active
        commitment
        completions: each CommitmentTracking._completionsByCommitment (commitment) has (completion, occurrence)
          form a record of
            completion
            occurrence
        description
        recurring
        schedule
        sourceStep
    constraints
    currentContext
    currentStrategy
    goal
    group
    outcome
    successDefinition
    timeline
```

### the goals of (user)

Authored path: `BetterSelf.dashboard.MyGoals`.
- Covered by [Dashboard](../design/compositions/dashboard.md), line 7.

```former
Former "the goals of (user)" — inputs (user); bindings (goal, outcome, currentContext, constraints, timeline, successDefinition); promises exactly one record — forms:
  each GoalPlanning._goalsByOwner (owner: user) has (constraints, currentContext, goal, outcome, successDefinition, timeline)
    form a record of
      constraints
      currentContext
      goal
      outcome
      successDefinition
      timeline
```

### the groups of (user)

Authored path: `BetterSelf.dashboard.MyGroups`.
- Covered by [Dashboard](../design/compositions/dashboard.md), line 23.

```former
Former "the groups of (user)" — inputs (user); bindings (group, name, topic); promises exactly one record — forms:
  each AccountabilityGrouping._groupsForUser (user) has (group, name, topic)
    form a record of
      group
      name
      topic
```

### the shared proofs in (group)

Authored path: `BetterSelf.dashboard.GroupProofs`.
- Covered by [Dashboard](../design/compositions/dashboard.md), line 39.

```former
Former "the shared proofs in (group)" — inputs (group); bindings (proof, submitter, goal, commitment, occurrence, evidence, reviewer, decision, note); promises exactly one record — forms:
  each AccountabilityGrouping._sharedProofs (group) has (proof)
    where ProofVerifying._proof (proof) has (commitment, evidence, goal, occurrence, submitter)
    form a record of
      commitment
      evidence
      goal
      occurrence
      proof
      submitter
      verifications: each ProofVerifying._verificationsByProof (proof) has (decision, note, reviewer)
        form a record of
          decision
          note
          reviewer
```

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

### BetterSelf.commitments.CreateCommitment

Authored path: `BetterSelf.commitments.CreateCommitment`.
- Covered by [Commitment Management](../design/compositions/commitments.md), line 3.
- Covered by [Commitment Management](../design/compositions/commitments.md), line 14.

```reaction
when RequestBoundary.request (description, goal, path: "/commitments/create", recurring, requestId, schedule, session, sourceStep)
then
  Sessioning.current (session)
```

### BetterSelf.commitments.CreateCommitment:authorized#2

Authored path: `BetterSelf.commitments.CreateCommitment`.
- Covered by [Commitment Management](../design/compositions/commitments.md), line 3.
- Covered by [Commitment Management](../design/compositions/commitments.md), line 14.

```reaction
when Sessioning.current (session, subject: user), asked by BetterSelf.commitments.CreateCommitment
where
  earlier, RequestBoundary.request (description, goal, path: "/commitments/create", recurring, requestId, schedule, session, sourceStep)
  GoalPlanning._goal (goal) has (owner: user)
then
  CommitmentTracking.createCommitment (description, goal, recurring, schedule, sourceStep)
```

### BetterSelf.commitments.CreateCommitment:authorized#3

Authored path: `BetterSelf.commitments.CreateCommitment`.
- Covered by [Commitment Management](../design/compositions/commitments.md), line 3.
- Covered by [Commitment Management](../design/compositions/commitments.md), line 14.

```reaction
when CommitmentTracking.createCommitment (description, goal, recurring, schedule, sourceStep, commitment), asked by BetterSelf.commitments.CreateCommitment:authorized#2
where
  earlier, RequestBoundary.request (description, goal, path: "/commitments/create", recurring, requestId, schedule, session, sourceStep)
then
  RequestBoundary.respond (commitment, requestId)
```

### BetterSelf.commitments.CreateCommitment:forbidden#2

Authored path: `BetterSelf.commitments.CreateCommitment`.
- Covered by [Commitment Management](../design/compositions/commitments.md), line 3.
- Covered by [Commitment Management](../design/compositions/commitments.md), line 14.

```reaction
when Sessioning.current (session, subject: user), asked by BetterSelf.commitments.CreateCommitment
where
  earlier, RequestBoundary.request (description, goal, path: "/commitments/create", recurring, requestId, schedule, session, sourceStep)
  GoalPlanning._goal (goal)
  no GoalPlanning._goal (goal) has (owner: user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### BetterSelf.commitments.CreateCommitment:missing#2

Authored path: `BetterSelf.commitments.CreateCommitment`.
- Covered by [Commitment Management](../design/compositions/commitments.md), line 3.
- Covered by [Commitment Management](../design/compositions/commitments.md), line 14.

```reaction
when Sessioning.current (session, subject: user), asked by BetterSelf.commitments.CreateCommitment
where
  earlier, RequestBoundary.request (description, goal, path: "/commitments/create", recurring, requestId, schedule, session, sourceStep)
  no GoalPlanning._goal (goal)
then
  RequestBoundary.respond (error: "GOAL_NOT_FOUND", requestId)
```

### BetterSelf.completion.RecordCompletionFromProof

Authored path: `BetterSelf.completion.RecordCompletionFromProof`.
- Covered by [Commitment Completion](../design/compositions/completion.md), line 3.

```reaction
when ProofVerifying.submitProof (commitment, occurrence)
then
  CommitmentTracking.claimComplete (commitment, occurrence)
```

### BetterSelf.dashboard.GetGoalDetail

Authored path: `BetterSelf.dashboard.GetGoalDetail`.
- Covered by [Goal Management](../design/compositions/goals.md), line 22.
- Covered by [Goal Management](../design/compositions/goals.md), line 35.

```reaction
when RequestBoundary.request (goal, path: "/dashboard/goal", requestId, session)
then
  Sessioning.current (session)
```

### BetterSelf.dashboard.GetGoalDetail:authorized#2

Authored path: `BetterSelf.dashboard.GetGoalDetail`.
- Covered by [Goal Management](../design/compositions/goals.md), line 22.
- Covered by [Goal Management](../design/compositions/goals.md), line 35.

```reaction
when Sessioning.current (session, subject: user), asked by BetterSelf.dashboard.GetGoalDetail
where
  earlier, RequestBoundary.request (goal, path: "/dashboard/goal", requestId, session)
  GoalPlanning._goal (goal) has (owner: user)
then
  RequestBoundary.respond (detail: former "the detail of (goal)" with (goal), requestId)
```

### BetterSelf.dashboard.GetGoalDetail:forbidden#2

Authored path: `BetterSelf.dashboard.GetGoalDetail`.
- Covered by [Goal Management](../design/compositions/goals.md), line 22.
- Covered by [Goal Management](../design/compositions/goals.md), line 35.

```reaction
when Sessioning.current (session, subject: user), asked by BetterSelf.dashboard.GetGoalDetail
where
  earlier, RequestBoundary.request (goal, path: "/dashboard/goal", requestId, session)
  GoalPlanning._goal (goal)
  no GoalPlanning._goal (goal) has (owner: user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### BetterSelf.dashboard.GetGoalDetail:missingGoal#2

Authored path: `BetterSelf.dashboard.GetGoalDetail`.
- Covered by [Goal Management](../design/compositions/goals.md), line 22.
- Covered by [Goal Management](../design/compositions/goals.md), line 35.

```reaction
when Sessioning.current (session, subject: user), asked by BetterSelf.dashboard.GetGoalDetail
where
  earlier, RequestBoundary.request (goal, path: "/dashboard/goal", requestId, session)
  no GoalPlanning._goal (goal)
then
  RequestBoundary.respond (error: "GOAL_NOT_FOUND", requestId)
```

### BetterSelf.dashboard.ListGroupProofs

Authored path: `BetterSelf.dashboard.ListGroupProofs`.
- Covered by [Dashboard](../design/compositions/dashboard.md), line 35.
- Covered by [Dashboard](../design/compositions/dashboard.md), line 52.

```reaction
when RequestBoundary.request (group, path: "/dashboard/group-proofs", requestId, session)
then
  Sessioning.current (session)
```

### BetterSelf.dashboard.ListGroupProofs:authorized#2

Authored path: `BetterSelf.dashboard.ListGroupProofs`.
- Covered by [Dashboard](../design/compositions/dashboard.md), line 35.
- Covered by [Dashboard](../design/compositions/dashboard.md), line 52.

```reaction
when Sessioning.current (session, subject: user), asked by BetterSelf.dashboard.ListGroupProofs
where
  earlier, RequestBoundary.request (group, path: "/dashboard/group-proofs", requestId, session)
  AccountabilityGrouping._group (group)
  view "(user) is a member of (group)" with (group, user)
then
  RequestBoundary.respond (proofs: former "the shared proofs in (group)" with (group), requestId)
```

### BetterSelf.dashboard.ListGroupProofs:forbidden#2

Authored path: `BetterSelf.dashboard.ListGroupProofs`.
- Covered by [Dashboard](../design/compositions/dashboard.md), line 35.
- Covered by [Dashboard](../design/compositions/dashboard.md), line 52.

```reaction
when Sessioning.current (session, subject: user), asked by BetterSelf.dashboard.ListGroupProofs
where
  earlier, RequestBoundary.request (group, path: "/dashboard/group-proofs", requestId, session)
  AccountabilityGrouping._group (group)
  no view "(user) is a member of (group)" with (group, user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### BetterSelf.dashboard.ListGroupProofs:missingGroup#2

Authored path: `BetterSelf.dashboard.ListGroupProofs`.
- Covered by [Dashboard](../design/compositions/dashboard.md), line 35.
- Covered by [Dashboard](../design/compositions/dashboard.md), line 52.

```reaction
when Sessioning.current (session, subject: user), asked by BetterSelf.dashboard.ListGroupProofs
where
  earlier, RequestBoundary.request (group, path: "/dashboard/group-proofs", requestId, session)
  no AccountabilityGrouping._group (group)
then
  RequestBoundary.respond (error: "GROUP_NOT_FOUND", requestId)
```

### BetterSelf.dashboard.ListMyGoals

Authored path: `BetterSelf.dashboard.ListMyGoals`.
- Covered by [Dashboard](../design/compositions/dashboard.md), line 3.
- Covered by [Dashboard](../design/compositions/dashboard.md), line 14.

```reaction
when RequestBoundary.request (path: "/dashboard/goals", requestId, session)
then
  Sessioning.current (session)
```

### BetterSelf.dashboard.ListMyGoals#2

Authored path: `BetterSelf.dashboard.ListMyGoals`.
- Covered by [Dashboard](../design/compositions/dashboard.md), line 3.
- Covered by [Dashboard](../design/compositions/dashboard.md), line 14.

```reaction
when Sessioning.current (session, subject: user), asked by BetterSelf.dashboard.ListMyGoals
where
  earlier, RequestBoundary.request (path: "/dashboard/goals", requestId, session)
then
  RequestBoundary.respond (goals: former "the goals of (user)" with (user), requestId)
```

### BetterSelf.dashboard.ListMyGroups

Authored path: `BetterSelf.dashboard.ListMyGroups`.
- Covered by [Dashboard](../design/compositions/dashboard.md), line 19.
- Covered by [Dashboard](../design/compositions/dashboard.md), line 30.

```reaction
when RequestBoundary.request (path: "/dashboard/groups", requestId, session)
then
  Sessioning.current (session)
```

### BetterSelf.dashboard.ListMyGroups#2

Authored path: `BetterSelf.dashboard.ListMyGroups`.
- Covered by [Dashboard](../design/compositions/dashboard.md), line 19.
- Covered by [Dashboard](../design/compositions/dashboard.md), line 30.

```reaction
when Sessioning.current (session, subject: user), asked by BetterSelf.dashboard.ListMyGroups
where
  earlier, RequestBoundary.request (path: "/dashboard/groups", requestId, session)
then
  RequestBoundary.respond (groups: former "the groups of (user)" with (user), requestId)
```

### BetterSelf.goals.CreateGoal

Authored path: `BetterSelf.goals.CreateGoal`.
- Covered by [Goal Management](../design/compositions/goals.md), line 3.
- Covered by [Goal Management](../design/compositions/goals.md), line 16.

```reaction
when RequestBoundary.request (constraints, currentContext, outcome, path: "/goals/create", requestId, session, successDefinition, timeline)
then
  Sessioning.current (session)
```

### BetterSelf.goals.CreateGoal#2

Authored path: `BetterSelf.goals.CreateGoal`.
- Covered by [Goal Management](../design/compositions/goals.md), line 3.
- Covered by [Goal Management](../design/compositions/goals.md), line 16.

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
- Covered by [Goal Management](../design/compositions/goals.md), line 16.

```reaction
when GoalPlanning.createGoal (constraints, currentContext, outcome, owner, successDefinition, timeline, goal), asked by BetterSelf.goals.CreateGoal#2
where
  earlier, RequestBoundary.request (constraints, currentContext, outcome, path: "/goals/create", requestId, session, successDefinition, timeline)
then
  RequestBoundary.respond (goal, requestId)
```

### BetterSelf.goals.SetStrategy

Authored path: `BetterSelf.goals.SetStrategy`.
- Covered by [Goal Management](../design/compositions/goals.md), line 9.
- Covered by [Goal Management](../design/compositions/goals.md), line 17.

```reaction
when RequestBoundary.request (goal, path: "/goals/set-strategy", requestId, session, strategy)
then
  Sessioning.current (session)
```

### BetterSelf.goals.SetStrategy:authorized#2

Authored path: `BetterSelf.goals.SetStrategy`.
- Covered by [Goal Management](../design/compositions/goals.md), line 9.
- Covered by [Goal Management](../design/compositions/goals.md), line 17.

```reaction
when Sessioning.current (session, subject: user), asked by BetterSelf.goals.SetStrategy
where
  earlier, RequestBoundary.request (goal, path: "/goals/set-strategy", requestId, session, strategy)
  GoalPlanning._goal (goal) has (owner: user)
then
  GoalPlanning.setStrategy (goal, strategy)
```

### BetterSelf.goals.SetStrategy:authorized#3

Authored path: `BetterSelf.goals.SetStrategy`.
- Covered by [Goal Management](../design/compositions/goals.md), line 9.
- Covered by [Goal Management](../design/compositions/goals.md), line 17.

```reaction
when GoalPlanning.setStrategy (goal, strategy), asked by BetterSelf.goals.SetStrategy:authorized#2
where
  earlier, RequestBoundary.request (goal, path: "/goals/set-strategy", requestId, session, strategy)
then
  RequestBoundary.respond (goal, requestId)
```

### BetterSelf.goals.SetStrategy:forbidden#2

Authored path: `BetterSelf.goals.SetStrategy`.
- Covered by [Goal Management](../design/compositions/goals.md), line 9.
- Covered by [Goal Management](../design/compositions/goals.md), line 17.

```reaction
when Sessioning.current (session, subject: user), asked by BetterSelf.goals.SetStrategy
where
  earlier, RequestBoundary.request (goal, path: "/goals/set-strategy", requestId, session, strategy)
  GoalPlanning._goal (goal)
  no GoalPlanning._goal (goal) has (owner: user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### BetterSelf.goals.SetStrategy:missing#2

Authored path: `BetterSelf.goals.SetStrategy`.
- Covered by [Goal Management](../design/compositions/goals.md), line 9.
- Covered by [Goal Management](../design/compositions/goals.md), line 17.

```reaction
when Sessioning.current (session, subject: user), asked by BetterSelf.goals.SetStrategy
where
  earlier, RequestBoundary.request (goal, path: "/goals/set-strategy", requestId, session, strategy)
  no GoalPlanning._goal (goal)
then
  RequestBoundary.respond (error: "GOAL_NOT_FOUND", requestId)
```

### BetterSelf.groups.AttachGoal

Authored path: `BetterSelf.groups.AttachGoal`.
- Covered by [Accountability Groups](../design/compositions/groups.md), line 11.
- Covered by [Accountability Groups](../design/compositions/groups.md), line 20.

```reaction
when RequestBoundary.request (goal, group, path: "/groups/attach-goal", requestId, session)
then
  Sessioning.current (session)
```

### BetterSelf.groups.AttachGoal:authorized#2

Authored path: `BetterSelf.groups.AttachGoal`.
- Covered by [Accountability Groups](../design/compositions/groups.md), line 11.
- Covered by [Accountability Groups](../design/compositions/groups.md), line 20.

```reaction
when Sessioning.current (session, subject: user), asked by BetterSelf.groups.AttachGoal
where
  earlier, RequestBoundary.request (goal, group, path: "/groups/attach-goal", requestId, session)
  GoalPlanning._goal (goal) has (owner: user)
then
  AccountabilityGrouping.attachGoal (goal, group, user)
```

### BetterSelf.groups.AttachGoal:authorized#3

Authored path: `BetterSelf.groups.AttachGoal`.
- Covered by [Accountability Groups](../design/compositions/groups.md), line 11.
- Covered by [Accountability Groups](../design/compositions/groups.md), line 20.

```reaction
when AccountabilityGrouping.attachGoal (goal, group, user), asked by BetterSelf.groups.AttachGoal:authorized#2
where
  earlier, RequestBoundary.request (goal, group, path: "/groups/attach-goal", requestId, session)
then
  RequestBoundary.respond (group, requestId)
```

### BetterSelf.groups.AttachGoal:forbiddenGoal#2

Authored path: `BetterSelf.groups.AttachGoal`.
- Covered by [Accountability Groups](../design/compositions/groups.md), line 11.
- Covered by [Accountability Groups](../design/compositions/groups.md), line 20.

```reaction
when Sessioning.current (session, subject: user), asked by BetterSelf.groups.AttachGoal
where
  earlier, RequestBoundary.request (goal, group, path: "/groups/attach-goal", requestId, session)
  GoalPlanning._goal (goal)
  no GoalPlanning._goal (goal) has (owner: user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### BetterSelf.groups.AttachGoal:missingGoal#2

Authored path: `BetterSelf.groups.AttachGoal`.
- Covered by [Accountability Groups](../design/compositions/groups.md), line 11.
- Covered by [Accountability Groups](../design/compositions/groups.md), line 20.

```reaction
when Sessioning.current (session, subject: user), asked by BetterSelf.groups.AttachGoal
where
  earlier, RequestBoundary.request (goal, group, path: "/groups/attach-goal", requestId, session)
  no GoalPlanning._goal (goal)
then
  RequestBoundary.respond (error: "GOAL_NOT_FOUND", requestId)
```

### BetterSelf.groups.CreateGroup

Authored path: `BetterSelf.groups.CreateGroup`.
- Covered by [Accountability Groups](../design/compositions/groups.md), line 3.
- Covered by [Accountability Groups](../design/compositions/groups.md), line 18.

```reaction
when RequestBoundary.request (name, path: "/groups/create", requestId, session, topic)
then
  Sessioning.current (session)
```

### BetterSelf.groups.CreateGroup#2

Authored path: `BetterSelf.groups.CreateGroup`.
- Covered by [Accountability Groups](../design/compositions/groups.md), line 3.
- Covered by [Accountability Groups](../design/compositions/groups.md), line 18.

```reaction
when Sessioning.current (session, subject: owner), asked by BetterSelf.groups.CreateGroup
where
  earlier, RequestBoundary.request (name, path: "/groups/create", requestId, session, topic)
then
  AccountabilityGrouping.createGroup (name, owner, topic)
```

### BetterSelf.groups.CreateGroup#3

Authored path: `BetterSelf.groups.CreateGroup`.
- Covered by [Accountability Groups](../design/compositions/groups.md), line 3.
- Covered by [Accountability Groups](../design/compositions/groups.md), line 18.

```reaction
when AccountabilityGrouping.createGroup (name, owner, topic, group), asked by BetterSelf.groups.CreateGroup#2
where
  earlier, RequestBoundary.request (name, path: "/groups/create", requestId, session, topic)
then
  RequestBoundary.respond (group, requestId)
```

### BetterSelf.groups.JoinGroup

Authored path: `BetterSelf.groups.JoinGroup`.
- Covered by [Accountability Groups](../design/compositions/groups.md), line 7.
- Covered by [Accountability Groups](../design/compositions/groups.md), line 19.

```reaction
when RequestBoundary.request (group, path: "/groups/join", requestId, session)
then
  Sessioning.current (session)
```

### BetterSelf.groups.JoinGroup#2

Authored path: `BetterSelf.groups.JoinGroup`.
- Covered by [Accountability Groups](../design/compositions/groups.md), line 7.
- Covered by [Accountability Groups](../design/compositions/groups.md), line 19.

```reaction
when Sessioning.current (session, subject: user), asked by BetterSelf.groups.JoinGroup
where
  earlier, RequestBoundary.request (group, path: "/groups/join", requestId, session)
then
  AccountabilityGrouping.joinGroup (group, user)
```

### BetterSelf.groups.JoinGroup#3

Authored path: `BetterSelf.groups.JoinGroup`.
- Covered by [Accountability Groups](../design/compositions/groups.md), line 7.
- Covered by [Accountability Groups](../design/compositions/groups.md), line 19.

```reaction
when AccountabilityGrouping.joinGroup (group, user), asked by BetterSelf.groups.JoinGroup#2
where
  earlier, RequestBoundary.request (group, path: "/groups/join", requestId, session)
then
  RequestBoundary.respond (group, requestId)
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

### BetterSelf.proofs.SubmitProof

Authored path: `BetterSelf.proofs.SubmitProof`.
- Covered by [Proof Submission](../design/compositions/proofs.md), line 3.
- Covered by [Proof Submission](../design/compositions/proofs.md), line 16.

```reaction
when RequestBoundary.request (commitment, evidence, goal, occurrence, path: "/proofs/submit", requestId, session)
then
  Sessioning.current (session)
```

### BetterSelf.proofs.SubmitProof:authorized#2

Authored path: `BetterSelf.proofs.SubmitProof`.
- Covered by [Proof Submission](../design/compositions/proofs.md), line 3.
- Covered by [Proof Submission](../design/compositions/proofs.md), line 16.

```reaction
when Sessioning.current (session, subject: user), asked by BetterSelf.proofs.SubmitProof
where
  earlier, RequestBoundary.request (commitment, evidence, goal, occurrence, path: "/proofs/submit", requestId, session)
  GoalPlanning._goal (goal) has (owner: user)
  CommitmentTracking._commitment (commitment) has (goal)
then
  ProofVerifying.submitProof (commitment, evidence, goal, occurrence, submitter: user)
```

### BetterSelf.proofs.SubmitProof:authorized#3

Authored path: `BetterSelf.proofs.SubmitProof`.
- Covered by [Proof Submission](../design/compositions/proofs.md), line 3.
- Covered by [Proof Submission](../design/compositions/proofs.md), line 16.

```reaction
when ProofVerifying.submitProof (commitment, evidence, goal, occurrence, submitter: user, proof), asked by BetterSelf.proofs.SubmitProof:authorized#2
where
  earlier, RequestBoundary.request (commitment, evidence, goal, occurrence, path: "/proofs/submit", requestId, session)
then
  RequestBoundary.respond (proof, requestId)
```

### BetterSelf.proofs.SubmitProof:forbiddenGoal#2

Authored path: `BetterSelf.proofs.SubmitProof`.
- Covered by [Proof Submission](../design/compositions/proofs.md), line 3.
- Covered by [Proof Submission](../design/compositions/proofs.md), line 16.

```reaction
when Sessioning.current (session, subject: user), asked by BetterSelf.proofs.SubmitProof
where
  earlier, RequestBoundary.request (commitment, evidence, goal, occurrence, path: "/proofs/submit", requestId, session)
  GoalPlanning._goal (goal)
  no GoalPlanning._goal (goal) has (owner: user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### BetterSelf.proofs.SubmitProof:missingCommitment#2

Authored path: `BetterSelf.proofs.SubmitProof`.
- Covered by [Proof Submission](../design/compositions/proofs.md), line 3.
- Covered by [Proof Submission](../design/compositions/proofs.md), line 16.

```reaction
when Sessioning.current (session, subject: user), asked by BetterSelf.proofs.SubmitProof
where
  earlier, RequestBoundary.request (commitment, evidence, goal, occurrence, path: "/proofs/submit", requestId, session)
  GoalPlanning._goal (goal) has (owner: user)
  no CommitmentTracking._commitment (commitment)
then
  RequestBoundary.respond (error: "COMMITMENT_NOT_FOUND", requestId)
```

### BetterSelf.proofs.SubmitProof:missingGoal#2

Authored path: `BetterSelf.proofs.SubmitProof`.
- Covered by [Proof Submission](../design/compositions/proofs.md), line 3.
- Covered by [Proof Submission](../design/compositions/proofs.md), line 16.

```reaction
when Sessioning.current (session, subject: user), asked by BetterSelf.proofs.SubmitProof
where
  earlier, RequestBoundary.request (commitment, evidence, goal, occurrence, path: "/proofs/submit", requestId, session)
  no GoalPlanning._goal (goal)
then
  RequestBoundary.respond (error: "GOAL_NOT_FOUND", requestId)
```

### BetterSelf.proofs.SubmitProof:wrongGoal#2

Authored path: `BetterSelf.proofs.SubmitProof`.
- Covered by [Proof Submission](../design/compositions/proofs.md), line 3.
- Covered by [Proof Submission](../design/compositions/proofs.md), line 16.

```reaction
when Sessioning.current (session, subject: user), asked by BetterSelf.proofs.SubmitProof
where
  earlier, RequestBoundary.request (commitment, evidence, goal, occurrence, path: "/proofs/submit", requestId, session)
  GoalPlanning._goal (goal) has (owner: user)
  CommitmentTracking._commitment (commitment)
  no CommitmentTracking._commitment (commitment) has (goal)
then
  RequestBoundary.respond (error: "COMMITMENT_GOAL_MISMATCH", requestId)
```

### BetterSelf.strategyProposal.ProposeStrategy

Authored path: `BetterSelf.strategyProposal.ProposeStrategy`.
- Covered by [Strategy Proposal](../design/compositions/strategy-proposal.md), line 3.
- Covered by [Strategy Proposal](../design/compositions/strategy-proposal.md), line 18.

```reaction
when RequestBoundary.request (goal, path: "/strategies/propose", requestId, session)
then
  Sessioning.current (session)
```

### BetterSelf.strategyProposal.ProposeStrategy:authorized#2

Authored path: `BetterSelf.strategyProposal.ProposeStrategy`.
- Covered by [Strategy Proposal](../design/compositions/strategy-proposal.md), line 3.
- Covered by [Strategy Proposal](../design/compositions/strategy-proposal.md), line 18.

```reaction
when Sessioning.current (session, subject: user), asked by BetterSelf.strategyProposal.ProposeStrategy
where
  earlier, RequestBoundary.request (goal, path: "/strategies/propose", requestId, session)
  GoalPlanning._goal (goal) has (constraints, currentContext, outcome, owner: user, successDefinition, timeline)
then
  Reasoning.proposeStrategy (constraints, currentContext, outcome, successDefinition, timeline)
```

### BetterSelf.strategyProposal.ProposeStrategy:authorized#3

Authored path: `BetterSelf.strategyProposal.ProposeStrategy`.
- Covered by [Strategy Proposal](../design/compositions/strategy-proposal.md), line 3.
- Covered by [Strategy Proposal](../design/compositions/strategy-proposal.md), line 18.

```reaction
when Reasoning.proposeStrategy (constraints, currentContext, outcome, successDefinition, timeline, strategy), asked by BetterSelf.strategyProposal.ProposeStrategy:authorized#2
where
  earlier, RequestBoundary.request (goal, path: "/strategies/propose", requestId, session)
then
  RequestBoundary.respond (requestId, strategy)
```

### BetterSelf.strategyProposal.ProposeStrategy:forbidden#2

Authored path: `BetterSelf.strategyProposal.ProposeStrategy`.
- Covered by [Strategy Proposal](../design/compositions/strategy-proposal.md), line 3.
- Covered by [Strategy Proposal](../design/compositions/strategy-proposal.md), line 18.

```reaction
when Sessioning.current (session, subject: user), asked by BetterSelf.strategyProposal.ProposeStrategy
where
  earlier, RequestBoundary.request (goal, path: "/strategies/propose", requestId, session)
  GoalPlanning._goal (goal)
  no GoalPlanning._goal (goal) has (owner: user)
then
  RequestBoundary.respond (error: "FORBIDDEN", requestId)
```

### BetterSelf.strategyProposal.ProposeStrategy:missingGoal#2

Authored path: `BetterSelf.strategyProposal.ProposeStrategy`.
- Covered by [Strategy Proposal](../design/compositions/strategy-proposal.md), line 3.
- Covered by [Strategy Proposal](../design/compositions/strategy-proposal.md), line 18.

```reaction
when Sessioning.current (session, subject: user), asked by BetterSelf.strategyProposal.ProposeStrategy
where
  earlier, RequestBoundary.request (goal, path: "/strategies/propose", requestId, session)
  no GoalPlanning._goal (goal)
then
  RequestBoundary.respond (error: "GOAL_NOT_FOUND", requestId)
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
- `/commitments/create` — requires `session`, `goal`, `description`, `recurring`, `schedule`; fills `sourceStep` with "" when absent
- `/dashboard/goal` — requires `session`, `goal`
- `/dashboard/goals` — requires `session`
- `/dashboard/group-proofs` — requires `session`, `group`
- `/dashboard/groups` — requires `session`
- `/goals/create` — requires `session`, `outcome`, `currentContext`, `constraints`, `timeline`, `successDefinition`
- `/goals/set-strategy` — requires `session`, `goal`, `strategy`
- `/groups/attach-goal` — requires `session`, `group`, `goal`
- `/groups/create` — requires `session`, `name`, `topic`
- `/groups/join` — requires `session`, `group`
- `/proofs/review` — requires `session`, `proof`, `decision`, `note`
- `/proofs/submit` — requires `session`, `goal`, `commitment`, `occurrence`, `evidence`
- `/strategies/propose` — requires `session`, `goal`
