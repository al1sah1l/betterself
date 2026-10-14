import type {
  Strategy,
  StrategyGenerator,
} from "./Reasoning.ts";

interface OpenAIResponse {
  output?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
      refusal?: string;
    }>;
  }>;

  error?: {
    message?: string;
  };
}

function extractOutputText(
  response: OpenAIResponse,
) {
  const pieces: string[] = [];

  for (const item of response.output ?? []) {
    for (const content of item.content ?? []) {
      if (
        content.type === "output_text" &&
        typeof content.text === "string"
      ) {
        pieces.push(content.text);
      }
    }
  }

  return pieces.join("");
}

export const openAIStrategyGenerator: StrategyGenerator =
  async ({
    outcome,
    currentContext,
    constraints,
    timeline,
    successDefinition,
  }) => {
    const apiKey =
      process.env.OPENAI_API_KEY;

    if (!apiKey) {
      throw new Error(
        "OPENAI_API_KEY is not configured.",
      );
    }

    const model =
      process.env.OPENAI_MODEL ??
      "gpt-6-luna";

    const response = await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          Authorization:
            `Bearer ${apiKey}`,
        },

        body: JSON.stringify({
          model,

          input: [
            {
              role: "developer",

              content:
                `You help people turn self-directed goals into practical strategies.

Create a concise strategy of 3 to 5 steps.

Each step must:
- describe a concrete approach the user can act on;
- have an observable success criterion;
- respect the user's constraints and timeline;
- contribute directly to the user's definition of success.

Do not give medical, legal, mental-health treatment, or investment advice.

Return only the requested structured strategy.`,
            },

            {
              role: "user",

              content: JSON.stringify({
                outcome,
                currentContext,
                constraints,
                timeline,
                successDefinition,
              }),
            },
          ],

          text: {
            format: {
              type: "json_schema",

              name:
                "strategy_proposal",

              strict: true,

              schema: {
                type: "object",

                properties: {
                  strategy: {
                    type: "array",

                    items: {
                      type: "object",

                      properties: {
                        description: {
                          type: "string",
                        },

                        successCriterion: {
                          type: "string",
                        },
                      },

                      required: [
                        "description",
                        "successCriterion",
                      ],

                      additionalProperties:
                        false,
                    },
                  },
                },

                required: [
                  "strategy",
                ],

                additionalProperties:
                  false,
              },
            },
          },
        }),
      },
    );

    const data =
      await response.json() as OpenAIResponse;

    if (!response.ok) {
      throw new Error(
        data.error?.message ??
          `OpenAI request failed with status ${response.status}.`,
      );
    }

    const outputText =
      extractOutputText(data);

    if (!outputText) {
      throw new Error(
        "OpenAI returned no strategy.",
      );
    }

    const parsed =
      JSON.parse(outputText) as {
        strategy: Strategy;
      };

    return parsed.strategy;
  };
  