# Proof Sharing

When a proof is successfully submitted for a goal attached to an accountability group, BetterSelf [automatically shares that proof with the group](reaction:BetterSelf.proofSharing.ShareProofWithGroup).

If the goal is not attached to a group, proof submission and completion still succeed without sharing.

When a goal is successfully attached to a group, BetterSelf [shares its existing proofs with that group](reaction:BetterSelf.proofSharing.ShareExistingProofsOnAttach).

This reaction selects the goal's commitments and their existing proofs, excluding proofs already shared with the group. It does not create new proofs, completion claims, or peer reviews.

Before attaching a goal, the interface must explain that existing and future proofs will become visible to group members.

When a pending proof is successfully deleted, BetterSelf [removes its group sharing references](reaction:BetterSelf.proofSharing.UnshareDeletedProof).

Cleanup also succeeds when the proof was never shared. The separate completion claim is preserved.