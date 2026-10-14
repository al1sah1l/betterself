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

import {
  GetGoalDetail,
  GoalDetail,
} from "../../src/compositions/goal-detail.ts";

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
          GetGoalDetail,
          GoalDetail,
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

test("owner can open a goal without strategy or commitments", async () => {
  const app = assembleTestApplication();

  const session = await createSession(app, "maya");
  const goal = await createGoal(app, "maya");

  const result = await app.invoker.invoke(
    "/dashboard/goal",
    {
      session,
      goal,
    },
  );

  if (!result.ok) {
    throw new Error(JSON.stringify(result.error));
  }

  expect(result.value).toEqual({
    detail: {
      goal,
      ...goalContext,
      currentStrategy: null,
      commitments: [],
    },
  });
});

test("another user cannot open someone else's goal", async () => {
  const app = assembleTestApplication();

  const goal = await createGoal(app, "maya");
  const session = await createSession(app, "alex");

  const result = await app.invoker.invoke(
    "/dashboard/goal",
    { session, goal },
  );

  if (result.ok) {
    throw new Error("Expected request to be forbidden.");
  }

  expect(result.error).toEqual({
    kind: "domain",
    value: "FORBIDDEN",
  });
});

test("opening a missing goal returns GOAL_NOT_FOUND", async () => {
  const app = assembleTestApplication();

  const session = await createSession(app, "maya");

  const result = await app.invoker.invoke(
    "/dashboard/goal",
    {
      session,
      goal: "missing-goal",
    },
  );

  if (result.ok) {
    throw new Error("Expected missing goal error.");
  }

  expect(result.error).toEqual({
    kind: "domain",
    value: "GOAL_NOT_FOUND",
  });
});

test("invalid session cannot open goal detail", async () => {
  const app = assembleTestApplication();

  const goal = await createGoal(app, "maya");

  const result = await app.invoker.invoke(
    "/dashboard/goal",
    {
      session: "invalid-session",
      goal,
    },
  );

  expect(result.ok).toBe(false);
});

test("goal detail includes saved strategy and only this goal's commitments", async () => {
  const app = assembleTestApplication();

  const session = await createSession(app, "maya");
  const goal = await createGoal(app, "maya");
  const otherGoal = await createGoal(app, "maya");

  const strategy = [
    {
      description: "Prepare a resume for internship applications.",
      successCriterion: "One updated resume is ready to submit.",
    },
  ];

  await app.concepts.GoalPlanning.setStrategy({
    goal,
    strategy,
  });

  const commitmentFields = {
    description: "Update my resume",
    recurring: false,
    schedule: "By Friday",
  };

  const created =
    await app.concepts.CommitmentTracking.createCommitment({
      goal,
      ...commitmentFields,
    });

  if (
    typeof created !== "object" ||
    created === null ||
    !("commitment" in created) ||
    typeof created.commitment !== "string"
  ) {
    throw new Error("Could not create commitment.");
  }

  await app.concepts.CommitmentTracking.createCommitment({
    goal: otherGoal,
    description: "This belongs to another goal",
    recurring: true,
    schedule: "Every Monday",
  });

  const result = await app.invoker.invoke(
    "/dashboard/goal",
    { session, goal },
  );

  if (!result.ok) {
    throw new Error(JSON.stringify(result.error));
  }

  expect(result.value).toEqual({
    detail: {
      goal,
      ...goalContext,
      currentStrategy: strategy,
      commitments: [
        {
          commitment: created.commitment,
          ...commitmentFields,
          active: true,
        },
      ],
    },
  });
});
