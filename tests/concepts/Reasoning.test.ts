import {
  describe,
  expect,
  test,
} from "bun:test";

import {
  InvalidStrategyProposal,
  ReasoningConcept,
} from "../../src/concepts/Reasoning/Reasoning.ts";

describe("Reasoning", () => {
  test("proposes a strategy using the supplied goal context", async () => {
    const reasoning = new ReasoningConcept(
      async (context) => {
        expect(context).toEqual({
          outcome:
            "Get a software engineering internship",
          currentContext:
            "I have a resume but have not started applying.",
          constraints:
            "Five hours per week.",
          timeline:
            "By summer 2027",
          successDefinition:
            "Receive and accept an internship offer.",
        });

        return [
          {
            description:
              "Create a target list of internship opportunities.",
            successCriterion:
              "A list of at least 20 relevant companies exists.",
          },
          {
            description:
              "Apply consistently to selected opportunities.",
            successCriterion:
              "At least five targeted applications are submitted each week.",
          },
        ];
      },
    );

    const result =
      await reasoning.proposeStrategy({
        outcome:
          "Get a software engineering internship",
        currentContext:
          "I have a resume but have not started applying.",
        constraints:
          "Five hours per week.",
        timeline:
          "By summer 2027",
        successDefinition:
          "Receive and accept an internship offer.",
      });

    expect(result).toEqual({
      strategy: [
        {
          description:
            "Create a target list of internship opportunities.",
          successCriterion:
            "A list of at least 20 relevant companies exists.",
        },
        {
          description:
            "Apply consistently to selected opportunities.",
          successCriterion:
            "At least five targeted applications are submitted each week.",
        },
      ],
    });
  });

  test("rejects an empty strategy proposal", async () => {
    const reasoning =
      new ReasoningConcept(async () => []);

    await expect(
      reasoning.proposeStrategy({
        outcome: "Read more",
        currentContext: "I rarely read now.",
        constraints: "30 minutes per day.",
        timeline: "Three months",
        successDefinition: "Finish six books.",
      }),
    ).rejects.toBeInstanceOf(
      InvalidStrategyProposal,
    );
  });

  test("rejects a strategy step with an empty description", async () => {
    const reasoning =
      new ReasoningConcept(async () => [
        {
          description: "",
          successCriterion:
            "Read for 30 minutes.",
        },
      ]);

    await expect(
      reasoning.proposeStrategy({
        outcome: "Read more",
        currentContext: "I rarely read now.",
        constraints: "30 minutes per day.",
        timeline: "Three months",
        successDefinition: "Finish six books.",
      }),
    ).rejects.toBeInstanceOf(
      InvalidStrategyProposal,
    );
  });

  test("rejects a strategy step with an empty success criterion", async () => {
    const reasoning =
      new ReasoningConcept(async () => [
        {
          description:
            "Read every evening.",
          successCriterion: "   ",
        },
      ]);

    await expect(
      reasoning.proposeStrategy({
        outcome: "Read more",
        currentContext: "I rarely read now.",
        constraints: "30 minutes per day.",
        timeline: "Three months",
        successDefinition: "Finish six books.",
      }),
    ).rejects.toBeInstanceOf(
      InvalidStrategyProposal,
    );
  });
});
