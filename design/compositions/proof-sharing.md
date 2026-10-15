# Proof Sharing

When a proof is successfully submitted for a goal that is attached to an accountability group, BetterSelf [automatically shares that proof with the group](reaction:BetterSelf.proofSharing.ShareProofWithGroup).

The reaction first checks whether the goal is attached to an accountability group. If an attachment exists, the submitted proof is shared with that group.

If the goal is not attached to any accountability group, no sharing action occurs. Proof submission and completion still succeed normally.

When a pending proof is successfully deleted, the application [removes its group sharing references](reaction:BetterSelf.proofSharing.UnshareDeletedProof).

Cleanup also succeeds when the proof was never shared. The separate completion claim is preserved.