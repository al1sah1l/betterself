# Proof Submission

An authenticated user can [submit proof for a commitment that belongs to one of their goals](reaction:BetterSelf.proofs.SubmitProof).

The endpoint receives a session, goal, commitment, occurrence, and evidence.

It resolves the session to the authenticated account, verifies that the goal belongs to that account, and verifies that the commitment belongs to that exact goal before submitting the proof.

The submitter identity is derived from the session and is not accepted from the client.

Before storing proof for a one-time commitment, the endpoint checks that the commitment has no completion claim. Otherwise, it returns `ONE_TIME_ALREADY_COMPLETED` without creating another proof.

If the goal does not exist, the endpoint returns `GOAL_NOT_FOUND`. If the goal belongs to another account, it returns `FORBIDDEN`. If the commitment does not exist, it returns `COMMITMENT_NOT_FOUND`. If the commitment belongs to a different goal, it returns `COMMITMENT_GOAL_MISMATCH`.

An authenticated user can [delete their own pending proof](reaction:BetterSelf.proofs.DeletePendingProof).

The submitter is derived from the session. A proof can be deleted only when it has no peer reviews. Deletion preserves the separate completion claim.

A successful proof submission can trigger the existing completion and proof-sharing reactions.

For a one-time commitment with an existing completion claim, proof can be submitted again only for that claim's occurrence and only when its previous proof is absent. The existing completion claim is preserved.

A different occurrence returns `ONE_TIME_ALREADY_COMPLETED`. If proof already exists for the claim's occurrence, the endpoint returns `PROOF_ALREADY_SUBMITTED`.

```endpoints
BetterSelf.proofs.SubmitProof at /proofs/submit
BetterSelf.proofs.DeletePendingProof at /proofs/delete
```
