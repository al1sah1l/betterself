
import {
  GridFSBucket,
  ObjectId,
  type Db,
} from "mongodb";

import { db as appDb } from "../db.ts";
import { withGoalLock } from "./goal-operation-lock.ts";

type Invoker = (
  path: string,
  input: Record<string, unknown>,
) => Promise<unknown>;

type AuthResponse = {
  ok?: boolean;
  value?: {
    account?: string;
  };
};

type Group = {
  _id: string;
  owner?: string;
};

type Goal = {
  _id: string;
  owner: string;
  deleting?: boolean;
};

type Commitment = {
  _id: string;
  goal: string;
};

type Proof = {
  _id: string;
  goal: string;
  evidence?: string[];
};

type CleanupJob = {
  _id: ObjectId;
  imageId: ObjectId;
  createdAt: Date;
};

const C = {
  groups: "accountabilityGrouping.groups",
  members: "accountabilityGrouping.memberships",
  attachments: "accountabilityGrouping.goalAttachments",
  shared: "accountabilityGrouping.sharedProofs",
  goals: "goalPlanning.goals",
  commitments: "commitmentTracking.commitments",
  completions: "commitmentTracking.completions",
  proofs: "proofVerifying.proofs",
  attempts: "proofVerifying.attempts",
  reviews: "proofVerifying.verifications",
  results: "resultTracking.results",
  imageOwners: "proofImageOwners",
  cleanup: "maintenance.imageCleanup",
  priorities: "userPriorityGoals",
} as const;

const IMAGE_TOKEN = /^image:([0-9a-f]{24})$/;

function fail(
  code: string,
  status: number,
): Response {
  return Response.json(
    { error: code },
    { status },
  );
}

async function currentUser(
  invoke: Invoker,
  session: unknown,
): Promise<string | null> {
  if (
    typeof session !== "string" ||
    !session
  ) {
    return null;
  }

  try {
    const response = await invoke(
      "/auth/current",
      { session },
    ) as AuthResponse;

    return response.ok === true &&
      typeof response.value?.account === "string"
      ? response.value.account
      : null;
  } catch {
    return null;
  }
}

function imageIdsFromProofs(
  proofs: Proof[],
): ObjectId[] {
  const ids = new Set<string>();

  for (const proof of proofs) {
    for (const evidence of proof.evidence ?? []) {
      const match = IMAGE_TOKEN.exec(evidence);

      if (match) {
        ids.add(match[1]);
      }
    }
  }

  return [...ids].map(
    (id) => new ObjectId(id),
  );
}

/**
 * Queue GridFS cleanup before deleting proof records.
 *
 * This works on standalone MongoDB.
 *
 * A queue entry survives an interrupted deletion
 * so a later cleanup attempt can retry.
 */
async function queueImageCleanup(
  database: Db,
  images: ObjectId[],
): Promise<void> {
  const jobs = database.collection<CleanupJob>(
    C.cleanup,
  );

  for (const imageId of images) {
    const existing = await jobs.findOne({
      imageId,
    });

    if (!existing) {
      await jobs.insertOne({
        _id: new ObjectId(),
        imageId,
        createdAt: new Date(),
      });
    }
  }
}

/**
 * Process pending GridFS cleanup jobs.
 *
 * An image is retained while it is referenced
 * by any remaining proof or resubmission.
 *
 * This operation is best-effort and retryable.
 */
export async function cleanupPendingGoalImages(
  database: Db,
): Promise<{
  removed: number;
  pending: number;
}> {
  const jobs = database.collection<CleanupJob>(
    C.cleanup,
  );

  const bucket = new GridFSBucket(database, {
    bucketName: "proofImages",
  });

  const pendingJobs = await jobs
    .find({})
    .sort({ createdAt: 1 })
    .limit(100)
    .toArray();

  let removed = 0;

  for (const job of pendingJobs) {
    const token =
      `image:${job.imageId.toHexString()}`;

    try {
      const original = await database
        .collection(C.proofs)
        .findOne({ evidence: token });

      const attempt = await database
        .collection(C.attempts)
        .findOne({ evidence: token });

      if (original || attempt) {
        continue;
      }

      const storedFile = await database
        .collection("proofImages.files")
        .findOne({
          _id: job.imageId,
        });

      if (storedFile) {
        await bucket.delete(job.imageId);
      }

      await database
        .collection(C.imageOwners)
        .deleteOne({
          _id: job.imageId,
        });

      await jobs.deleteOne({
        _id: job._id,
      });

      removed += 1;
    } catch (error) {
      console.error(
        "[image-cleanup] Failed:",
        job.imageId.toHexString(),
        error,
      );
    }
  }

  return {
    removed,
    pending: await jobs.countDocuments(),
  };
}

/**
 * Leave an accountability group using ordinary
 * MongoDB operations.
 *
 * The membership is removed last so that
 * a failed cleanup can be retried.
 */
async function leaveGroup(
  database: Db,
  groupId: string,
  user: string,
): Promise<Response> {
  const groups = database.collection<Group>(
    C.groups,
  );

  const memberships = database.collection<{
    group: string;
    user: string;
    createdAt: Date;
  }>(C.members);

  const group = await groups.findOne({
    _id: groupId,
  });

  if (!group) {
    return fail("GROUP_NOT_FOUND", 404);
  }

  // Older groups may not store an explicit owner.
  const firstMember = group.owner
    ? null
    : await memberships.findOne(
        { group: groupId },
        { sort: { createdAt: 1 } },
      );

  const owner =
    group.owner ?? firstMember?.user;

  if (owner === user) {
    return fail(
      "GROUP_OWNER_CANNOT_LEAVE",
      409,
    );
  }

  const membership = await memberships.findOne({
    group: groupId,
    user,
  });

  if (!membership) {
    return fail("NOT_GROUP_MEMBER", 403);
  }

  const ownedGoals = await database
    .collection<Goal>(C.goals)
    .find({ owner: user })
    .project<{ _id: string }>({
      _id: 1,
    })
    .toArray();

  const ownedIds = ownedGoals.map(
    (goal) => goal._id,
  );

  if (ownedIds.length > 0) {
    const attachments = database.collection(
      C.attachments,
    );

    const attached = await attachments
      .find({
        group: groupId,
        goal: { $in: ownedIds },
      })
      .project<{ goal: string }>({
        goal: 1,
      })
      .toArray();

    const attachedIds = attached.map(
      (row) => row.goal,
    );

    if (attachedIds.length > 0) {
      const originals = await database
        .collection<Proof>(C.proofs)
        .find({
          goal: { $in: attachedIds },
        })
        .toArray();

      const attempts = await database
        .collection<Proof>(C.attempts)
        .find({
          goal: { $in: attachedIds },
        })
        .toArray();

      const proofIds = [
        ...originals,
        ...attempts,
      ].map((row) => row._id);

      if (proofIds.length > 0) {
        await database
          .collection(C.shared)
          .deleteMany({
            group: groupId,
            proof: { $in: proofIds },
          });
      }

      await attachments.deleteMany({
        group: groupId,
        goal: { $in: attachedIds },
      });
    }
  }

  // Final step: remove this person's membership.
  await memberships.deleteOne({
    group: groupId,
    user,
  });

  return Response.json({
    group: groupId,
    left: true,
  });
}

/**
 * Delete a goal using ordinary MongoDB operations.
 *
 * Compatible with standalone MongoDB.
 *
 * The goal is deleted last. If an intermediate
 * operation fails, retrying this endpoint can
 * continue cleanup while the goal still exists.
 *
 * This is NOT a multi-document transaction.
 */
async function deleteGoal(
  database: Db,
  goalId: string,
  user: string,
): Promise<Response> {
  const goals = database.collection<Goal>(
    C.goals,
  );

  const goal = await goals.findOne({
    _id: goalId,
  });

  if (!goal) {
    return fail("GOAL_NOT_FOUND", 404);
  }

  if (goal.owner !== user) {
    return fail("FORBIDDEN", 403);
  }

  // Mark deletion intent.
  // Repeating this update is safe on retry.
  await goals.updateOne(
    {
      _id: goalId,
      owner: user,
    },
    {
      $set: {
        deleting: true,
      },
    },
  );

  const commitments =
    database.collection<Commitment>(
      C.commitments,
    );

  const commitmentRows = await commitments
    .find({ goal: goalId })
    .project<{ _id: string }>({
      _id: 1,
    })
    .toArray();

  const commitmentIds = commitmentRows.map(
    (row) => row._id,
  );

  const originals = database.collection<Proof>(
    C.proofs,
  );

  const attempts = database.collection<Proof>(
    C.attempts,
  );

  const proofRows = await originals
    .find({ goal: goalId })
    .toArray();

  const attemptRows = await attempts
    .find({ goal: goalId })
    .toArray();

  const allProofs = [
    ...proofRows,
    ...attemptRows,
  ];

  const proofIds = allProofs.map(
    (proof) => proof._id,
  );

  /*
   * Save image cleanup jobs BEFORE deleting
   * any proof records.
   */
  await queueImageCleanup(
    database,
    imageIdsFromProofs(allProofs),
  );

  /*
   * Remove references to proofs before removing
   * the proof documents themselves.
   */
  if (proofIds.length > 0) {
    await database
      .collection(C.shared)
      .deleteMany({
        proof: { $in: proofIds },
      });

    await database
      .collection(C.reviews)
      .deleteMany({
        proof: { $in: proofIds },
      });
  }

  await database
    .collection(C.attachments)
    .deleteMany({
      goal: goalId,
    });

  if (commitmentIds.length > 0) {
    await database
      .collection(C.completions)
      .deleteMany({
        commitment: {
          $in: commitmentIds,
        },
      });
  }

  await attempts.deleteMany({
    goal: goalId,
  });

  await originals.deleteMany({
    goal: goalId,
  });

  await commitments.deleteMany({
    goal: goalId,
  });

  await database
    .collection(C.results)
    .deleteMany({
      goal: goalId,
    });

  /*
   * Clear the user's selected priority if this
   * goal was their priority.
   */
  await database
    .collection<{
        _id: string;
        goal: string;
    }>(C.priorities)
    .deleteOne({
        _id: user,
        goal: goalId,
    });

  /*
   * Delete the goal last.
   *
   * This also serves as the final success marker
   * for the endpoint.
   */
  const deleted = await goals.deleteOne({
    _id: goalId,
    owner: user,
  });

  if (deleted.deletedCount !== 1) {
    throw new Error(
      "Goal deletion could not be completed.",
    );
  }

  /*
   * Once the goal is deleted, image cleanup may
   * proceed. Cleanup errors do not undo deletion.
   */
  try {
    await cleanupPendingGoalImages(database);
  } catch (error) {
    console.error(
      "[goal-delete] Image cleanup failed:",
      error,
    );
  }

  return Response.json({
    goal: goalId,
    deleted: true,
  });
}

/**
 * HTTP endpoints:
 * POST /api/groups/leave
 * POST /api/goals/delete
 *
 * Authentication is required for both.
 */
export async function handleResourceManagementRequest(
  request: Request,
  invoke: Invoker,
  database: Db = appDb,
): Promise<Response> {
  if (request.method !== "POST") {
    return fail(
      "METHOD_NOT_ALLOWED",
      405,
    );
  }

  let input: Record<string, unknown>;

  try {
    const parsed: unknown = await request.json();

    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return fail(
        "INVALID_REQUEST",
        400,
      );
    }

    input = parsed as Record<string, unknown>;
  } catch {
    return fail(
      "INVALID_REQUEST",
      400,
    );
  }

  const user = await currentUser(
    invoke,
    input.session,
  );

  if (!user) {
    return fail(
      "UNAUTHORIZED",
      401,
    );
  }

  const path = new URL(
    request.url,
  ).pathname;

  try {
    if (path === "/api/groups/leave") {
      if (
        typeof input.group !== "string" ||
        !input.group.trim()
      ) {
        return fail(
          "INVALID_REQUEST",
          400,
        );
      }

      return await leaveGroup(
        database,
        input.group,
        user,
      );
    }

    if (path === "/api/goals/delete") {
      if (
        typeof input.goal !== "string" ||
        !input.goal.trim()
      ) {
        return fail(
          "INVALID_REQUEST",
          400,
        );
      }

      const goalId = input.goal;

      return withGoalLock(
        goalId,
        () => deleteGoal(
          database,
          goalId,
          user,
        ),
      );
    }

    return fail("NOT_FOUND", 404);
  } catch (error) {
    console.error(
      "[resource-management] Failed:",
      error,
    );

    return fail(
      "INTERNAL_ERROR",
      500,
    );
  }
}
