export interface StrategyStep {
  description: string;
  successCriterion: string;
}

export type Strategy = StrategyStep[];

export interface StrategyContext {
  outcome: string;
  currentContext: string;
  constraints: string;
  timeline: string;
  successDefinition: string;
}

export type StrategyGenerator = (
  context: StrategyContext,
) => Promise<Strategy>;

export class InvalidStrategyProposal extends Error {}

export class ReasoningConcept {
  constructor(
    private readonly generateStrategy: StrategyGenerator,
  ) {}

  async proposeStrategy({
    outcome,
    currentContext,
    constraints,
    timeline,
    successDefinition,
  }: StrategyContext) {
    const strategy = await this.generateStrategy({
      outcome,
      currentContext,
      constraints,
      timeline,
      successDefinition,
    });

    if (!Array.isArray(strategy) || strategy.length === 0) {
      throw new InvalidStrategyProposal(
        "The reasoner did not produce a strategy.",
      );
    }

    for (const step of strategy) {
      if (
        typeof step.description !== "string" ||
        step.description.trim().length === 0 ||
        typeof step.successCriterion !== "string" ||
        step.successCriterion.trim().length === 0
      ) {
        throw new InvalidStrategyProposal(
          "The reasoner produced an invalid strategy step.",
        );
      }
    }

    return { strategy };
  }
}
