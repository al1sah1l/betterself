import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";

import spec from "@design/concepts/Reasoning.md" with { type: "text" };

import {
  InvalidStrategyProposal,
  InvalidReview,
  ReviewUnavailable,
  ReasoningConcept,
  type StrategyGenerator,
} from "./Reasoning.ts";

import type {
  ReviewGenerator,
  ReviewContextProvider,
} from "./review-types.ts";

import {
  openAIStrategyGenerator,
} from "./openai-strategy-generator.ts";

import {
  openAIReviewGenerator,
} from "./openai-review-generator.ts";

const placeholderGenerator: StrategyGenerator = async ({
  outcome,
  currentContext,
  constraints,
  timeline,
  successDefinition,
}) => [
  {
    description:
      `Define the first concrete action toward "${outcome}" based on your current situation: ${currentContext}`,
    successCriterion:
      "A specific first action has been chosen and scheduled.",
  },
  {
    description:
      `Work consistently within the stated constraints: ${constraints}`,
    successCriterion:
      "The planned actions are completed consistently within the available constraints.",
  },
  {
    description:
      `Evaluate progress against the target timeline (${timeline}) and desired result (${successDefinition}).`,
    successCriterion:
      `Progress can be compared directly with: ${successDefinition}`,
  },
];

const placeholderReview: ReviewGenerator =
  async (context) => ({
    analysis:
      "Separate execution claims from peer reviews and observed outcomes. Review the evidence before deciding whether the approach needs to change.",
    strategy: context.state.strategy,
  });

export const reasoning = registerConcept({
  class: ReasoningConcept,
  spec,

  refusals: {
    INVALID_STRATEGY_PROPOSAL: InvalidStrategyProposal,
    INVALID_REVIEW: InvalidReview,
    REVIEW_UNAVAILABLE: ReviewUnavailable,
  },

  floors: {
    mongo: ({
      db,
      reviewContextProvider,
    }: {
      db: Db;
      reviewContextProvider?: ReviewContextProvider;
    }) => {
      void db;

      return new ReasoningConcept(
        process.env.NODE_ENV === "test"
          ? placeholderGenerator
          : openAIStrategyGenerator,

        process.env.NODE_ENV === "test"
          ? placeholderReview
          : openAIReviewGenerator,

        reviewContextProvider,
      );
    },
  },
});
