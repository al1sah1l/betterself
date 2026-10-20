# Group Management

Authenticated users can [search public groups](reaction:BetterSelf.groupManagement.SearchPublicGroups) by name or topic. The response uses [the public group search former](former:BetterSelf.groupManagement.PublicGroups). Private groups are excluded, and discovery does not reveal submitted proofs or peer reviews.

Group members can [read group settings](reaction:BetterSelf.groupManagement.GetGroupSettings), formed by [the group settings former](former:BetterSelf.groupManagement.GroupSettings). A missing group returns GROUP_NOT_FOUND. A nonmember receives FORBIDDEN.

The authenticated group owner can [update the group's name, topic, and visibility](reaction:BetterSelf.groupManagement.UpdateGroup). Ownership is derived from the session, and the concept refuses changes by another user.

The authenticated group owner can [delete the group](reaction:BetterSelf.groupManagement.DeleteGroup). Deletion removes the group's memberships, goal attachments, and proof sharing references. Goals, commitments, proofs, and peer reviews are preserved.

Creating a group accepts public or private visibility and defaults to private when visibility is omitted. Private group IDs act as invitations and should only be shared with intended members.

```endpoints
BetterSelf.groupManagement.SearchPublicGroups at /dashboard/public-groups
BetterSelf.groupManagement.GetGroupSettings at /groups/settings
BetterSelf.groupManagement.UpdateGroup at /groups/update
BetterSelf.groupManagement.DeleteGroup at /groups/delete
```
