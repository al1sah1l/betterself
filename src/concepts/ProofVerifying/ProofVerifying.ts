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
export class NotProofAuthor extends Error {}
export class ProofNotDisputed extends Error {}
export class ProofSuperseded extends Error {}
export class ProofOneTimeAlreadyCompleted extends Error {}

export type VerificationDecision = "verified" | "disputed";
export type EvidenceBundle<Evidence extends string> = Evidence[];

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
  previousProof?: string;
  attempt?: number;
  singleUse?: boolean;
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
const mutationTails = new WeakMap<object, Promise<void>>();

async function withMutationLock<T>(
  db: Db,
  operation: () => Promise<T>,
): Promise<T> {
  const previous =
    mutationTails.get(db) ?? Promise.resolve();

  let release!: () => void;

  const current = new Promise<void>((resolve) => {
    release = resolve;
  });

  const tail = previous.then(() => current);

  mutationTails.set(db, tail);

  await previous;

  try {
    return await operation();
  } finally {
    release();

    if (mutationTails.get(db) === tail) {
      mutationTails.delete(db);
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

  private readonly attempts: Collection<
    ProofDocument<User, Goal, Commitment, Evidence>
  >;

  private readonly verifications: Collection<
    VerificationDocument<User>
  >;

  constructor(private readonly db: Db) {
    this.proofs = db.collection<
      ProofDocument<User, Goal, Commitment, Evidence>
    >("proofVerifying.proofs");

    this.attempts = db.collection<
      ProofDocument<User, Goal, Commitment, Evidence>
    >("proofVerifying.attempts");

    this.verifications = db.collection<
      VerificationDocument<User>
    >("proofVerifying.verifications");
  }

  async #ready(): Promise<void> {
    let ready = readiness.get(this.proofs);

    if (!ready) {
      ready = Promise.all([
        this.proofs.createIndex(
          { commitment: 1, occurrence: 1 },
          { unique: true },
        ),

        this.proofs.createIndex(
          { commitment: 1 },
          {
            name: "one_initial_proof_per_one_time_commitment",
            unique: true,
            partialFilterExpression: {
              singleUse: true,
            },
          },
        ),

        this.attempts.createIndex(
          { previousProof: 1 },
          { unique: true },
        ),

        this.verifications.createIndex(
          { proof: 1, reviewer: 1 },
          { unique: true },
        ),
      ]).then(() => undefined);

      readiness.set(this.proofs, ready);
    }

    await ready;
  }

  async #findProof(proof: string) {
    const original = await this.proofs.findOne({
      _id: proof,
    });

    if (original) {
      return original;
    }

    return this.attempts.findOne({
      _id: proof,
    });
  }

  async #proofRows(commitment: Commitment) {
    const [originals, attempts] = await Promise.all([
      this.proofs.find({ commitment }).toArray(),
      this.attempts.find({ commitment }).toArray(),
    ]);

    return [...originals, ...attempts].sort(
      (left, right) =>
        left.createdAt.getTime() - right.createdAt.getTime() ||
        left._id.localeCompare(right._id),
    );
  }

  async submitProof({
    submitter,
    goal,
    commitment,
    occurrence,
    evidence,
    recurring = true,
  }: {
    submitter: User;
    goal: Goal;
    commitment: Commitment;
    occurrence: Date;
    evidence: EvidenceBundle<Evidence>;
    recurring?: boolean;
  }) {
    const uniqueEvidence = [...new Set(evidence)];

    if (uniqueEvidence.length === 0) {
      throw new EvidenceRequired(
        "At least one piece of evidence is required.",
      );
    }

    return withMutationLock(this.db, async () => {
      await this.#ready();

      const existingProofs =
        await this.#proofRows(commitment);

      const sameOccurrence = existingProofs.some(
        (existing) =>
          existing.occurrence.getTime() ===
          occurrence.getTime(),
      );

      if (sameOccurrence) {
        throw new ProofAlreadySubmitted(
          "Proof has already been submitted for this occurrence.",
        );
      }

      if (!recurring && existingProofs.length > 0) {
        throw new ProofOneTimeAlreadyCompleted(
          "This one-time commitment has already been completed.",
        );
      }

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
          ...(!recurring ? { singleUse: true } : {}),
        });
      } catch (error) {
        if (
          error instanceof MongoServerError &&
          error.code === 11000
        ) {
          const duplicateOccurrence =
            await this.proofs.findOne({
              commitment,
              occurrence,
            });

          if (duplicateOccurrence || recurring) {
            throw new ProofAlreadySubmitted(
              "Proof has already been submitted for this occurrence.",
            );
          }

          throw new ProofOneTimeAlreadyCompleted(
            "This one-time commitment has already been completed.",
          );
        }

        throw error;
      }

      return { proof };
    });
  }

  async resubmitProof({
    submitter,
    previousProof,
    evidence,
  }: {
    submitter: User;
    previousProof: string;
    evidence: EvidenceBundle<Evidence>;
  }) {
    return withMutationLock(this.db, async () => {
      await this.#ready();

      const previous =
        await this.#findProof(previousProof);

      if (!previous) {
        throw new ProofNotFound(
          "There is no such proof.",
        );
      }

      if (previous.submitter !== submitter) {
        throw new NotProofAuthor(
          "Only the submitter can resubmit this proof.",
        );
      }

      const newerAttempt =
        await this.attempts.findOne({
          previousProof,
        });

      if (newerAttempt) {
        throw new ProofSuperseded(
          "This proof has a newer submission.",
        );
      }

      const reviews = await this.verifications
        .find({ proof: previousProof })
        .toArray();

      const disputed = reviews.some(
        (review) => review.decision === "disputed",
      );

      const verified = reviews.some(
        (review) => review.decision === "verified",
      );

      if (!disputed || verified) {
        throw new ProofNotDisputed(
          "Only a disputed proof without verified reviews can be resubmitted.",
        );
      }

      const uniqueEvidence = [...new Set(evidence)];

      if (uniqueEvidence.length === 0) {
        throw new EvidenceRequired(
          "At least one piece of evidence is required.",
        );
      }

      const proof = crypto.randomUUID();

      try {
        await this.attempts.insertOne({
          _id: proof,
          submitter: previous.submitter,
          goal: previous.goal,
          commitment: previous.commitment,
          occurrence: previous.occurrence,
          evidence: uniqueEvidence,
          previousProof,
          attempt: (previous.attempt ?? 1) + 1,
          createdAt: new Date(
            Math.max(
              Date.now(),
              previous.createdAt.getTime() + 1,
            ),
          ),
        });
      } catch (error) {
        if (
          error instanceof MongoServerError &&
          error.code === 11000
        ) {
          throw new ProofSuperseded(
            "This proof has a newer submission.",
          );
        }

        throw error;
      }

      return { proof };
    });
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
    return withMutationLock(this.db, async () => {
      await this.#ready();

      const existingProof =
        await this.#findProof(proof);

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

      const newerAttempt =
        await this.attempts.findOne({
          previousProof: proof,
        });

      if (newerAttempt) {
        throw new ProofSuperseded(
          "This proof has a newer submission.",
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
    });
  }

  async deletePendingProof({
    submitter,
    proof,
  }: {
    submitter: User;
    proof: string;
  }) {
    return withMutationLock(this.db, async () => {
      await this.#ready();

      const existingProof =
        await this.#findProof(proof);

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

      const review =
        await this.verifications.findOne({
          proof,
        });

      if (review) {
        throw new ProofHasReviews(
          "A proof with peer reviews cannot be deleted.",
        );
      }

      const newerAttempt =
        await this.attempts.findOne({
          previousProof: proof,
        });

      if (newerAttempt) {
        throw new ProofSuperseded(
          "This proof has a newer submission.",
        );
      }

      await this.proofs.deleteOne({
        _id: proof,
      });

      await this.attempts.deleteOne({
        _id: proof,
      });

      return { proof };
    });
  }

  async _proof({
    proof,
  }: {
    proof: string;
  }) {
    const found = await this.#findProof(proof);

    if (!found) {
      return [];
    }

    return [{
      submitter: found.submitter,
      goal: found.goal,
      commitment: found.commitment,
      occurrence: found.occurrence,
      evidence: found.evidence,
    }];
  }

  async _proofAttempt({
    proof,
  }: {
    proof: string;
  }) {
    const found = await this.#findProof(proof);

    if (!found) {
      return [];
    }

    const newerAttempt =
      await this.attempts.findOne({
        previousProof: proof,
      });

    return [{
      attempt: found.attempt ?? 1,
      current: newerAttempt === null,
    }];
  }

  async _proofForOccurrence({
    commitment,
    occurrence,
  }: {
    commitment: Commitment;
    occurrence: Date;
  }) {
    const rows =
      await this.#proofRows(commitment);

    const matching = rows.filter(
      (proof) =>
        proof.occurrence.getTime() ===
        occurrence.getTime(),
    );

    const replacedProofs = new Set(
      matching
        .map((proof) => proof.previousProof)
        .filter(
          (proof): proof is string =>
            proof !== undefined,
        ),
    );

    const current = matching.find(
      (proof) => !replacedProofs.has(proof._id),
    );

    if (!current) {
      return [];
    }

    return [{
      proof: current._id,
      submitter: current.submitter,
      goal: current.goal,
      evidence: current.evidence,
    }];
  }

  async _proofsByCommitment({
    commitment,
  }: {
    commitment: Commitment;
  }) {
    const proofs =
      await this.#proofRows(commitment);

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
    const verifications =
      await this.verifications
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
