# Proof Resubmission

An authenticated submitter can [submit new evidence for a disputed proof](reaction:BetterSelf.proofResubmission.ResubmitProof). The endpoint derives the submitter from the session and requires the proof's commitment to remain active. A different submitter receives FORBIDDEN; missing proof or commitment returns PROOF_NOT_FOUND or COMMITMENT_NOT_FOUND; a retired commitment returns COMMITMENT_RETIRED.

ProofVerifying checks that the previous proof is current, has at least one disputed review, and has no verified reviews. It creates a new attempt while retaining the original goal, commitment, occurrence, previous evidence, and previous peer reviews. Client-supplied goal, commitment, occurrence, or submitter cannot change the new attempt's context.

A successful resubmission [shares the new attempt with the attached group](reaction:BetterSelf.proofResubmission.ShareResubmittedProof). Without an attached group, the attempt remains available to its author without sharing. The endpoint responds after the new attempt is stored. Group sharing runs as a separate reaction and may finish after the response.

Resubmission does not trigger RecordCompletionFromProof because that reaction listens only to initial submitProof actions. Therefore, new evidence for an existing occurrence does not create another completion claim.

```endpoints
BetterSelf.proofResubmission.ResubmitProof at /proofs/resubmit
```
