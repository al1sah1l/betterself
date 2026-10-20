import type { Collection, Db } from "mongodb";

export class GoalNotFound extends Error {}
export class StrategyAlreadySet extends Error {}
export class StrategyNotSet extends Error {}
export class StrategyChanged extends Error {}
export class InvalidStrategy extends Error {}

export interface StrategyStep {
  description: string;
  successCriterion: string;
}

export type Strategy = StrategyStep[];

interface GoalDocument<User extends string> {
  _id: string;
  owner: User;
  outcome: string;
  currentContext: string;
  constraints: string;
  timeline: string;
  successDefinition: string;
  currentStrategy?: Strategy;
  strategyRevision?: string;
  createdAt: Date;
}

export class GoalPlanningConcept<User extends string> {
  private readonly goals: Collection<GoalDocument<User>>;

  constructor(db: Db) {
    this.goals = db.collection<GoalDocument<User>>(
      "goalPlanning.goals",
    );
  }

  async createGoal({
    owner,
    outcome,
    currentContext,
    constraints,
    timeline,
    successDefinition,
  }: {
    owner: User;
    outcome: string;
    currentContext: string;
    constraints: string;
    timeline: string;
    successDefinition: string;
  }) {
    const goal = crypto.randomUUID();

    await this.goals.insertOne({
      _id: goal,
      owner,
      outcome,
      currentContext,
      constraints,
      timeline,
      successDefinition,
      createdAt: new Date(),
    });

    return { goal };
  }

  async setStrategy({
    goal,
    strategy,
  }: {
    goal: string;
    strategy: Strategy;
  }) {
    const result = await this.goals.updateOne(
      {
        _id: goal,
        currentStrategy: { $exists: false },
      },
      {
        $set: { currentStrategy: strategy },
      },
    );

    if (!result.matchedCount) {
      const existing = await this.goals.findOne({
        _id: goal,
      });

      if (!existing) {
        throw new GoalNotFound("There is no such goal.");
      }

      throw new StrategyAlreadySet(
        "This goal already has a strategy.",
      );
    }

    return { goal };
  }

  async reviseStrategy({
    goal,
    strategy,
  }: {
    goal: string;
    strategy: Strategy;
  }) {
    const result = await this.goals.updateOne(
      {
        _id: goal,
        currentStrategy: { $exists: true },
      },
      {
        $set: {
          currentStrategy: strategy,
          strategyRevision: crypto.randomUUID(),
        },
      },
    );

    if (!result.matchedCount) {
      const existing = await this.goals.findOne({
        _id: goal,
      });

      if (!existing) {
        throw new GoalNotFound("There is no such goal.");
      }

      throw new StrategyNotSet(
        "This goal does not have a strategy yet.",
      );
    }

    return { goal };
  }

  async acceptStrategyRevision({
    goal,
    strategy,
    expectedRevision,
  }: {
    goal: string;
    strategy: Strategy;
    expectedRevision: string;
  }) {
    if (
      typeof expectedRevision !== "string" ||
      !expectedRevision ||
      !Array.isArray(strategy) ||
      strategy.length === 0 ||
      strategy.length > 20 ||
      strategy.some(
        (step) =>
          !step ||
          typeof step.description !== "string" ||
          !step.description.trim() ||
          typeof step.successCriterion !== "string" ||
          !step.successCriterion.trim(),
      )
    ) {
      throw new InvalidStrategy(
        "Enter a valid strategy and revision identity.",
      );
    }

    const matchRevision =
      expectedRevision === "initial"
        ? {
            $or: [
              { strategyRevision: "initial" },
              {
                strategyRevision: {
                  $exists: false,
                },
              },
            ],
          }
        : {
            strategyRevision: expectedRevision,
          };

    const result = await this.goals.updateOne(
      {
        _id: goal,
        currentStrategy: { $exists: true },
        ...matchRevision,
      },
      {
        $set: {
          currentStrategy: strategy.map((step) => ({
            description: step.description.trim(),
            successCriterion:
              step.successCriterion.trim(),
          })),
          strategyRevision: crypto.randomUUID(),
        },
      },
    );

    if (!result.matchedCount) {
      const found = await this.goals.findOne({
        _id: goal,
      });

      if (!found) {
        throw new GoalNotFound("There is no such goal.");
      }

      if (found.currentStrategy === undefined) {
        throw new StrategyNotSet(
          "This goal does not have a strategy yet.",
        );
      }

      throw new StrategyChanged(
        "The strategy changed. Generate a new review before applying it.",
      );
    }

    return { goal };
  }

  async updateGoal({
    goal,
    outcome,
    currentContext,
    constraints,
    timeline,
    successDefinition,
  }: {
    goal: string;
    outcome: string;
    currentContext: string;
    constraints: string;
    timeline: string;
    successDefinition: string;
  }) {
    const result = await this.goals.updateOne(
      { _id: goal },
      {
        $set: {
          outcome,
          currentContext,
          constraints,
          timeline,
          successDefinition,
        },
      },
    );

    if (!result.matchedCount) {
      throw new GoalNotFound("There is no such goal.");
    }

    return { goal };
  }

  async deleteGoal({ goal }: { goal: string }) {
    const result = await this.goals.deleteOne({
      _id: goal,
    });

    if (!result.deletedCount) {
      throw new GoalNotFound("There is no such goal.");
    }

    return { goal };
  }

  async _strategySnapshot({ goal }: { goal: string }) {
    const found = await this.goals.findOne({
      _id: goal,
    });

    if (!found) return [];

    return [{
      strategy: found.currentStrategy ?? [],
      revision: found.strategyRevision ?? "initial",
    }];
  }

  async _goal({ goal }: { goal: string }) {
    const found = await this.goals.findOne({
      _id: goal,
    });

    if (!found) return [];

    return [{
      owner: found.owner,
      outcome: found.outcome,
      currentContext: found.currentContext,
      constraints: found.constraints,
      timeline: found.timeline,
      successDefinition: found.successDefinition,
      ...(found.currentStrategy !== undefined
        ? { currentStrategy: found.currentStrategy }
        : {}),
    }];
  }

  async _goalsByOwner({ owner }: { owner: User }) {
    const goals = await this.goals
      .find({ owner })
      .sort({ createdAt: 1 })
      .toArray();

    return goals.map((goal) => ({
      goal: goal._id,
      outcome: goal.outcome,
      currentContext: goal.currentContext,
      constraints: goal.constraints,
      timeline: goal.timeline,
      successDefinition: goal.successDefinition,
      ...(goal.currentStrategy !== undefined
        ? { currentStrategy: goal.currentStrategy }
        : {}),
    }));
  }
}
