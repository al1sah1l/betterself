
import {
  GridFSBucket,
  ObjectId,
  type ClientSession,
  type Db,
} from "mongodb";

import { db as appDb } from "../db.ts";

import {
  withGoalLock,
} from "./goal-operation-lock.ts";

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
 * Queue image cleanup within the deletion transaction.
 *
 * These records are committed together with the
 * goal deletion and survive a server restart.
 */
async function queueImageCleanup(
  database: Db,
  images: ObjectId[],
  session: ClientSession,
): Promise<void> {
  const jobs = database.collection<CleanupJob>(
    C.cleanup,
  );

  for (const imageId of images) {
    const existing = await jobs.findOne(
      { imageId },
      { session },
    );

    if (!existing) {
      await jobs.insertOne(
        {
          _id: new ObjectId(),
          imageId,
          createdAt: new Date(),
        },
        { session },
      );
    }
  }
}

/**
 * Process up to 100 pending GridFS cleanup jobs.
 *
 * A file is only removed when no remaining proof
 * references its image token.
 *
 * Failed jobs remain available for retry.
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

  const bucket = new GridFSBucket(
    database,
    {
      bucketName: "proofImages",
    },
  );

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
        .findOne({
          evidence: token,
        });

      const attempt = await database
        .collection(C.attempts)
        .findOne({
          evidence: token,
        });

      // Keep images that are still referenced.
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
        "GridFS cleanup failed:",
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
 * Perform all MongoDB document changes atomically.
 *
 * Requires MongoDB replica set support.
 *
 * Every database operation inside `operation` must
 * receive the same session.
 */
async function inTransaction<T>(
  database: Db,
  operation: (
    session: ClientSession,
  ) => Promise<T>,
): Promise<T> {
  const session =
    database.client.startSession();

  try {
    return await session.withTransaction(
      async () => operation(session),
      {
        readConcern: {
          level: "snapshot",
        },
        writeConcern: {
          w: "majority",
        },
        readPreference: "primary",
      },
    );
  } finally {
    await session.endSession();
  }
}

/**
 * Leave an accountability group.
 *
 * Preserve the user's personal goals, commitments
 * and proofs. Remove only group membership and
 * references associated with their own goals.
 */
async function leaveGroup(
  database: Db,
  groupId: string,
  user: string,
): Promise<Response> {
  return inTransaction(
    database,
    async (session) => {
      const groups = database.collection<Group>(
        C.groups,
      );

      const memberships = database.collection<{
        group: string;
        user: string;
        createdAt: Date;
      }>(C.members);

      const group = await groups.findOne(
        {
          _id: groupId,
        },
        { session },
      );

      if (!group) {
        return fail("GROUP_NOT_FOUND", 404);
      }

      // Support legacy groups without owner.
      const firstMember = group.owner
        ? null
        : await memberships.findOne(
            {
              group: groupId,
            },
            {
              sort: {
                createdAt: 1,
              },
              session,
            },
          );

      const owner =
        group.owner ?? firstMember?.user;

      if (owner === user) {
        return fail(
          "GROUP_OWNER_CANNOT_LEAVE",
          409,
        );
      }

      const membership =
        await memberships.findOne(
          {
            group: groupId,
            user,
          },
          { session },
        );

      if (!membership) {
        return fail("NOT_GROUP_MEMBER", 403);
      }

      const ownedGoals = await database
        .collection<Goal>(C.goals)
        .find(
          {
            owner: user,
          },
          { session },
        )
        .project<{ _id: string }>({
          _id: 1,
        })
        .toArray();

      const ownedIds = ownedGoals.map(
        (goal) => goal._id,
      );

      if (ownedIds.length) {
        const attachments =
          database.collection(
            C.attachments,
          );

        const attached =
          await attachments
            .find(
              {
                group: groupId,
                goal: {
                  $in: ownedIds,
                },
              },
              { session },
            )
            .project<{
              goal: string;
            }>({
              goal: 1,
            })
            .toArray();

        const attachedIds = attached.map(
          (row) => row.goal,
        );

        if (attachedIds.length) {
          // Do not issue parallel operations
          // using the same MongoDB session.
          const originals = await database
            .collection<Proof>(C.proofs)
            .find(
              {
                goal: {
                  $in: attachedIds,
                },
              },
              { session },
            )
            .toArray();

          const attempts = await database
            .collection<Proof>(C.attempts)
            .find(
              {
                goal: {
                  $in: attachedIds,
                },
              },
              { session },
            )
            .toArray();

          const proofIds = [
            ...originals,
            ...attempts,
          ].map((row) => row._id);

          if (proofIds.length) {
            await database
              .collection(C.shared)
              .deleteMany(
                {
                  group: groupId,
                  proof: {
                    $in: proofIds,
                  },
                },
                { session },
              );
          }

          await attachments.deleteMany(
            {
              group: groupId,
              goal: {
                $in: attachedIds,
              },
            },
            { session },
          );
        }
      }

      // Create a conflict point for concurrent
      // transactions that update this group row.
      await groups.updateOne(
        {
          _id: groupId,
        },
        {
          $set: {
            membershipChangedAt: new Date(),
          },
        },
        { session },
      );

      await memberships.deleteOne(
        {
          group: groupId,
          user,
        },
        { session },
      );

      return Response.json({
        group: groupId,
        left: true,
      });
    },
  );
}

/**
 * Atomically delete a goal and its associated data.
 *
 * GridFS files are cleaned up after commit.
 */
async function deleteGoal(
  database: Db,
  goalId: string,
  user: string,
): Promise<Response> {
  const outcome = await inTransaction(
    database,
    async (session) => {
      const goals = database.collection<Goal>(
        C.goals,
      );

      const goal = await goals.findOne(
        {
          _id: goalId,
        },
        { session },
      );

      if (!goal) {
        return {
          response: fail(
            "GOAL_NOT_FOUND",
            404,
          ),
          deleted: false,
        };
      }

      if (goal.owner !== user) {
        return {
          response: fail(
            "FORBIDDEN",
            403,
          ),
          deleted: false,
        };
      }

      // Competing deletion transactions must
      // write to the same goal document.
      const claimed = await goals.updateOne(
        {
          _id: goalId,
          owner: user,
        },
        {
          $set: {
            deleting: true,
          },
        },
        { session },
      );

      if (claimed.matchedCount !== 1) {
        throw new Error(
          "Goal changed during deletion.",
        );
      }

      const commitments =
        database.collection<Commitment>(
          C.commitments,
        );

      const commitmentRows =
        await commitments
          .find(
            {
              goal: goalId,
            },
            { session },
          )
          .project<{
            _id: string;
          }>({
            _id: 1,
          })
          .toArray();

      const commitmentIds =
        commitmentRows.map(
          (row) => row._id,
        );

      const originals =
        database.collection<Proof>(
          C.proofs,
        );

      const attempts =
        database.collection<Proof>(
          C.attempts,
        );

      const proofRows = await originals
        .find(
          {
            goal: goalId,
          },
          { session },
        )
        .toArray();

      const attemptRows = await attempts
        .find(
          {
            goal: goalId,
          },
          { session },
        )
        .toArray();

      const allProofs = [
        ...proofRows,
        ...attemptRows,
      ];

      const proofIds = allProofs.map(
        (row) => row._id,
      );

      // Save cleanup jobs inside the transaction.
      await queueImageCleanup(
        database,
        imageIdsFromProofs(allProofs),
        session,
      );

      if (proofIds.length) {
        await database
          .collection(C.shared)
          .deleteMany(
            {
              proof: {
                $in: proofIds,
              },
            },
            { session },
          );

        await database
          .collection(C.reviews)
          .deleteMany(
            {
              proof: {
                $in: proofIds,
              },
            },
            { session },
          );
      }

      await database
        .collection(C.attachments)
        .deleteMany(
          {
            goal: goalId,
          },
          { session },
        );

      if (commitmentIds.length) {
        await database
          .collection(C.completions)
          .deleteMany(
            {
              commitment: {
                $in: commitmentIds,
              },
            },
            { session },
          );
      }

      await attempts.deleteMany(
        {
          goal: goalId,
        },
        { session },
      );

      await originals.deleteMany(
        {
          goal: goalId,
        },
        { session },
      );

      await commitments.deleteMany(
        {
          goal: goalId,
        },
        { session },
      );

      await database
        .collection(C.results)
        .deleteMany(
          {
            goal: goalId,
          },
          { session },
        );

      const deleted = await goals.deleteOne(
        {
          _id: goalId,
          owner: user,
        },
        { session },
      );

      if (deleted.deletedCount !== 1) {
        throw new Error(
          "Goal deletion could not be committed.",
        );
      }

      return {
        response: Response.json({
          goal: goalId,
          deleted: true,
        }),
        deleted: true,
      };
    },
  );

  if (outcome.deleted) {
    try {
      await cleanupPendingGoalImages(database);
    } catch (error) {
      // Goal deletion already committed.
      // Cleanup jobs survive for startup recovery.
      console.error(
        "Post-commit image cleanup failed:",
        error,
      );
    }
  }

  return outcome.response;
}

/**
 * HTTP endpoints:
 *   POST /api/groups/leave
 *   POST /api/goals/delete
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
    input = await request.json() as Record<
      string,
      unknown
    >;
  } catch {
    return fail(
      "INVALID_REQUEST",
      400,
    );
  }

  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input)
  ) {
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
    if (
      path === "/api/groups/leave"
    ) {
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

    if (
      path === "/api/goals/delete"
    ) {
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

      // Change 012:
      // Wait for earlier goal operations before
      // entering the deletion transaction.
      return await withGoalLock(
        goalId,
        () => deleteGoal(
          database,
          goalId,
          user,
        ),
      );
    }

    return fail(
      "NOT_FOUND",
      404,
    );
  } catch (error) {
    console.error(
      "Resource management transaction failed:",
      error,
    );

    return fail(
      "INTERNAL_ERROR",
      500,
    );
  }
}
