# Commitment Completion

A successful proof submission [records the corresponding completion claim](reaction:BetterSelf.completion.RecordCompletionFromProof).

The reaction carries the commitment and occurrence from the successful `ProofVerifying.submitProof` action into `CommitmentTracking.claimComplete`.

This keeps proof submission and completion as separate concepts while ensuring that, in BetterSelf, a user cannot claim completion without first submitting proof.

A completion claim is recorded only when no claim already exists for the submitted proof's commitment and occurrence. Replacing deleted evidence for an existing claim does not create another completion claim.