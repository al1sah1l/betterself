# ProofVerifying

## Purpose

Require evidence for claimed execution and allow other users to verify whether submitted evidence supports the claimed completion.

## Principle

A user submits evidence for a commitment occurrence. Other users can verify or dispute that evidence independently of the user's completion claim. An initial submission creates the first proof attempt. The application supplies whether the commitment is recurring; when omitted, recurring defaults to true. A non-recurring commitment permits only one initial proof while that proof or its later attempts remain stored. A disputed current attempt without verified reviews can be followed by a new attempt for the same occurrence. Earlier evidence and reviews remain available as history. Resubmission does not create another completion claim. Only the current attempt can receive new reviews or be resubmitted.

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
  an attempt Number
  a createdAt DateTime

a set of Replacements with
  a previous Proof
  a replacement Proof
  unique previous
  unique replacement

a set of Verifications with
  a proof Proof
  a reviewer User
  a decision VerificationDecision
  a note String
  a createdAt DateTime
  unique proof and reviewer

Rule: An initial proof has attempt 1 and is not a replacement.
Rule: At most one initial proof exists for a commitment and occurrence.
Rule: An initial submission marked non-recurring is refused when any proof already exists for that commitment.
Rule: A replacement preserves its predecessor's submitter, goal, commitment, and occurrence.
Rule: A replacement's attempt is its predecessor's attempt plus one.
Rule: A proof is current when no Replacement has that proof as previous.
Rule: Submitting a replacement preserves earlier proofs and verifications.
```

## Actions

```actions
submitProof(submitter: User, goal: Goal, commitment: Commitment, occurrence: DateTime, evidence: EvidenceBundle, recurring?: Flag) : returns (proof: Proof)
  where evidence contains at least one Evidence and no Proof has this commitment and occurrence and recurring is true or omitted
  then
    add a new Proof with submitter, goal, commitment, occurrence, all Evidence values in evidence, attempt 1, and the current creation time
    returns proof
  where evidence contains at least one Evidence and recurring is false and no Proof has this commitment
  then
    add a new Proof with submitter, goal, commitment, occurrence, all Evidence values in evidence, attempt 1, and the current creation time
    returns proof
  where evidence contains no Evidence
  then
    refuses EVIDENCE_REQUIRED "At least one piece of evidence is required."
  where evidence contains at least one Evidence and a Proof already has this commitment and occurrence
  then
    refuses PROOF_ALREADY_SUBMITTED "Proof has already been submitted for this occurrence."
  where evidence contains at least one Evidence and recurring is false and no Proof has this commitment and occurrence and a Proof has this commitment with a different occurrence
  then
    refuses ONE_TIME_ALREADY_COMPLETED "This one-time commitment has already been completed."

resubmitProof(submitter: User, previousProof: Proof, evidence: EvidenceBundle) : returns (proof: Proof)
  where previousProof is in Proofs and its submitter is submitter and previousProof is current and it has a disputed Verification and no verified Verification and evidence contains at least one Evidence
  then
    add a new Proof with the previous proof's submitter, goal, commitment, and occurrence, all Evidence values in evidence, the previous attempt plus one, and the current creation time
    add a Replacement with previous previousProof and replacement proof
    returns proof
  where previousProof is not in Proofs
  then
    refuses PROOF_NOT_FOUND "There is no such proof."
  where previousProof is in Proofs and its submitter is not submitter
  then
    refuses NOT_PROOF_AUTHOR "Only the submitter can resubmit this proof."
  where previousProof is in Proofs and its submitter is submitter and previousProof is not current
  then
    refuses PROOF_SUPERSEDED "This proof has a newer submission."
  where previousProof is in Proofs and its submitter is submitter and previousProof is current and it has no disputed Verification or has a verified Verification
  then
    refuses PROOF_NOT_DISPUTED "Only a disputed proof without verified reviews can be resubmitted."
  where previousProof is in Proofs and its submitter is submitter and previousProof is current and it has a disputed Verification and no verified Verification and evidence contains no Evidence
  then
    refuses EVIDENCE_REQUIRED "At least one piece of evidence is required."

reviewProof(reviewer: User, proof: Proof, decision: VerificationDecision, note: String) : returns (proof: Proof)
  where proof is in Proofs and the proof's submitter is not reviewer and proof is current and no Verification has this proof and reviewer
  then
    add a new Verification with proof, reviewer, decision, note, and the current creation time
    returns proof
  where proof is not in Proofs
  then
    refuses PROOF_NOT_FOUND "There is no such proof."
  where proof is in Proofs and the proof's submitter is reviewer
  then
    refuses CANNOT_REVIEW_OWN_PROOF "A user cannot review their own proof."
  where proof is in Proofs and the proof's submitter is not reviewer and proof is not current
  then
    refuses PROOF_SUPERSEDED "This proof has a newer submission."
  where proof is in Proofs and the proof's submitter is not reviewer and proof is current and a Verification already has this proof and reviewer
  then
    refuses PROOF_ALREADY_REVIEWED "This user has already reviewed this proof."

deletePendingProof(submitter: User, proof: Proof) : returns (proof: Proof)
  where proof is in Proofs and the proof's submitter is submitter and proof is current and no Verification has this proof
  then
    remove any Replacement whose replacement is proof
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
  where proof is in Proofs and the proof's submitter is submitter and no Verification has this proof and proof is not current
  then
    refuses PROOF_SUPERSEDED "This proof has a newer submission."
```

## Queries

```queries
_proof(proof: Proof) : optional (submitter: User, goal: Goal, commitment: Commitment, occurrence: DateTime, evidence: EvidenceBundle)
  Returns the proof's fields, including all evidence items, or no row when the proof does not exist.

_proofAttempt(proof: Proof) : optional (attempt: Number, current: Flag)
  Returns the attempt number and whether the proof has no newer replacement, or no row when the proof does not exist.

_proofForOccurrence(commitment: Commitment, occurrence: DateTime) : optional (proof: Proof, submitter: User, goal: Goal, evidence: EvidenceBundle)
  Returns the current proof and its evidence for this commitment occurrence, or no row when no proof exists.

_proofsByCommitment(commitment: Commitment) : many (proof: Proof, submitter: User, goal: Goal, occurrence: DateTime, evidence: EvidenceBundle)
  Returns all proof attempts for this commitment in creation order, including earlier attempts and proofs without a completion claim.

_verificationsByProof(proof: Proof) : many (reviewer: User, decision: VerificationDecision, note: String)
  Returns all peer verifications for this proof in creation order, or no rows when the proof has not been reviewed.
```
