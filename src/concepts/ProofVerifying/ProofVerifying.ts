import {
  MongoServerError,
  type Collection,
  type Db,
} from "mongodb";

export class ProofAlreadySubmitted extends Error {}
export class ProofNotFound extends Error {}
export class CannotReviewOwnProof extends Error {}
export class ProofAlreadyReviewed extends Error {}
export class EvidenceRequired extends Error {}
export class NotProofSubmitter extends Error {}
export class ProofHasReviews extends Error {}

export type VerificationDecision = "verified" | "disputed";

export type EvidenceBundle<
  Evidence extends string,
> = Evidence[];

interface ProofDocument<
  User extends string,
  Goal extends string,
  Commitment extends string,
  Evidence extends string,
> {
  _id: string;
  submitter: User;
  goal: Goal;
  commitment: Commitment;
  occurrence: Date;
  evidence: Evidence[];
  createdAt: Date;
}

interface VerificationDocument<User extends string> {
  _id: string;
  proof: string;
  reviewer: User;
  decision: VerificationDecision;
  note: string;
  createdAt: Date;
}

const readiness = new WeakMap<object, Promise<void>>();

function ensureReady<
  User extends string,
  Goal extends string,
  Commitment extends string,
  Evidence extends string,
>(
  proofs: Collection<
    ProofDocument<User, Goal, Commitment, Evidence>
  >,
  verifications: Collection<VerificationDocument<User>>,
) {
  let ready = readiness.get(proofs);

  if (!ready) {
    ready = Promise.all([
      proofs.createIndex(
        { commitment: 1, occurrence: 1 },
        { unique: true },
      ),
      verifications.createIndex(
        { proof: 1, reviewer: 1 },
        { unique: true },
      ),
    ]).then(() => undefined);

    readiness.set(proofs, ready);
  }

  return ready;
}

async function withProofLock<T>(
  operations: Map<string, Promise<void>>,
  proof: string,
  operation: () => Promise<T>,
): Promise<T> {
  const previous =
    operations.get(proof) ?? Promise.resolve();

  let release!: () => void;

  const current = new Promise<void>((resolve) => {
    release = resolve;
  });

  const tail = previous.then(() => current);

  operations.set(proof, tail);

  await previous;

  try {
    return await operation();
  } finally {
    release();

    if (operations.get(proof) === tail) {
      operations.delete(proof);
    }
  }
}

export class ProofVerifyingConcept<
  User extends string,
  Goal extends string,
  Commitment extends string,
  Evidence extends string,
> {
  private readonly proofs: Collection<
    ProofDocument<User, Goal, Commitment, Evidence>
  >;

  private readonly verifications: Collection<
    VerificationDocument<User>
  >;

  private readonly proofOperations =
    new Map<string, Promise<void>>();

  constructor(db: Db) {
    this.proofs = db.collection<
      ProofDocument<User, Goal, Commitment, Evidence>
    >("proofVerifying.proofs");

    this.verifications = db.collection<
      VerificationDocument<User>
    >("proofVerifying.verifications");
  }

  async submitProof({
    submitter,
    goal,
    commitment,
    occurrence,
    evidence,
  }: {
    submitter: User;
    goal: Goal;
    commitment: Commitment;
    occurrence: Date;
    evidence: EvidenceBundle<Evidence>;
  }) {
    const uniqueEvidence = [...new Set(evidence)];

    if (uniqueEvidence.length === 0) {
      throw new EvidenceRequired(
        "At least one piece of evidence is required.",
      );
    }

    await ensureReady(this.proofs, this.verifications);

    const proof = crypto.randomUUID();

    try {
      await this.proofs.insertOne({
        _id: proof,
        submitter,
        goal,
        commitment,
        occurrence,
        evidence: uniqueEvidence,
        createdAt: new Date(),
      });
    } catch (error) {
      if (
        error instanceof MongoServerError &&
        error.code === 11000
      ) {
        throw new ProofAlreadySubmitted(
          "Proof has already been submitted for this occurrence.",
        );
      }

      throw error;
    }

    return { proof };
  }

  async reviewProof({
    reviewer,
    proof,
    decision,
    note,
  }: {
    reviewer: User;
    proof: string;
    decision: VerificationDecision;
    note: string;
  }) {
    return withProofLock(
      this.proofOperations,
      proof,
      async () => {
        await ensureReady(this.proofs, this.verifications);

        const existingProof = await this.proofs.findOne({
          _id: proof,
        });

        if (!existingProof) {
          throw new ProofNotFound(
            "There is no such proof.",
          );
        }

        if (existingProof.submitter === reviewer) {
          throw new CannotReviewOwnProof(
            "A user cannot review their own proof.",
          );
        }

        try {
          await this.verifications.insertOne({
            _id: crypto.randomUUID(),
            proof,
            reviewer,
            decision,
            note,
            createdAt: new Date(),
          });
        } catch (error) {
          if (
            error instanceof MongoServerError &&
            error.code === 11000
          ) {
            throw new ProofAlreadyReviewed(
              "This user has already reviewed this proof.",
            );
          }

          throw error;
        }

        return { proof };
      },
    );
  }

  async deletePendingProof({
    submitter,
    proof,
  }: {
    submitter: User;
    proof: string;
  }) {
    return withProofLock(
      this.proofOperations,
      proof,
      async () => {
        await ensureReady(this.proofs, this.verifications);

        const existingProof = await this.proofs.findOne({
          _id: proof,
        });

        if (!existingProof) {
          throw new ProofNotFound(
            "There is no such proof.",
          );
        }

        if (existingProof.submitter !== submitter) {
          throw new NotProofSubmitter(
            "Only the submitter can delete this proof.",
          );
        }

        const review = await this.verifications.findOne({
          proof,
        });

        if (review) {
          throw new ProofHasReviews(
            "A proof with peer reviews cannot be deleted.",
          );
        }

        await this.proofs.deleteOne({
          _id: proof,
        });

        return { proof };
      },
    );
  }

  async _proof({ proof }: { proof: string }) {
    const found = await this.proofs.findOne({
      _id: proof,
    });

    if (!found) return [];

    return [
      {
        submitter: found.submitter,
        goal: found.goal,
        commitment: found.commitment,
        occurrence: found.occurrence,
        evidence: found.evidence,
      },
    ];
  }

  async _proofForOccurrence({
    commitment,
    occurrence,
  }: {
    commitment: Commitment;
    occurrence: Date;
  }) {
    const found = await this.proofs.findOne({
      commitment,
      occurrence,
    });

    if (!found) return [];

    return [
      {
        proof: found._id,
        submitter: found.submitter,
        goal: found.goal,
        evidence: found.evidence,
      },
    ];
  }

  async _proofsByCommitment({
    commitment,
  }: {
    commitment: Commitment;
  }) {
    const proofs = await this.proofs
      .find({ commitment })
      .sort({ createdAt: 1, _id: 1 })
      .toArray();

    return proofs.map((proof) => ({
      proof: proof._id,
      submitter: proof.submitter,
      goal: proof.goal,
      occurrence: proof.occurrence,
      evidence: proof.evidence,
    }));
  }

  async _verificationsByProof({
    proof,
  }: {
    proof: string;
  }) {
    const verifications = await this.verifications
      .find({ proof })
      .sort({ createdAt: 1 })
      .toArray();

    return verifications.map((verification) => ({
      reviewer: verification.reviewer,
      decision: verification.decision,
      note: verification.note,
    }));
  }
}
