import {
  MongoServerError,
  type Collection,
  type Db,
} from "mongodb";

export class CommitmentNotFound extends Error {}
export class CommitmentRetired extends Error {}
export class CompletionAlreadyClaimed extends Error {}
export class CommitmentAlreadyRetired extends Error {}
export class OneTimeAlreadyCompleted extends Error {}

interface CommitmentDocument<Goal extends string> {
  _id: string;
  goal: Goal;
  description: string;
  recurring: boolean;
  schedule: string;
  active: boolean;
  createdAt: Date;
  sourceStep?: string;
}

interface CompletionDocument {
  _id: string;
  commitment: string;
  occurrence: Date;
  claimKey: string;
}

const readiness = new WeakMap<object, Promise<void>>();

function ensureReady(
  completions: Collection<CompletionDocument>,
) {
  let ready = readiness.get(completions);

  if (!ready) {
    ready = completions
      .createIndex(
        { commitment: 1, claimKey: 1 },
        { unique: true },
      )
      .then(() => undefined);

    readiness.set(completions, ready);
  }

  return ready;
}

export class CommitmentTrackingConcept<Goal extends string> {
  private readonly commitments: Collection<CommitmentDocument<Goal>>;
  private readonly completions: Collection<CompletionDocument>;

  constructor(db: Db) {
    this.commitments =
      db.collection<CommitmentDocument<Goal>>(
        "commitmentTracking.commitments",
      );

    this.completions =
      db.collection<CompletionDocument>(
        "commitmentTracking.completions",
      );
  }

  async createCommitment({
    goal,
    description,
    recurring,
    schedule,
    sourceStep,
  }: {
    goal: Goal;
    description: string;
    recurring: boolean;
    schedule: string;
    sourceStep?: string;
  }) {
    await ensureReady(this.completions);

    const commitment = crypto.randomUUID();

    await this.commitments.insertOne({
      _id: commitment,
      goal,
      description,
      recurring,
      schedule,
      ...(sourceStep !== undefined && sourceStep !== ""
        ? { sourceStep }
        : {}),
      active: true,
      createdAt: new Date(),
    });

    return { commitment };
  }

  async checkProofSubmission({
    commitment,
    occurrence,
  }: {
    commitment: string;
    occurrence: Date;
  }) {
    await ensureReady(this.completions);

    const existingCommitment =
      await this.commitments.findOne({
        _id: commitment,
      });

    if (!existingCommitment) {
      throw new CommitmentNotFound(
        "There is no such commitment.",
      );
    }

    if (!existingCommitment.active) {
      throw new CommitmentRetired(
        "This commitment is no longer active.",
      );
    }

    if (!existingCommitment.recurring) {
      const existingCompletion =
        await this.completions.findOne({
          commitment,
        });

      if (
        existingCompletion &&
        existingCompletion.occurrence.getTime() !==
          occurrence.getTime()
      ) {
        throw new OneTimeAlreadyCompleted(
          "This one-time commitment has already been completed.",
        );
      }
    }

    return {
      commitment,
      recurring: existingCommitment.recurring,
    };
  }

  async claimComplete({
    commitment,
    occurrence,
  }: {
    commitment: string;
    occurrence: Date;
  }) {
    await ensureReady(this.completions);

    const existingCommitment =
      await this.commitments.findOne({
        _id: commitment,
      });

    if (!existingCommitment) {
      throw new CommitmentNotFound(
        "There is no such commitment.",
      );
    }

    if (!existingCommitment.active) {
      throw new CommitmentRetired(
        "This commitment is no longer active.",
      );
    }

    if (!existingCommitment.recurring) {
      const existingCompletion =
        await this.completions.findOne({
          commitment,
        });

      if (existingCompletion) {
        throw new OneTimeAlreadyCompleted(
          "This one-time commitment has already been completed.",
        );
      }
    }

    const claimKey = existingCommitment.recurring
      ? occurrence.toISOString()
      : "one-time";

    const completion = crypto.randomUUID();

    try {
      await this.completions.insertOne({
        _id: completion,
        commitment,
        occurrence,
        claimKey,
      });
    } catch (error) {
      if (
        error instanceof MongoServerError &&
        error.code === 11000
      ) {
        if (!existingCommitment.recurring) {
          throw new OneTimeAlreadyCompleted(
            "This one-time commitment has already been completed.",
          );
        }

        throw new CompletionAlreadyClaimed(
          "This occurrence has already been completed.",
        );
      }

      throw error;
    }

    return { completion };
  }

  async retireCommitment({
    commitment,
  }: {
    commitment: string;
  }) {
    await ensureReady(this.completions);

    const existingCommitment =
      await this.commitments.findOne({
        _id: commitment,
      });

    if (!existingCommitment) {
      throw new CommitmentNotFound(
        "There is no such commitment.",
      );
    }

    if (!existingCommitment.active) {
      throw new CommitmentAlreadyRetired(
        "This commitment is already retired.",
      );
    }

    await this.commitments.updateOne(
      { _id: commitment },
      { $set: { active: false } },
    );

    return { commitment };
  }

  async _commitment({
    commitment,
  }: {
    commitment: string;
  }) {
    const found = await this.commitments.findOne({
      _id: commitment,
    });

    if (!found) {
      return [];
    }

    return [{
      goal: found.goal,
      description: found.description,
      recurring: found.recurring,
      schedule: found.schedule,
      active: found.active,
      ...(found.sourceStep !== undefined
        ? { sourceStep: found.sourceStep }
        : {}),
    }];
  }

  async _commitmentsByGoal({
    goal,
  }: {
    goal: Goal;
  }) {
    const commitments = await this.commitments
      .find({ goal })
      .sort({ createdAt: 1 })
      .toArray();

    return commitments.map((commitment) => ({
      commitment: commitment._id,
      description: commitment.description,
      recurring: commitment.recurring,
      schedule: commitment.schedule,
      active: commitment.active,
      ...(commitment.sourceStep !== undefined
        ? { sourceStep: commitment.sourceStep }
        : {}),
    }));
  }

  async _completionsByCommitment({
    commitment,
  }: {
    commitment: string;
  }) {
    const completions = await this.completions
      .find({ commitment })
      .sort({ occurrence: 1 })
      .toArray();

    return completions.map((completion) => ({
      completion: completion._id,
      occurrence: completion.occurrence,
    }));
  }
}
