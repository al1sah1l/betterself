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
  CreateGoal,
  SetStrategy,
} from "../../src/compositions/goals.ts";

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
        goals: {
          CreateGoal,
          SetStrategy,
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

type CreateGoalResponse = {
  goal: string;
};

async function createGoalThroughEndpoint(
  app: ReturnType<typeof assembleTestApplication>,
  payload: Record<string, unknown>,
) {
  const result = await app.invoker.invoke(
    "/goals/create",
    payload,
  );

  if (!result.ok) {
    throw new Error("CreateGoal endpoint failed.");
  }

  return result.value as CreateGoalResponse;
}

const goalFields = {
  outcome: "Get a software engineering internship",
  currentContext:
    "I am a student preparing for recruiting.",
  constraints:
    "I can spend about five hours per week.",
  timeline: "By summer 2027",
  successDefinition:
    "Receive and accept a software engineering internship offer.",
};

const initialStrategy = [
  {
    description:
      "Apply to five relevant software engineering internships each week.",
    successCriterion:
      "At least five relevant applications are submitted each week.",
  },
];

const replacementStrategy = [
  {
    description:
      "Attend two recruiting events each week.",
    successCriterion:
      "Two recruiting events are attended each week.",
  },
];

test("authenticated user becomes the goal owner", async () => {
  const app = assembleTestApplication();

  const session = await createSession(
    app,
    "maya",
  );

  const created =
    await createGoalThroughEndpoint(app, {
      session,
      ...goalFields,
    });

  const goals =
    await app.concepts.GoalPlanning._goal({
      goal: created.goal,
    });

  expect(goals).toHaveLength(1);

  expect(goals[0]).toMatchObject({
    owner: "maya",
    outcome: goalFields.outcome,
    currentContext: goalFields.currentContext,
    constraints: goalFields.constraints,
    timeline: goalFields.timeline,
    successDefinition:
      goalFields.successDefinition,
  });
});

test("client cannot spoof goal owner", async () => {
  const app = assembleTestApplication();

  const session = await createSession(
    app,
    "maya",
  );

  const created =
    await createGoalThroughEndpoint(app, {
      session,

      // Must be ignored by the endpoint.
      owner: "alex",

      ...goalFields,
    });

  const goals =
    await app.concepts.GoalPlanning._goal({
      goal: created.goal,
    });

  expect(goals).toHaveLength(1);

  expect(goals[0].owner).toBe("maya");

  const alexGoals =
    await app.concepts.GoalPlanning._goalsByOwner({
      owner: "alex",
    });

  expect(alexGoals).toEqual([]);
});

test("invalid session does not create a goal", async () => {
  const app = assembleTestApplication();

  await app.invoker.invoke(
    "/goals/create",
    {
      session: "invalid-session",
      ...goalFields,
    },
    {
      timeoutMs: 1000,
    },
  );

  await app.whenIdle();

  const mayaGoals =
    await app.concepts.GoalPlanning._goalsByOwner({
      owner: "maya",
    });

  expect(mayaGoals).toEqual([]);
});

test("goal owner can set the initial strategy", async () => {
  const app = assembleTestApplication();

  const session = await createSession(
    app,
    "maya",
  );

  const created =
    await createGoalThroughEndpoint(app, {
      session,
      ...goalFields,
    });

  const result = await app.invoker.invoke(
    "/goals/set-strategy",
    {
      session,
      goal: created.goal,
      strategy: initialStrategy,
    },
  );

  expect(result.ok).toBe(true);

  const goals =
    await app.concepts.GoalPlanning._goal({
      goal: created.goal,
    });

  expect(goals).toHaveLength(1);

  expect(goals[0].currentStrategy).toEqual(
    initialStrategy,
  );
});

test("user cannot set strategy for another user's goal", async () => {
  const app = assembleTestApplication();

  const mayaSession = await createSession(
    app,
    "maya",
  );

  const alexSession = await createSession(
    app,
    "alex",
  );

  const created =
    await createGoalThroughEndpoint(app, {
      session: mayaSession,
      ...goalFields,
    });

  const result = await app.invoker.invoke(
    "/goals/set-strategy",
    {
      session: alexSession,
      goal: created.goal,
      strategy: initialStrategy,
    },
  );

  expect(result.ok).toBe(false);

    if (result.ok) {
        throw new Error(
            "Expected SetStrategy to be forbidden.",
        );
        }

        expect(result.error).toEqual({
        kind: "domain",
        value: "FORBIDDEN",
    });

  const goals =
    await app.concepts.GoalPlanning._goal({
      goal: created.goal,
    });

  expect(goals).toHaveLength(1);

  expect(goals[0].currentStrategy).toBeUndefined();
});

test("setting strategy for missing goal returns GOAL_NOT_FOUND", async () => {
  const app = assembleTestApplication();

  const session = await createSession(
    app,
    "maya",
  );

  const result = await app.invoker.invoke(
    "/goals/set-strategy",
    {
      session,
      goal: "missing-goal",
      strategy: initialStrategy,
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

test("setting strategy twice does not overwrite the original strategy", async () => {
  const app = assembleTestApplication();

  const session = await createSession(
    app,
    "maya",
  );

  const created =
    await createGoalThroughEndpoint(app, {
      session,
      ...goalFields,
    });

  await app.invoker.invoke(
    "/goals/set-strategy",
    {
      session,
      goal: created.goal,
      strategy: initialStrategy,
    },
  );

  await app.invoker.invoke(
    "/goals/set-strategy",
    {
      session,
      goal: created.goal,
      strategy: replacementStrategy,
    },
    {
      timeoutMs: 1000,
    },
  );

  await app.whenIdle();

  const goals =
    await app.concepts.GoalPlanning._goal({
      goal: created.goal,
    });

  expect(goals).toHaveLength(1);

  expect(goals[0].currentStrategy).toEqual(
    initialStrategy,
  );
});
