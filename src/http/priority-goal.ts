
import type { Db } from "mongodb";
import { db as appDb } from "../db.ts";
import { withGoalLock } from "./goal-operation-lock.ts";

type Invoker = (
  path: string,
  input: Record<string, unknown>,
) => Promise<unknown>;

type Goal = {
  _id: string;
  owner: string;
};

type UserPriority = {
  _id: string;
  goal: string;
  updatedAt: Date;
};

function failure(
  error: string,
  status: number,
): Response {
  return Response.json({ error }, { status });
}

async function currentAccount(
  invoke: Invoker,
  session: unknown,
): Promise<string | null> {
  if (typeof session !== "string" || !session) {
    return null;
  }

  try {
    const response = (await invoke(
      "/auth/current",
      { session },
    )) as {
      ok?: boolean;
      value?: { account?: string };
    };

    if (
      response.ok === true &&
      typeof response.value?.account === "string"
    ) {
      return response.value.account;
    }
  } catch {
    // Invalid or expired session.
  }

  return null;
}

export async function handlePriorityGoalRequest(
  request: Request,
  invoke: Invoker,
  database: Db = appDb,
): Promise<Response> {
  if (request.method !== "POST") {
    return failure("METHOD_NOT_ALLOWED", 405);
  }

  let input: Record<string, unknown>;

  try {
    const parsed: unknown = await request.json();

    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return failure("INVALID_REQUEST", 400);
    }

    input = parsed as Record<string, unknown>;
  } catch {
    return failure("INVALID_REQUEST", 400);
  }

  const account = await currentAccount(
    invoke,
    input.session,
  );

  if (!account) {
    return failure("UNAUTHORIZED", 401);
  }

  const path = new URL(request.url).pathname;

  const priorities =
    database.collection<UserPriority>(
      "userPriorityGoals",
    );

  const goals = database.collection<Goal>(
    "goalPlanning.goals",
  );

  if (path === "/api/goals/priority") {
    const saved = await priorities.findOne({
      _id: account,
    });

    if (!saved) {
      return Response.json({ goal: null });
    }

    const existing = await goals.findOne({
      _id: saved.goal,
      owner: account,
    });

    return Response.json({
      goal: existing ? saved.goal : null,
    });
  }

  if (path === "/api/goals/set-priority") {
    if (!("goal" in input)) {
      return failure("INVALID_REQUEST", 400);
    }

    if (input.goal === null) {
      await priorities.deleteOne({
        _id: account,
      });

      return Response.json({ goal: null });
    }

    if (
      typeof input.goal !== "string" ||
      !input.goal.trim()
    ) {
      return failure("INVALID_REQUEST", 400);
    }

    const goalId = input.goal;

    // Coordinate with deletion of the same goal
    // inside this backend process.
    return withGoalLock(goalId, async () => {
      const goal = await goals.findOne({
        _id: goalId,
        owner: account,
      });

      if (!goal) {
        return failure("GOAL_NOT_FOUND", 404);
      }

      await priorities.updateOne(
        { _id: account },
        {
          $set: {
            goal: goalId,
            updatedAt: new Date(),
          },
        },
        { upsert: true },
      );

      return Response.json({
        goal: goalId,
      });
    });
  }

  return failure("NOT_FOUND", 404);
}
