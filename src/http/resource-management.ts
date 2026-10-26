
import {
  GridFSBucket,
  ObjectId,
  type Db,
} from "mongodb";

import { db as appDb } from "../db.ts";

type Invoker = (
  path: string,
  input: Record<string, unknown>,
) => Promise<unknown>;

type AuthResponse = {
  ok?: boolean;
  value?: { account?: string };
};

type Group = {
  _id: string;
  owner?: string;
};

type Goal = {
  _id: string;
  owner: string;
};

type Proof = {
  _id: string;
  goal: string;
  evidence?: string[];
};

type ImageCleanupJob = {
  _id: ObjectId;
  imageId: ObjectId;
  createdAt: Date;
};

const IMAGE_PATTERN = /^image:([0-9a-f]{24})$/;

const COLLECTIONS = {
  groups: "accountabilityGrouping.groups",
  memberships: "accountabilityGrouping.memberships",
  attachments: "accountabilityGrouping.goalAttachments",
  shared: "accountabilityGrouping.sharedProofs",
  goals: "goalPlanning.goals",
  commitments: "commitmentTracking.commitments",
  completions: "commitmentTracking.completions",
  proofs: "proofVerifying.proofs",
  attempts: "proofVerifying.attempts",
  verifications: "proofVerifying.verifications",
  results: "resultTracking.results",
  imageOwners: "proofImageOwners",
  cleanup: "maintenance.imageCleanup",
} as const;

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
    for (const item of proof.evidence ?? []) {
      const match = IMAGE_PATTERN.exec(item);

      if (match) {
        ids.add(match[1]);
      }
    }
  }

  return [...ids].map(
    (value) => new ObjectId(value),
  );
}

/**
 * Queue images before removing their proof references.
 *
 * The queue survives a server restart. It is processed
 * after the database records have been deleted.
 */
async function queueImageCleanup(
  database: Db,
  imageIds: ObjectId[],
): Promise<void> {
  if (!imageIds.length) return;

  const jobs = database.collection<ImageCleanupJob>(
    COLLECTIONS.cleanup,
  );

  for (const imageId of imageIds) {
    const existing = await jobs.findOne({
      imageId,
    });

    if (existing) continue;

    await jobs.insertOne({
      _id: new ObjectId(),
      imageId,
      createdAt: new Date(),
    });
  }
}

/**
 * Process pending image deletions.
 *
 * If another existing proof still references an image,
 * that image is retained. A failure leaves its cleanup
 * job in MongoDB so the operation can be retried.
 */
export async function cleanupPendingGoalImages(
  database: Db,
): Promise<{
  removed: number;
  pending: number;
}> {
  const jobs = database.collection<ImageCleanupJob>(
    COLLECTIONS.cleanup,
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
      const [original, attempt] =
        await Promise.all([
          database
            .collection(COLLECTIONS.proofs)
            .findOne({ evidence: token }),

          database
            .collection(COLLECTIONS.attempts)
            .findOne({ evidence: token }),
        ]);

      // The image is still used by another proof.
      // Do not delete it or discard the cleanup job:
      // it can be reconsidered after that proof is removed.
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
        .collection(COLLECTIONS.imageOwners)
        .deleteOne({
          _id: job.imageId,
        });

      await jobs.deleteOne({
        _id: job._id,
      });

      removed += 1;
    } catch (error) {
      console.error(
        "Could not finish image cleanup:",
        job.imageId.toHexString(),
        error,
      );
      // Keep the job for a future retry.
    }
  }

  return {
    removed,
    pending: await jobs.countDocuments(),
  };
}

async function leaveGroup(
  database: Db,
  groupId: string,
  user: string,
): Promise<Response> {
  const groups = database.collection<Group>(
    COLLECTIONS.groups,
  );

  const memberships = database.collection<{
    group: string;
    user: string;
    createdAt: Date;
  }>(COLLECTIONS.memberships);

  const group = await groups.findOne({
    _id: groupId,
  });

  if (!group) {
    return fail("GROUP_NOT_FOUND", 404);
  }

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
    .collection<Goal>(COLLECTIONS.goals)
    .find({ owner: user })
    .project<{ _id: string }>({ _id: 1 })
    .toArray();

  const ownedIds = ownedGoals.map(
    (goal) => goal._id,
  );

  if (ownedIds.length) {
    const attachments = database.collection(
      COLLECTIONS.attachments,
    );

    const attached = await attachments
      .find({
        group: groupId,
        goal: { $in: ownedIds },
      })
      .project<{ goal: string }>({ goal: 1 })
      .toArray();

    const attachedIds = attached.map(
      (item) => item.goal,
    );

    if (attachedIds.length) {
      const [originals, retries] =
        await Promise.all([
          database
            .collection<Proof>(COLLECTIONS.proofs)
            .find({
              goal: { $in: attachedIds },
            })
            .toArray(),

          database
            .collection<Proof>(COLLECTIONS.attempts)
            .find({
              goal: { $in: attachedIds },
            })
            .toArray(),
        ]);

      const proofIds = [
        ...originals,
        ...retries,
      ].map((item) => item._id);

      if (proofIds.length) {
        await database
          .collection(COLLECTIONS.shared)
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

  await memberships.deleteOne({
    group: groupId,
    user,
  });

  return Response.json({
    group: groupId,
    left: true,
  });
}

async function deleteGoal(
  database: Db,
  goalId: string,
  user: string,
): Promise<Response> {
  const goals = database.collection<Goal>(
    COLLECTIONS.goals,
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

  const commitments = database.collection<{
    _id: string;
    goal: string;
  }>(COLLECTIONS.commitments);

  const commitmentRows = await commitments
    .find({ goal: goalId })
    .project<{ _id: string }>({ _id: 1 })
    .toArray();

  const commitmentIds = commitmentRows.map(
    (item) => item._id,
  );

  const originals = database.collection<Proof>(
    COLLECTIONS.proofs,
  );

  const attempts = database.collection<Proof>(
    COLLECTIONS.attempts,
  );

  const [proofRows, attemptRows] =
    await Promise.all([
      originals.find({ goal: goalId }).toArray(),
      attempts.find({ goal: goalId }).toArray(),
    ]);

  const allProofs = [
    ...proofRows,
    ...attemptRows,
  ];

  const proofIds = allProofs.map(
    (item) => item._id,
  );

  // Durable cleanup jobs are saved BEFORE proofs
  // are removed, while image references still exist.
  const imageIds = imageIdsFromProofs(allProofs);

  await queueImageCleanup(
    database,
    imageIds,
  );

  // Remove references before source records.
  if (proofIds.length) {
    await database
      .collection(COLLECTIONS.shared)
      .deleteMany({
        proof: { $in: proofIds },
      });

    await database
      .collection(COLLECTIONS.verifications)
      .deleteMany({
        proof: { $in: proofIds },
      });
  }

  await database
    .collection(COLLECTIONS.attachments)
    .deleteMany({
      goal: goalId,
    });

  if (commitmentIds.length) {
    await database
      .collection(COLLECTIONS.completions)
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
    .collection(COLLECTIONS.results)
    .deleteMany({
      goal: goalId,
    });

  // Delete the goal last.
  await goals.deleteOne({
    _id: goalId,
    owner: user,
  });

  const cleanup =
    await cleanupPendingGoalImages(database);

  return Response.json({
    goal: goalId,
    deleted: true,
    imageCleanupPending: cleanup.pending,
  });
}

export async function handleResourceManagementRequest(
  request: Request,
  invoke: Invoker,
  database: Db = appDb,
): Promise<Response> {
  if (request.method !== "POST") {
    return fail("METHOD_NOT_ALLOWED", 405);
  }

  let input: Record<string, unknown>;

  try {
    input =
      await request.json() as Record<string, unknown>;
  } catch {
    return fail("INVALID_REQUEST", 400);
  }

  if (
    !input ||
    typeof input !== "object"
  ) {
    return fail("INVALID_REQUEST", 400);
  }

  const user = await currentUser(
    invoke,
    input.session,
  );

  if (!user) {
    return fail("UNAUTHORIZED", 401);
  }

  const path = new URL(request.url).pathname;

  try {
    if (path === "/api/groups/leave") {
      if (
        typeof input.group !== "string" ||
        !input.group
      ) {
        return fail("INVALID_REQUEST", 400);
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
        !input.goal
      ) {
        return fail("INVALID_REQUEST", 400);
      }

      return await deleteGoal(
        database,
        input.goal,
        user,
      );
    }

    return fail("NOT_FOUND", 404);
  } catch (error) {
    console.error(
      "Resource management failed:",
      error,
    );

    return fail("INTERNAL_ERROR", 500);
  }
}
