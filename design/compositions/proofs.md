# Proof Submission

An authenticated user can [submit proof for a commitment that belongs to one of their goals](reaction:BetterSelf.proofs.SubmitProof).

The endpoint receives a session, goal, commitment, occurrence, and evidence.

It resolves the session to the authenticated account, verifies that the goal belongs to that account, and verifies that the commitment belongs to that exact goal before submitting the proof.

The submitter identity is derived from the session and is not accepted from the client.

If the goal does not exist, the endpoint returns `GOAL_NOT_FOUND`. If the goal belongs to another account, it returns `FORBIDDEN`. If the commitment does not exist, it returns `COMMITMENT_NOT_FOUND`. If the commitment belongs to a different goal, it returns `COMMITMENT_GOAL_MISMATCH`.

A successful proof submission can trigger the existing completion and proof-sharing reactions.

```endpoints
BetterSelf.proofs.SubmitProof at /proofs/submit
```
