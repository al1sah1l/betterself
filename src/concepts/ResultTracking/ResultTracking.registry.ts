import { registerConcept } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";

import spec from "@design/concepts/ResultTracking.md" with { type: "text" };

import {
  ResultTrackingConcept,
  InvalidResult,
  ResultNotFound,
} from "./ResultTracking.ts";

export const resultTracking = registerConcept({
  class: ResultTrackingConcept,
  spec,

  refusals: {
    INVALID_RESULT: InvalidResult,
    RESULT_NOT_FOUND: ResultNotFound,
  },

  floors: {
    mongo: ({ db }: { db: Db }) =>
      new ResultTrackingConcept<string>(db),
  },
});
