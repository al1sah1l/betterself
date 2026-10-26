
import { createGateway } from "@mit-sdg/sync-engine/boundary";
import { createHttpHandler } from "@mit-sdg/sync-engine-http/handler";
import { httpPolicy } from "@mit-sdg/sync-engine-http/policy";

import { assembleApplication } from "./assembly.ts";
import { db } from "./db.ts";
import { serveFrontend } from "./http/frontend.ts";

import {
  handleImageRequest,
  imageEvidenceIsOwned,
} from "./http/images.ts";

import {
  cleanupPendingGoalImages,
  handleResourceManagementRequest,
} from "./http/resource-management.ts";

import {
  guardedGoalId,
  goalForProof,
  isProofScopedMutation,
  proofStillBelongsToGoal,
  withExistingGoal,
} from "./http/goal-operation-lock.ts";

import {
  cleanupOrphanImages,
} from "./http/orphan-image-cleanup.ts";

const application = assembleApplication();

const gateway = createGateway({
  application,
});

// Keep a reference to the original Sync Engine
// invocation before applying our HTTP safeguards.
const invokeGateway =
  gateway.invoke.bind(gateway);

const invokeWithValidation: typeof gateway.invoke = async (
  path,
  input,
  options,
) => {
  if (
    path === "/proofs/submit" ||
    path === "/proofs/resubmit"
  ) {
    const payload = input as {
      session?: unknown;
      evidence?: unknown;
    };

    const owned = await imageEvidenceIsOwned(
      (target, body) =>
        invokeGateway(target, body),
      payload?.session,
      payload?.evidence,
    );

    if (!owned) {
      return {
        ok: false,
        error: {
          kind: "domain",
          value: "FORBIDDEN",
        },
      };
    }
  }

  if (path !== "/proofs/submit") {
    return invokeGateway(
      path,
      input,
      options,
    );
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

  const occurrence = new Date(
    input.occurrence,
  );

  if (
    !Number.isFinite(occurrence.getTime()) ||
    occurrence.toISOString() !==
      input.occurrence
  ) {
    return {
      ok: false,
      error: {
        kind: "domain",
        value: "INVALID_OCCURRENCE",
      },
    };
  }

  const result = await invokeGateway(
    path,
    {
      ...input,
      occurrence,
    },
    options,
  );

  if (result.ok) {
    await gateway.whenIdle();
  }

  return result;
};

gateway.invoke = async (path, input, options) => {
  const missingGoal = () => ({
    ok: false as const,
    error: {
      kind: "domain" as const,
      value: "GOAL_NOT_FOUND",
    },
  });

  const missingProof = () => ({
    ok: false as const,
    error: {
      kind: "domain" as const,
      value: "PROOF_NOT_FOUND",
    },
  });

  const goal = guardedGoalId(path, input);

  if (goal) {
    return withExistingGoal(
      db,
      goal,
      async () => {
        const result = await invokeWithValidation(
          path,
          input,
          options,
        );

        if (result.ok) {
          await gateway.whenIdle();
        }

        return result;
      },
      missingGoal,
    );
  }

  if (isProofScopedMutation(path)) {
    const payload = input as {
      previousProof?: unknown;
      proof?: unknown;
    } | null;

    const proofId = path === "/proofs/resubmit"
      ? payload?.previousProof
      : payload?.proof;

    if (typeof proofId !== "string" || !proofId) {
      return invokeWithValidation(
        path,
        input,
        options,
      );
    }

    const proofGoal = await goalForProof(
      db,
      proofId,
    );

    if (!proofGoal) {
      return missingProof();
    }

    return withExistingGoal(
      db,
      proofGoal,
      async () => {
        const stillExists =
          await proofStillBelongsToGoal(
            db,
            proofId,
            proofGoal,
          );

        if (!stillExists) {
          return missingProof();
        }

        const result = await invokeWithValidation(
          path,
          input,
          options,
        );

        if (result.ok) {
          await gateway.whenIdle();
        }

        return result;
      },
      missingGoal,
    );
  }

  return invokeWithValidation(
    path,
    input,
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
      STRATEGY_CHANGED: "CONFLICT",
      INVALID_STRATEGY: "INVALID_REQUEST",

      INVALID_REVIEW: "INVALID_REQUEST",

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
      NOT_PROOF_SUBMITTER: "FORBIDDEN",
      PROOF_HAS_REVIEWS: "CONFLICT",

      GROUP_NOT_FOUND: "NOT_FOUND",
      ALREADY_MEMBER: "CONFLICT",
      NOT_GROUP_MEMBER: "FORBIDDEN",
      GOAL_ALREADY_ATTACHED: "CONFLICT",
      GOAL_NOT_ATTACHED: "CONFLICT",
      PROOF_ALREADY_SHARED: "CONFLICT",

      INVALID_RESULT: "INVALID_REQUEST",
      RESULT_NOT_FOUND: "NOT_FOUND",

      NOT_GROUP_OWNER: "FORBIDDEN",
      INVALID_GROUP_DETAILS: "INVALID_REQUEST",

      NOT_PROOF_AUTHOR: "FORBIDDEN",
      PROOF_NOT_DISPUTED: "CONFLICT",
      PROOF_SUPERSEDED: "CONFLICT",
    },
  }),
});

async function recoverImageCleanup(): Promise<void> {
  try {
    await db.command(
      { ping: 1 },
      { timeoutMS: 5000 },
    );

    const result =
      await cleanupPendingGoalImages(db);

    console.log(
      `[startup] Image cleanup: ` +
      `${result.removed} completed, ` +
      `${result.pending} pending`,
    );
  } catch (error) {
    console.error(
      "[startup] Could not recover image cleanup:",
      error,
    );

    // Startup may continue. Failed jobs remain
    // in MongoDB for later recovery.
  }
}

await recoverImageCleanup();

async function checkProductionMongoDB(): Promise<void> {
  try {
    const info = await db.admin().command({
      hello: 1,
    });

    console.log("[database] Configuration:", {
      replicaSet: info.setName ?? null,
      primary: info.isWritablePrimary ?? false,
      mongos: info.msg === "isdbgrid",
      transactionsSupported:
        Boolean(info.setName || info.msg === "isdbgrid"),
    });
  } catch (error) {
    console.error(
      "[database] Configuration check failed:",
      error,
    );
  }
}

await checkProductionMongoDB();

async function runOrphanImageCleanup(): Promise<void> {
  try {
    const result = await cleanupOrphanImages(db);

    console.log(
      `[image-cleanup] ` +
      `${result.scanned} scanned, ` +
      `${result.removed} removed, ` +
      `${result.retained} retained, ` +
      `${result.failed} failed`,
    );
  } catch (error) {
    console.error(
      "[image-cleanup] Maintenance failed:",
      error,
    );
  }
}

// Run once at startup.
await runOrphanImageCleanup();

// Repeat daily while this server is running.
const orphanCleanupInterval = setInterval(
  () => {
    void runOrphanImageCleanup();
  },
  24 * 60 * 60 * 1000,
);

orphanCleanupInterval.unref();

const server = Bun.serve({
  hostname: process.env.HOST ?? "127.0.0.1",

  port: Number(
    process.env.PORT ?? 3000,
  ),

  async fetch(request) {
    const path = new URL(
      request.url,
    ).pathname;

    if (path === "/health") {
      try {
        await db.command(
          { ping: 1 },
          { timeoutMS: 3000 },
        );

        return Response.json({
          status: "ok",
        });
      } catch {
        return Response.json(
          { status: "unavailable" },
          { status: 503 },
        );
      }
    }

    if (
      path === "/api/groups/leave" ||
      path === "/api/goals/delete"
    ) {
      return handleResourceManagementRequest(
        request,
        (target, body) =>
          invokeGateway(target, body),
      );
    }

    if (
      path.startsWith("/api/images/")
    ) {
      return handleImageRequest(
        request,
        (target, body) =>
          invokeGateway(target, body),
      );
    }

    if (
      path === "/api" ||
      path.startsWith("/api/")
    ) {
      return handler(request);
    }

    return serveFrontend(request);
  },
});

console.log(
  `BetterSelf listening on ${server.url}`,
);
