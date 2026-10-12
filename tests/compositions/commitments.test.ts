import {
  afterAll,
  beforeAll,
  beforeEach,
  expect,
  test,
} from "bun:test";

import { assemble } from "@mit-sdg/sync-engine/assembly";

import { applicationConceptSet } from "../../src/concepts.ts";
import { CreateCommitment } from "../../src/compositions/commitments.ts";

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

function assembleTestApplication() {
  const instances =
    applicationConceptSet.implementations("mongo", {
      db: testDb.db,
    });

  return assemble({
    conceptSet: applicationConceptSet,
    instances,

    composition: {
      BetterSelf: {
        commitments: {
          CreateCommitment,
        },
      },
    },
  });
}

async function createSession(
  app: ReturnType<typeof assembleTestApplication>,
  subject: string,
) {
  const result =
    await app.concepts.Sessioning.start({
      subject,
    });

  if (
    typeof result !== "object" ||
    result === null ||
    !("session" in result) ||
    typeof result.session !== "string"
  ) {
    throw new Error("Could not create session.");
  }

  return result.session;
}

async function createGoal(
  app: ReturnType<typeof assembleTestApplication>,
  owner: string,
) {
  const result =
    await app.concepts.GoalPlanning.createGoal({
      owner,
      outcome: "Get a software engineering internship",
      currentContext:
        "Preparing for software engineering recruiting.",
      constraints:
        "Five hours per week.",
      timeline: "By summer 2027",
      successDefinition:
        "Receive and accept an internship offer.",
    });

  if (
    typeof result !== "object" ||
    result === null ||
    !("goal" in result) ||
    typeof result.goal !== "string"
  ) {
    throw new Error("Could not create goal.");
  }

  return result.goal;
}

type CreateCommitmentResponse = {
  commitment: string;
};

test("goal owner can create a recurring commitment", async () => {
  const app = assembleTestApplication();

  const goal = await createGoal(
    app,
    "maya",
  );

  const session = await createSession(
    app,
    "maya",
  );

  const result = await app.invoker.invoke(
    "/commitments/create",
    {
      session,
      goal,
      description:
        "Apply to five internships",
      recurring: true,
      schedule: "Every Monday",
    },
  );

  if (!result.ok) {
    throw new Error(
      JSON.stringify(result.error),
    );
  }

  const value =
    result.value as CreateCommitmentResponse;

  expect(typeof value.commitment).toBe(
    "string",
  );

  const commitments =
    await app.concepts.CommitmentTracking._commitment({
      commitment: value.commitment,
    });

  expect(commitments).toHaveLength(1);

  expect(commitments[0]).toEqual({
    goal,
    description:
      "Apply to five internships",
    recurring: true,
    schedule: "Every Monday",
    active: true,
  });
});

test("client cannot spoof ownership when creating a commitment", async () => {
  const app = assembleTestApplication();

  const goal = await createGoal(
    app,
    "maya",
  );

  const session = await createSession(
    app,
    "maya",
  );

  const result = await app.invoker.invoke(
    "/commitments/create",
    {
      session,

      // Must be ignored by the endpoint.
      user: "alex",

      goal,
      description:
        "Send three networking messages",
      recurring: false,
      schedule: "October 15",
    },
  );

  if (!result.ok) {
    throw new Error(
      JSON.stringify(result.error),
    );
  }

  const value =
    result.value as CreateCommitmentResponse;

  const commitments =
    await app.concepts.CommitmentTracking._commitment({
      commitment: value.commitment,
    });

  expect(commitments).toHaveLength(1);

  expect(commitments[0]).toMatchObject({
    goal,
    description:
      "Send three networking messages",
  });
});

test("user cannot create commitment for another user's goal", async () => {
  const app = assembleTestApplication();

  const goal = await createGoal(
    app,
    "maya",
  );

  const alexSession = await createSession(
    app,
    "alex",
  );

  const result = await app.invoker.invoke(
    "/commitments/create",
    {
      session: alexSession,
      goal,
      description:
        "Alex should not be able to create this",
      recurring: false,
      schedule: "October 15",
    },
  );

  expect(result.ok).toBe(false);

  if (result.ok) {
    throw new Error(
      "Expected commitment creation to be forbidden.",
    );
  }

  expect(result.error).toEqual({
    kind: "domain",
    value: "FORBIDDEN",
  });

  const commitments =
    await app.concepts.CommitmentTracking._commitmentsByGoal({
      goal,
    });

  expect(commitments).toEqual([]);
});

test("creating commitment for missing goal returns GOAL_NOT_FOUND", async () => {
  const app = assembleTestApplication();

  const session = await createSession(
    app,
    "maya",
  );

  const result = await app.invoker.invoke(
    "/commitments/create",
    {
      session,
      goal: "missing-goal",
      description:
        "This should not be created",
      recurring: false,
      schedule: "October 15",
    },
  );

  expect(result.ok).toBe(false);

  if (result.ok) {
    throw new Error(
      "Expected missing goal to return an error.",
    );
  }

  expect(result.error).toEqual({
    kind: "domain",
    value: "GOAL_NOT_FOUND",
  });
});

test("invalid session does not create a commitment", async () => {
  const app = assembleTestApplication();

  const goal = await createGoal(
    app,
    "maya",
  );

  await app.invoker.invoke(
    "/commitments/create",
    {
      session: "invalid-session",
      goal,
      description:
        "This should not be created",
      recurring: false,
      schedule: "October 15",
    },
    {
      timeoutMs: 1000,
    },
  );

  await app.whenIdle();

  const commitments =
    await app.concepts.CommitmentTracking._commitmentsByGoal({
      goal,
    });

  expect(commitments).toEqual([]);
});
