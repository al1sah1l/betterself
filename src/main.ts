import { createGateway } from "@mit-sdg/sync-engine/boundary";
import { createHttpHandler } from "@mit-sdg/sync-engine-http/handler";
import { httpPolicy } from "@mit-sdg/sync-engine-http/policy";

import { assembleApplication } from "./assembly.ts";

const application = assembleApplication();

const gateway = createGateway({
  application,
});

const invokeGateway = gateway.invoke.bind(gateway);

gateway.invoke = async (path, input, options) => {
  if (path !== "/proofs/submit") {
    return invokeGateway(path, input, options);
  }

  if (
    typeof input !== "object" ||
    input === null ||
    !("occurrence" in input) ||
    typeof input.occurrence !== "string"
  ) {
    return {
      ok: false,
      error: {
        kind: "domain",
        value: "INVALID_OCCURRENCE",
      },
    };
  }

  const occurrence = new Date(input.occurrence);

  if (
    !Number.isFinite(occurrence.getTime()) ||
    occurrence.toISOString() !== input.occurrence
  ) {
    return {
      ok: false,
      error: {
        kind: "domain",
        value: "INVALID_OCCURRENCE",
      },
    };
  }

  return invokeGateway(
    path,
    {
      ...input,
      occurrence,
    },
    options,
  );
};

const handler = createHttpHandler({
  application,
  gateway,
  policy: httpPolicy({
    basePath: "/api",
    publicErrors: {
        INVALID_USERNAME: "INVALID_REQUEST",
        WEAK_PASSWORD: "INVALID_REQUEST",
        USERNAME_TAKEN: "CONFLICT",
        INVALID_CREDENTIALS: "UNAUTHORIZED",
        UNKNOWN_SESSION: "UNAUTHORIZED",

        GOAL_NOT_FOUND: "NOT_FOUND",
        FORBIDDEN: "FORBIDDEN",
        STRATEGY_ALREADY_SET: "CONFLICT",
        STRATEGY_NOT_SET: "CONFLICT",

        COMMITMENT_NOT_FOUND: "NOT_FOUND",
        COMMITMENT_GOAL_MISMATCH: "INVALID_REQUEST",
        COMMITMENT_RETIRED: "CONFLICT",
        COMPLETION_ALREADY_CLAIMED: "CONFLICT",
        COMMITMENT_ALREADY_RETIRED: "CONFLICT",
        ONE_TIME_ALREADY_COMPLETED: "CONFLICT",

        PROOF_ALREADY_SUBMITTED: "CONFLICT",
        PROOF_NOT_FOUND: "NOT_FOUND",
        CANNOT_REVIEW_OWN_PROOF: "FORBIDDEN",
        PROOF_ALREADY_REVIEWED: "CONFLICT",
        EVIDENCE_REQUIRED: "INVALID_REQUEST",
        INVALID_OCCURRENCE: "INVALID_REQUEST",

        GROUP_NOT_FOUND: "NOT_FOUND",
        ALREADY_MEMBER: "CONFLICT",
        NOT_GROUP_MEMBER: "FORBIDDEN",
        GOAL_ALREADY_ATTACHED: "CONFLICT",
        GOAL_NOT_ATTACHED: "CONFLICT",
        PROOF_ALREADY_SHARED: "CONFLICT",
    },
  }),
});

const server = Bun.serve({
  hostname: "localhost",
  port: 3000,
  fetch: handler,
});

console.log(`BetterSelf API listening on ${server.url}`);
