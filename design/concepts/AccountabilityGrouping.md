# AccountabilityGrouping

## Purpose

Create small groups where people pursuing related goals can make progress visible and hold one another accountable.

## Principle

A user creates or joins an accountability group. A goal can be attached to at most one group. Proof submitted for an attached goal can be shared with that group, and membership can be checked before a user is allowed to review another person's proof.

## Types

```types
external User
  A user who can create or join an accountability group.

external Goal
  A goal that can be attached to an accountability group.

external Proof
  Proof that can be shared with an accountability group.
```

## State

```state
a set of Groups with
  a name String
  a topic String
  a createdAt DateTime

a set of Memberships with
  a group Group
  a user User
  a createdAt DateTime
  unique group and user

a set of GoalAttachments with
  a group Group
  a goal Goal
  a createdAt DateTime
  unique goal

a set of SharedProofs with
  a group Group
  a proof Proof
  a createdAt DateTime
  unique group and proof
```

## Actions

```actions
createGroup(owner: User, name: String, topic: String) : returns (group: Group)
  where true
  then
    add a new Group with name, topic, and the current creation time
    add a new Membership with this group, owner as user, and the current creation time
    returns group

joinGroup(group: Group, user: User) : returns (group: Group)
  where group is in Groups and no Membership has this group and user
  then
    add a new Membership with group, user, and the current creation time
    returns group
  where group is not in Groups
  then
    refuses GROUP_NOT_FOUND "There is no such group."
  where group is in Groups and a Membership already has this group and user
  then
    refuses ALREADY_MEMBER "This user is already a member of this group."

attachGoal(group: Group, user: User, goal: Goal) : returns (group: Group)
  where group is in Groups and a Membership has this group and user and no GoalAttachment has this goal
  then
    add a new GoalAttachment with group, goal, and the current creation time
    returns group
  where group is not in Groups
  then
    refuses GROUP_NOT_FOUND "There is no such group."
  where group is in Groups and no Membership has this group and user
  then
    refuses NOT_GROUP_MEMBER "This user is not a member of this group."
  where a GoalAttachment already has this goal
  then
    refuses GOAL_ALREADY_ATTACHED "This goal is already attached to an accountability group."

shareProof(goal: Goal, proof: Proof) : returns (group: Group)
  where a GoalAttachment has goal and group and no SharedProof has this group and proof
  then
    add a new SharedProof with group, proof, and the current creation time
    returns group
  where no GoalAttachment has this goal
  then
    refuses GOAL_NOT_ATTACHED "This goal is not attached to an accountability group."
  where a GoalAttachment has goal and group and a SharedProof already has this group and proof
  then
    refuses PROOF_ALREADY_SHARED "This proof has already been shared with this group."

checkMember(goal: Goal, user: User) : returns (group: Group)
  where a GoalAttachment has goal and group and a Membership has this group and user
  then
    returns group
  where no GoalAttachment has this goal
  then
    refuses GOAL_NOT_ATTACHED "This goal is not attached to an accountability group."
  where a GoalAttachment has goal and group and no Membership has this group and user
  then
    refuses NOT_GROUP_MEMBER "This user is not a member of this group."
```

## Queries

```queries
_group(group: Group) : optional (name: String, topic: String)
  Returns the group's fields, or no row when the group does not exist.

_groupsForUser(user: User) : many (group: Group, name: String, topic: String)
  Returns all groups this user belongs to in membership creation order, or no rows when the user belongs to no groups.

_members(group: Group) : many (user: User)
  Returns all members of this group in membership creation order, or no rows when the group has no members.

_groupForGoal(goal: Goal) : optional (group: Group)
  Returns the accountability group attached to this goal, or no row when the goal is not attached to a group.

_sharedProofs(group: Group) : many (proof: Proof)
  Returns all proofs shared with this group in sharing order, or no rows when no proofs have been shared.
```