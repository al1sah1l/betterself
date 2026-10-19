import {
  afterAll,
  beforeAll,
  beforeEach,
  expect,
  test,
} from "bun:test";

import { assemble } from "@mit-sdg/sync-engine/assembly";

import {
  applicationConceptSet,
} from "../../src/concepts.ts";

import {
  GoalResults,
  RecordResult,
  ListGoalResults,
  RemoveResult,
} from "../../src/compositions/results.ts";

import {
  openTestDb,
  type TestDb,
} from "../test-db.ts";

let testDb: TestDb;

beforeAll(async () => {
  testDb = await openTestDb();
}, 120_000);

beforeEach(async () => {
  await testDb.db.dropDatabase();
});

afterAll(async () => {
  await testDb.close();
});

function makeApp() {
  return assemble({
    conceptSet: applicationConceptSet,

    instances:
      applicationConceptSet.implementations("mongo", {
        db: testDb.db,
      }),

    composition: {
      BetterSelf: {
        results: {
          GoalResults,
          RecordResult,
          ListGoalResults,
          RemoveResult,
        },
      },
    },
  });
}

async function setup() {
  const app = makeApp();

  const created =
    await app.concepts.GoalPlanning.createGoal({
      owner: "maya",
      outcome: "Find an internship",
      currentContext: "Applying",
      constraints: "Five hours weekly",
      timeline: "Summer",
      successDefinition: "Accept an offer",
    });

  const maya =
    await app.concepts.Sessioning.start({
      subject: "maya",
    });

  const alex =
    await app.concepts.Sessioning.start({
      subject: "alex",
    });

  if (
    !("goal" in created) ||
    typeof created.goal !== "string" ||
    !("session" in maya) ||
    typeof maya.session !== "string" ||
    !("session" in alex) ||
    typeof alex.session !== "string"
  ) {
    throw new Error("Setup failed.");
  }

  return {
    app,
    goal: created.goal,
    session: maya.session,
    otherSession: alex.session,
  };
}

test("owner records, reads, and removes a result", async () => {
  const { app, goal, session } = await setup();

  const added = await app.invoker.invoke(
    "/results/record",
    {
      session,
      goal,
      description: "Two interview invitations",
      observedOn: "2026-10-19",
      user: "alex",
    },
  );

  if (!added.ok) {
    throw new Error(JSON.stringify(added.error));
  }

  const rows =
    await app.concepts.ResultTracking._resultsByGoal({
      goal,
    });

  expect(rows).toHaveLength(1);

  const result = rows[0]!.result;

  expect(
    await app.invoker.invoke("/dashboard/results", {
      session,
      goal,
    }),
  ).toEqual({
    ok: true,
    value: {
      results: rows,
    },
  });

  const removed = await app.invoker.invoke(
    "/results/remove",
    {
      session,
      goal,
      result,
    },
  );

  expect(removed.ok).toBe(true);

  expect(
    await app.concepts.ResultTracking._resultsByGoal({
      goal,
    }),
  ).toEqual([]);
});

test("another user cannot record, read, or remove observations", async () => {
  const {
    app,
    goal,
    otherSession,
  } = await setup();

  const saved =
    await app.concepts.ResultTracking.recordResult({
      goal,
      description: "Interview",
      observedOn: "2026-10-19",
    });

  if (
    !("result" in saved) ||
    typeof saved.result !== "string"
  ) {
    throw new Error("Setup failed.");
  }

  for (const path of [
    "/results/record",
    "/dashboard/results",
    "/results/remove",
  ]) {
    const response = await app.invoker.invoke(
      path,
      {
        session: otherSession,
        goal,
        result: saved.result,
        description: "Fake",
        observedOn: "2026-10-19",
        user: "maya",
      },
    );

    expect(response).toEqual({
      ok: false,
      error: {
        kind: "domain",
        value: "FORBIDDEN",
      },
    });
  }

  expect(
    await app.concepts.ResultTracking._resultsByGoal({
      goal,
    }),
  ).toHaveLength(1);
});

test("missing goal is refused on every endpoint", async () => {
  const { app, session } = await setup();

  for (const path of [
    "/results/record",
    "/dashboard/results",
    "/results/remove",
  ]) {
    expect(
      await app.invoker.invoke(path, {
        session,
        goal: "missing",
        result: "missing",
        description: "Interview",
        observedOn: "2026-10-19",
      }),
    ).toEqual({
      ok: false,
      error: {
        kind: "domain",
        value: "GOAL_NOT_FOUND",
      },
    });
  }
});

test("invalid session cannot read or change observations", async () => {
  const { app, goal } = await setup();

  for (const path of [
    "/results/record",
    "/dashboard/results",
    "/results/remove",
  ]) {
    const response = await app.invoker.invoke(
      path,
      {
        session: "invalid",
        goal,
        result: "missing",
        description: "Fake",
        observedOn: "2026-10-19",
      },
      {
        timeoutMs: 1000,
      },
    );

    expect(response.ok).toBe(false);
  }

  expect(
    await app.concepts.ResultTracking._resultsByGoal({
      goal,
    }),
  ).toEqual([]);
});
