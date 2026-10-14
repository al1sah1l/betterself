import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import spec from "@design/concepts/Reasoning.md" with { type: "text" };

import {
  InvalidStrategyProposal,
  ReasoningConcept,
  type StrategyGenerator,
} from "./Reasoning.ts";

import {
  openAIStrategyGenerator,
} from "./openai-strategy-generator.ts";

const placeholderGenerator: StrategyGenerator = async ({
  outcome,
  currentContext,
  constraints,
  timeline,
  successDefinition,
}) => {
  return [
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
};

export const reasoning = registerConcept({
  class: ReasoningConcept,
  spec,

  refusals: {
    INVALID_STRATEGY_PROPOSAL: InvalidStrategyProposal,
  },

  floors: {
    mongo: ({ db }: { db: Db }) => {
        void db;

        const generator =
        process.env.NODE_ENV === "test"
            ? placeholderGenerator
            : openAIStrategyGenerator;

        return new ReasoningConcept(
        generator,
        );
    },
},
});
