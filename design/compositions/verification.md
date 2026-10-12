# Proof Verification Access

A proof review request [checks the authenticated user's accountability-group membership before recording the review](reaction:BetterSelf.verification.ReviewProof).

The endpoint receives a session, proof, decision, and note.

It uses the session to determine the authenticated reviewer. The reviewer is not accepted directly from the client.

The endpoint derives the goal from the proof rather than trusting the client to provide a goal.

Before recording the review, the endpoint checks that the authenticated reviewer is a member of the accountability group attached to that goal. Only if this membership check succeeds does it call `ProofVerifying.reviewProof`.

If the session is invalid, the proof does not exist, or the authenticated reviewer is not a member of the relevant accountability group, the review is not recorded.

```endpoints
BetterSelf.verification.ReviewProof at /proofs/review
```