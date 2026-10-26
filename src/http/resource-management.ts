
import type { Db } from "mongodb";
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

function fail(code: string, status: number): Response {
  return Response.json({ error: code }, { status });
}

async function currentUser(
  invoke: Invoker,
  session: unknown,
): Promise<string | null> {
  if (typeof session !== "string" || !session) {
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

async function leaveGroup(
  database: Db,
  groupId: string,
  user: string,
): Promise<Response> {
  const groups = database.collection<Group>(
    "accountabilityGrouping.groups",
  );

  const memberships = database.collection<{
    group: string;
    user: string;
    createdAt: Date;
  }>("accountabilityGrouping.memberships");

  const group = await groups.findOne({
    _id: groupId,
  });

  if (!group) {
    return fail("GROUP_NOT_FOUND", 404);
  }

  // Older groups did not always store an owner.
  const firstMember = group.owner
    ? null
    : await memberships.findOne(
        { group: groupId },
        { sort: { createdAt: 1 } },
      );

  const owner = group.owner ?? firstMember?.user;

  if (owner === user) {
    return fail("GROUP_OWNER_CANNOT_LEAVE", 409);
  }

  const membership = await memberships.findOne({
    group: groupId,
    user,
  });

  if (!membership) {
    return fail("NOT_GROUP_MEMBER", 403);
  }

  // Remove the departing user's own goal attachments.
  // The actual goals and proofs remain in their concepts.
  const ownedGoals = await database
    .collection<Goal>("goalPlanning.goals")
    .find({ owner: user })
    .project<{ _id: string }>({ _id: 1 })
    .toArray();

  const ownedIds = ownedGoals.map((goal) => goal._id);

  if (ownedIds.length) {
    const attachments = database.collection(
      "accountabilityGrouping.goalAttachments",
    );

    const attached = await attachments
      .find({
        group: groupId,
        goal: { $in: ownedIds },
      })
      .project<{ goal: string }>({ goal: 1 })
      .toArray();

    const attachedIds = attached.map((item) => item.goal);

    if (attachedIds.length) {
      const originalProofs = await database
        .collection<Proof>("proofVerifying.proofs")
        .find({
          goal: { $in: attachedIds },
        })
        .project<{ _id: string }>({ _id: 1 })
        .toArray();

      const retries = await database
        .collection<Proof>("proofVerifying.attempts")
        .find({
          goal: { $in: attachedIds },
        })
        .project<{ _id: string }>({ _id: 1 })
        .toArray();

      const proofIds = [
        ...originalProofs,
        ...retries,
      ].map((item) => item._id);

      if (proofIds.length) {
        await database.collection(
          "accountabilityGrouping.sharedProofs",
        ).deleteMany({
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
    "goalPlanning.goals",
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
  }>("commitmentTracking.commitments");

  const commitmentRows = await commitments
    .find({ goal: goalId })
    .project<{ _id: string }>({ _id: 1 })
    .toArray();

  const commitmentIds = commitmentRows.map(
    (item) => item._id,
  );

  const originals = database.collection<Proof>(
    "proofVerifying.proofs",
  );

  const attempts = database.collection<Proof>(
    "proofVerifying.attempts",
  );

  const [proofRows, attemptRows] = await Promise.all([
    originals.find({ goal: goalId }).toArray(),
    attempts.find({ goal: goalId }).toArray(),
  ]);

  const proofIds = [
    ...proofRows,
    ...attemptRows,
  ].map((item) => item._id);

  // Remove references before removing their source objects.
  if (proofIds.length) {
    await database.collection(
      "accountabilityGrouping.sharedProofs",
    ).deleteMany({
      proof: { $in: proofIds },
    });

    await database.collection(
      "proofVerifying.verifications",
    ).deleteMany({
      proof: { $in: proofIds },
    });
  }

  await database.collection(
    "accountabilityGrouping.goalAttachments",
  ).deleteMany({ goal: goalId });

  if (commitmentIds.length) {
    await database.collection(
      "commitmentTracking.completions",
    ).deleteMany({
      commitment: { $in: commitmentIds },
    });
  }

  await attempts.deleteMany({ goal: goalId });
  await originals.deleteMany({ goal: goalId });

  await commitments.deleteMany({ goal: goalId });

  await database.collection(
    "resultTracking.results",
  ).deleteMany({ goal: goalId });

  await goals.deleteOne({
    _id: goalId,
    owner: user,
  });

  return Response.json({
    goal: goalId,
    deleted: true,
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
    input = await request.json() as Record<string, unknown>;
  } catch {
    return fail("INVALID_REQUEST", 400);
  }

  if (!input || typeof input !== "object") {
    return fail("INVALID_REQUEST", 400);
  }

  const user = await currentUser(invoke, input.session);

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
    console.error("Resource management failed:", error);
    return fail("INTERNAL_ERROR", 500);
  }
}
