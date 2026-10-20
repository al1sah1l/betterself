import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";

import spec from "@design/concepts/GoalPlanning.md" with { type: "text" };

import {
  GoalPlanningConcept,
  GoalNotFound,
  StrategyAlreadySet,
  StrategyNotSet,
  StrategyChanged,
  InvalidStrategy,
} from "./GoalPlanning.ts";

export const goalPlanning = registerConcept({
  class: GoalPlanningConcept,
  spec,

  refusals: {
    GOAL_NOT_FOUND: GoalNotFound,
    STRATEGY_ALREADY_SET: StrategyAlreadySet,
    STRATEGY_NOT_SET: StrategyNotSet,
    STRATEGY_CHANGED: StrategyChanged,
    INVALID_STRATEGY: InvalidStrategy,
  },

  floors: {
    mongo: ({ db }: { db: Db }) =>
      new GoalPlanningConcept<string>(db),
  },
});
