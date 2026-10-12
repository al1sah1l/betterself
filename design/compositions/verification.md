# Proof Verification Access

A proof review request [checks accountability-group membership before recording the review](reaction:BetterSelf.verification.ReviewProof).

The endpoint receives the reviewer, proof, decision, and note. It derives the goal from the proof rather than trusting the client to provide a goal.

Before recording the review, the endpoint checks that the reviewer is a member of the accountability group attached to that goal. Only if this membership check succeeds does it call `ProofVerifying.reviewProof`.

If the reviewer is not a member of the relevant accountability group, the review is not recorded.

```endpoints
BetterSelf.verification.ReviewProof at /proofs/review
```