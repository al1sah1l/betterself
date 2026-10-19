import type { Collection, Db } from "mongodb";

export class InvalidResult extends Error {}
export class ResultNotFound extends Error {}

interface ResultDocument<Goal extends string> {
  _id: string;
  goal: Goal;
  description: string;
  observedOn: string;
  createdAt: Date;
}

export class ResultTrackingConcept<Goal extends string> {
  private readonly results: Collection<ResultDocument<Goal>>;

  constructor(db: Db) {
    this.results = db.collection<ResultDocument<Goal>>(
      "resultTracking.results",
    );
  }

  async recordResult({
    goal,
    description,
    observedOn,
  }: {
    goal: Goal;
    description: string;
    observedOn: string;
  }) {
    const date =
      typeof observedOn === "string"
        ? new Date(`${observedOn}T00:00:00.000Z`)
        : new Date(NaN);

    if (
      typeof description !== "string" ||
      !description.trim() ||
      description.trim().length > 2000 ||
      typeof observedOn !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(observedOn) ||
      !Number.isFinite(date.getTime()) ||
      date.toISOString().slice(0, 10) !== observedOn
    ) {
      throw new InvalidResult(
        "Enter a valid date and a result of 1–2000 characters.",
      );
    }

    const result = crypto.randomUUID();

    await this.results.insertOne({
      _id: result,
      goal,
      description: description.trim(),
      observedOn,
      createdAt: new Date(),
    });

    return { result };
  }

  async removeResult({
    goal,
    result,
  }: {
    goal: Goal;
    result: string;
  }) {
    const removed = await this.results.deleteOne({
      _id: result,
      goal,
    });

    if (removed.deletedCount === 0) {
      throw new ResultNotFound(
        "There is no such result for this goal.",
      );
    }

    return { result };
  }

  async _resultsByGoal({ goal }: { goal: Goal }) {
    const rows = await this.results
      .find({ goal })
      .sort({
        observedOn: -1,
        createdAt: -1,
        _id: 1,
      })
      .toArray();

    return rows.map((row) => ({
      result: row._id,
      description: row.description,
      observedOn: row.observedOn,
    }));
  }
}
