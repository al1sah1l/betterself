import { assemble } from "@mit-sdg/sync-engine/assembly";
import { applicationConceptSet } from "./concepts.ts";
import { db } from "./db.ts";

export function assembleApplication() {
  const instances = applicationConceptSet.implementations("mongo", { db });

  return assemble({
    conceptSet: applicationConceptSet,
    instances,
    composition: {},
  });
}
