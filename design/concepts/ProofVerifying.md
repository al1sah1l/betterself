# ProofVerifying

## Purpose

Require evidence for claimed execution and allow other users to verify whether submitted evidence supports the claimed completion.

## Principle

When a user completes an occurrence of a commitment, they submit one or more pieces of evidence for it. These pieces of evidence together form one proof for that commitment occurrence. Other users can review the proof and mark it as verified or disputed. Peer verification is stored separately from the submitter's own completion claim.

## Types

```types
external User
  A user who submits or reviews proof.

external Goal
  The goal associated with the proof.

external Commitment
  The commitment associated with the proof.

external Evidence
  One piece of evidence submitted for a commitment occurrence.

opaque EvidenceBundle
  A collection of Evidence values supplied when submitting or reading a proof.

opaque VerificationDecision
  A review decision, either verified or disputed.
```

## State

```state
a set of Proofs with
  a submitter User
  a goal Goal
  a commitment Commitment
  an occurrence DateTime
  an evidence set of Evidence
  a createdAt DateTime
  unique commitment and occurrence

a set of Verifications with
  a proof Proof
  a reviewer User
  a decision VerificationDecision
  a note String
  a createdAt DateTime
  unique proof and reviewer
```

## Actions

```actions
submitProof(submitter: User, goal: Goal, commitment: Commitment, occurrence: DateTime, evidence: EvidenceBundle) : returns (proof: Proof)
  where evidence contains at least one Evidence and no Proof has this commitment and occurrence
  then
    add a new Proof with submitter, goal, commitment, occurrence, all Evidence values in evidence, and the current creation time
    returns proof
  where evidence contains no Evidence
  then
    refuses EVIDENCE_REQUIRED "At least one piece of evidence is required."
  where evidence contains at least one Evidence and a Proof already has this commitment and occurrence
  then
    refuses PROOF_ALREADY_SUBMITTED "Proof has already been submitted for this occurrence."

reviewProof(reviewer: User, proof: Proof, decision: VerificationDecision, note: String) : returns (proof: Proof)
  where proof is in Proofs and the proof's submitter is not reviewer and no Verification has this proof and reviewer
  then
    add a new Verification with proof, reviewer, decision, note, and the current creation time
    returns proof
  where proof is not in Proofs
  then
    refuses PROOF_NOT_FOUND "There is no such proof."
  where proof is in Proofs and the proof's submitter is reviewer
  then
    refuses CANNOT_REVIEW_OWN_PROOF "A user cannot review their own proof."
  where proof is in Proofs and a Verification already has this proof and reviewer
  then
    refuses PROOF_ALREADY_REVIEWED "This user has already reviewed this proof."

deletePendingProof(submitter: User, proof: Proof) : returns (proof: Proof)
  where proof is in Proofs and the proof's submitter is submitter and no Verification has this proof
  then
    remove proof from Proofs
    returns proof
  where proof is not in Proofs
  then
    refuses PROOF_NOT_FOUND "There is no such proof."
  where proof is in Proofs and the proof's submitter is not submitter
  then
    refuses NOT_PROOF_SUBMITTER "Only the submitter can delete this proof."
  where proof is in Proofs and the proof's submitter is submitter and a Verification has this proof
  then
    refuses PROOF_HAS_REVIEWS "A proof with peer reviews cannot be deleted."
```

## Queries

```queries
_proof(proof: Proof) : optional (submitter: User, goal: Goal, commitment: Commitment, occurrence: DateTime, evidence: EvidenceBundle)
  Returns the proof's fields, including all evidence items, or no row when the proof does not exist.

_proofForOccurrence(commitment: Commitment, occurrence: DateTime) : optional (proof: Proof, submitter: User, goal: Goal, evidence: EvidenceBundle)
  Returns the proof and all of its evidence items for this commitment occurrence, or no row when no proof has been submitted.

_proofsByCommitment(commitment: Commitment) : many (proof: Proof, submitter: User, goal: Goal, occurrence: DateTime, evidence: EvidenceBundle)
  Returns all proofs for this commitment in creation order, including proofs without a completion claim.

_verificationsByProof(proof: Proof) : many (reviewer: User, decision: VerificationDecision, note: String)
  Returns all peer verifications for this proof in creation order, or no rows when the proof has not been reviewed.
```
