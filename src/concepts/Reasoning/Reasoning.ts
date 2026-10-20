import type {
  ReviewInput,
  ReviewGenerator,
  ReviewContextProvider,
} from "./review-types.ts";

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
export class InvalidReview extends Error {}
export class ReviewUnavailable extends Error {}

export class ReasoningConcept {
  constructor(
    private readonly generateStrategy: StrategyGenerator,
    private readonly generateReview?: ReviewGenerator,
    private readonly provideReviewContext?: ReviewContextProvider,
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
        !step ||
        typeof step.description !== "string" ||
        !step.description.trim() ||
        typeof step.successCriterion !== "string" ||
        !step.successCriterion.trim()
      ) {
        throw new InvalidStrategyProposal(
          "The reasoner produced an invalid strategy step.",
        );
      }
    }

    return { strategy };
  }

  async reviewProgress({
    context: input,
  }: {
    context: ReviewInput;
  }) {
    let context;

    try {
      if (typeof input === "string") {
        if (!this.provideReviewContext) {
          throw new Error("No context provider.");
        }

        context = await this.provideReviewContext(input);
      } else {
        context = input;
      }
    } catch {
      throw new ReviewUnavailable(
        "AI review is unavailable. Please try again.",
      );
    }

    if (!context.state.strategy.length) {
      throw new InvalidReview(
        "Save an initial strategy before reviewing progress.",
      );
    }

    let proposal;

    try {
      if (!this.generateReview) {
        throw new Error("No review generator.");
      }

      proposal = await this.generateReview(context);
    } catch {
      throw new ReviewUnavailable(
        "AI review is unavailable. Please try again.",
      );
    }

    if (
      !proposal ||
      typeof proposal.analysis !== "string" ||
      !proposal.analysis.trim() ||
      !Array.isArray(proposal.strategy) ||
      proposal.strategy.length === 0 ||
      proposal.strategy.length > 20 ||
      proposal.strategy.some(
        (step) =>
          !step ||
          typeof step.description !== "string" ||
          !step.description.trim() ||
          typeof step.successCriterion !== "string" ||
          !step.successCriterion.trim(),
      )
    ) {
      throw new InvalidReview(
        "AI returned an invalid review.",
      );
    }

    return {
      analysis: proposal.analysis.trim(),
      strategy: proposal.strategy,
      revision: context.state.revision,
    };
  }
}
