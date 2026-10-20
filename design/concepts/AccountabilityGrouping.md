# AccountabilityGrouping

## Purpose

Create groups where people pursuing related goals can make progress visible and hold one another accountable.

## Principle

A user creates a private or public group and becomes its owner and first member. Public groups can be discovered by searching their names and topics. Private groups are not listed in search; users join them using a group ID shared as an invitation.

Members can attach goals and share proof. A goal belongs to at most one group. Only the owner can update or delete a group.

Deleting a group removes its memberships, goal attachments, and sharing references. Goals, commitments, proofs, and reviews remain in their respective concepts.

Visibility is either public or private. A valid name contains 1–100 characters after trimming. A valid topic contains 1–500 characters after trimming.

For legacy stored groups without visibility, use private. For legacy stored groups without owner, use the first member in membership creation order; the previous creation action inserted the creator's membership first.

## Types

```types
external User
  A user who creates, joins, or owns a group.

external Goal
  A goal attached to an accountability group.

external Proof
  Proof shared with an accountability group.
```

## State

```state
a set of Groups with
  an owner User
  a name String
  a topic String
  a visibility String
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
createGroup(owner: User, name: String, topic: String, visibility?: String) : returns (group: Group)
  where name and topic are valid and visibility is absent or public or private
  then
    add a Group with owner, trimmed name, trimmed topic, supplied visibility or private, and current creation time
    add a Membership with group, owner as user, and current creation time
    returns group
  where name or topic is invalid or supplied visibility is neither public nor private
  then
    refuses INVALID_GROUP_DETAILS "Enter a name of 1–100 characters, a topic of 1–500 characters, and public or private visibility."

updateGroup(group: Group, owner: User, name: String, topic: String, visibility: String) : returns (group: Group)
  where group exists and owner is its owner and name and topic and visibility are valid
  then
    set the group's name and topic to the trimmed values and visibility to the supplied value
    returns group
  where group does not exist
  then
    refuses GROUP_NOT_FOUND "There is no such group."
  where group exists and owner is not its owner
  then
    refuses NOT_GROUP_OWNER "Only the group owner can change or delete this group."
  where group exists and owner is its owner and (name or topic or visibility is invalid)
  then
    refuses INVALID_GROUP_DETAILS "Enter a name of 1–100 characters, a topic of 1–500 characters, and public or private visibility."

deleteGroup(group: Group, owner: User) : returns (group: Group)
  where group exists and owner is its owner
  then
    remove the group's SharedProofs, GoalAttachments, Memberships, and Group
    returns group
  where group does not exist
  then
    refuses GROUP_NOT_FOUND "There is no such group."
  where group exists and owner is not its owner
  then
    refuses NOT_GROUP_OWNER "Only the group owner can change or delete this group."

joinGroup(group: Group, user: User) : returns (group: Group)
  where group exists and no Membership has this group and user
  then
    add a Membership with group, user, and current creation time
    returns group
  where group does not exist
  then
    refuses GROUP_NOT_FOUND "There is no such group."
  where group exists and a Membership already has this group and user
  then
    refuses ALREADY_MEMBER "This user is already a member of this group."

attachGoal(group: Group, user: User, goal: Goal) : returns (group: Group)
  where group exists and user is a member and no GoalAttachment has this goal
  then
    add a GoalAttachment with group, goal, and current creation time
    returns group
  where group does not exist
  then
    refuses GROUP_NOT_FOUND "There is no such group."
  where group exists and user is not a member
  then
    refuses NOT_GROUP_MEMBER "This user is not a member of this group."
  where a GoalAttachment already has this goal
  then
    refuses GOAL_ALREADY_ATTACHED "This goal is already attached to an accountability group."

shareProof(goal: Goal, proof: Proof) : returns (group: Group)
  where an attachment has this goal and group and no SharedProof has this group and proof
  then
    add a SharedProof with group, proof, and current creation time
    returns group
  where no attachment has this goal
  then
    refuses GOAL_NOT_ATTACHED "This goal is not attached to an accountability group."
  where an attachment has this goal and group and a SharedProof already has this group and proof
  then
    refuses PROOF_ALREADY_SHARED "This proof has already been shared with this group."

unshareProof(proof: Proof) : returns (proof: Proof)
  where true
  then
    remove all SharedProofs with this proof
    returns proof

checkMember(goal: Goal, user: User) : returns (group: Group)
  where an attachment has this goal and group and user is a member of group
  then
    returns group
  where no attachment has this goal
  then
    refuses GOAL_NOT_ATTACHED "This goal is not attached to an accountability group."
  where an attachment has this goal and group and user is not a member of group
  then
    refuses NOT_GROUP_MEMBER "This user is not a member of this group."
```

## Queries

```queries
_group(group: Group) : optional (name: String, topic: String)
  Returns the name and topic, or no row when the group does not exist.

_groupSettings(group: Group) : optional (owner: User, name: String, topic: String, visibility: String)
  Returns group settings, including legacy ownership and visibility defaults, or no row when missing.

_publicGroups(search: String) : many (group: Group, name: String, topic: String)
  Returns up to 50 public groups whose names or topics contain the trimmed search text, ignoring case, newest first with group ID as the tie-breaker. Search uses at most 100 characters. Empty search lists public groups. Private groups are excluded.

_groupsForUser(user: User) : many (group: Group, name: String, topic: String)
  Returns the user's existing groups in membership creation order.

_members(group: Group) : many (user: User)
  Returns members in membership creation order.

_groupForGoal(goal: Goal) : optional (group: Group)
  Returns the attached group, or no row when unattached.

_sharedProofs(group: Group) : many (proof: Proof)
  Returns shared proof references in sharing order.
```
