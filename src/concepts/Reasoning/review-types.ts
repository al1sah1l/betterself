import type { Strategy } from "./Reasoning.ts";

export interface ReviewContext {
  detail: unknown;
  results: unknown;

  state: {
    strategy: Strategy;
    revision: string;
  };
}

export interface ReviewProposal {
  analysis: string;
  strategy: Strategy;
}

export type ReviewGenerator = (
  context: ReviewContext,
) => Promise<ReviewProposal>;

export type ReviewInput =
  | ReviewContext
  | string;

export type ReviewContextProvider = (
  reference: string,
) => Promise<ReviewContext>;
