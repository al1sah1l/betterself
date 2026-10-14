import {
  afterAll,
  beforeAll,
  beforeEach,
  expect,
  test,
} from "bun:test";

import { assemble } from "@mit-sdg/sync-engine/assembly";

import { applicationConceptSet } from "../../src/concepts.ts";
import {
  ListMyGoals,
  MyGoals,
} from "../../src/compositions/dashboard.ts";

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
        dashboard: {
          ListMyGoals,
          MyGoals,
        },
      },
    },
  });
}

type TestApplication =
  ReturnType<typeof assembleTestApplication>;

async function createSession(
  app: TestApplication,
  subject: string,
) {
  const result = await app.concepts.Sessioning.start({
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

const goalContext = {
  outcome: "Get a software engineering internship",
  currentContext: "I have a resume but have not started applying.",
  constraints: "Five hours per week.",
  timeline: "By summer 2027",
  successDefinition: "Receive and accept an internship offer.",
};

async function createGoal(
  app: TestApplication,
  owner: string,
) {
  const result = await app.concepts.GoalPlanning.createGoal({
    owner,
    ...goalContext,
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

type GoalsResponse = {
  goals: Array<{
    goal: string;
    outcome: string;
    currentContext: string;
    constraints: string;
    timeline: string;
    successDefinition: string;
  }>;
};

async function listGoals(
  app: TestApplication,
  session: string,
  user?: string,
): Promise<GoalsResponse> {
  const result = await app.invoker.invoke(
    "/dashboard/goals",
    {
      session,
      ...(user === undefined ? {} : { user }),
    },
  );

  if (!result.ok) {
    throw new Error(JSON.stringify(result.error));
  }

  return result.value as GoalsResponse;
}

test("authenticated user sees only their own goals and goal context", async () => {
  const app = assembleTestApplication();

  const mayaSession = await createSession(app, "maya");
  const alexSession = await createSession(app, "alex");

  const mayaGoal = await createGoal(app, "maya");
  const alexGoal = await createGoal(app, "alex");

  const mayaResponse = await listGoals(app, mayaSession);
  const alexResponse = await listGoals(app, alexSession);

  expect(mayaResponse.goals).toEqual([
    { goal: mayaGoal, ...goalContext },
  ]);

  expect(alexResponse.goals).toEqual([
    { goal: alexGoal, ...goalContext },
  ]);
});

test("user with no goals receives an empty list", async () => {
  const app = assembleTestApplication();

  await createGoal(app, "maya");
  const alexSession = await createSession(app, "alex");

  const response = await listGoals(app, alexSession);

  expect(response.goals).toEqual([]);
});

test("client-supplied user cannot change whose goals are returned", async () => {
  const app = assembleTestApplication();

  const mayaGoal = await createGoal(app, "maya");
  await createGoal(app, "alex");

  const mayaSession = await createSession(app, "maya");

  const response = await listGoals(
    app,
    mayaSession,
    "alex",
  );

  expect(response.goals).toEqual([
    { goal: mayaGoal, ...goalContext },
  ]);
});

test("invalid session cannot list goals", async () => {
  const app = assembleTestApplication();

  await createGoal(app, "maya");

  const result = await app.invoker.invoke(
    "/dashboard/goals",
    {
      session: "invalid-session",
    },
  );

  expect(result.ok).toBe(false);
});
