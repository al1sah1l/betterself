import { expect, test } from "bun:test";

import {
  ReasoningConcept,
  InvalidReview,
  ReviewUnavailable,
} from "../../src/concepts/Reasoning/Reasoning.ts";

import type {
  ReviewContext,
} from "../../src/concepts/Reasoning/review-types.ts";

const strategy = [{
  description: "Apply weekly",
  successCriterion: "Five applications",
}];

const context: ReviewContext = {
  detail: {
    commitments: [{
      proofs: ["evidence"],
      completions: ["claim"],
    }],
  },

  results: [{
    description: "Two interviews",
  }],

  state: {
    strategy,
    revision: "initial",
  },
};

test("review receives outcomes and execution context and preserves base revision", async () => {
  const reasoning = new ReasoningConcept(
    async () => strategy,

    async (received) => {
      expect(received).toEqual(context);

      return {
        analysis:
          "Evidence is limited; distinguish execution from outcomes.",
        strategy,
      };
    },
  );

  expect(
    await reasoning.reviewProgress({ context }),
  ).toEqual({
    analysis:
      "Evidence is limited; distinguish execution from outcomes.",
    strategy,
    revision: "initial",
  });
});

test("invalid review, missing strategy, and unavailable generator are refused", async () => {
  const invalid = new ReasoningConcept(
    async () => strategy,
    async () => ({
      analysis: " ",
      strategy: [],
    }),
  );

  await expect(
    invalid.reviewProgress({ context }),
  ).rejects.toBeInstanceOf(InvalidReview);

  await expect(
    invalid.reviewProgress({
      context: {
        ...context,
        state: {
          strategy: [],
          revision: "initial",
        },
      },
    }),
  ).rejects.toBeInstanceOf(InvalidReview);

  const unavailable = new ReasoningConcept(
    async () => strategy,

    async () => {
      throw new Error("Service failed");
    },
  );

  await expect(
    unavailable.reviewProgress({ context }),
  ).rejects.toBeInstanceOf(ReviewUnavailable);
});
