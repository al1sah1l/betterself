# Accountability Groups

An authenticated user can [create an accountability group](reaction:BetterSelf.groups.CreateGroup).

The group owner is derived from the session and is not accepted directly from the client. Creating a group automatically makes the owner a member.

An authenticated user can [join an existing accountability group](reaction:BetterSelf.groups.JoinGroup).

The joining user is derived from the session, so a client cannot add another user to a group on their behalf.

An authenticated user can [attach one of their goals to an accountability group](reaction:BetterSelf.groups.AttachGoal).

Before attaching the goal, the endpoint checks that the authenticated account owns that goal. The accountability-group concept then checks that the user is a member of the group and that the goal is not already attached to another group.

If the goal does not exist, the endpoint returns `GOAL_NOT_FOUND`. If the goal belongs to another account, it returns `FORBIDDEN`.

```endpoints
BetterSelf.groups.CreateGroup at /groups/create
BetterSelf.groups.JoinGroup at /groups/join
BetterSelf.groups.AttachGoal at /groups/attach-goal
```
