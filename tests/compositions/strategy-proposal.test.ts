import {
  afterAll,
  beforeAll,
  beforeEach,
  expect,
  test,
} from "bun:test";

import { assemble } from "@mit-sdg/sync-engine/assembly";

import { applicationConceptSet } from "../../src/concepts.ts";
import { ProposeStrategy } from "../../src/compositions/strategy-proposal.ts";

import {
  openTestDb,
  type TestDb,
} from "../test-db.ts";

import type {
  Strategy,
} from "../../src/concepts/Reasoning/Reasoning.ts";

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
        strategyProposal: {
          ProposeStrategy,
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
      outcome:
        "Get a software engineering internship",
      currentContext:
        "I have a resume but have not started applying.",
      constraints:
        "Five hours per week.",
      timeline:
        "By summer 2027",
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

test("owner can request a strategy proposal", async () => {
  const app = assembleTestApplication();

  const session = await createSession(
    app,
    "maya",
  );

  const goal = await createGoal(
    app,
    "maya",
  );

  const result =
    await app.invoker.invoke(
      "/strategies/propose",
      {
        session,
        goal,
      },
    );

  expect(result.ok).toBe(true);

  if (!result.ok) {
    throw new Error(
      JSON.stringify(result.error),
    );
  }

  const value = result.value as {
        strategy: Strategy;
    };

    expect(value.strategy).toHaveLength(3);

    expect(value.strategy[0]).toEqual({
    description:
      'Define the first concrete action toward "Get a software engineering internship" based on your current situation: I have a resume but have not started applying.',
    successCriterion:
      "A specific first action has been chosen and scheduled.",
  });

  /*
   * Requesting a proposal must not save it
   * as the goal's current strategy.
   */
  const rows =
    await app.concepts.GoalPlanning._goal({
      goal,
    });

  expect(rows).toHaveLength(1);

  expect(
    "currentStrategy" in rows[0],
  ).toBe(false);
});

test("another user cannot request a strategy for someone else's goal", async () => {
  const app = assembleTestApplication();

  const mayaGoal = await createGoal(
    app,
    "maya",
  );

  const alexSession = await createSession(
    app,
    "alex",
  );

  const result =
    await app.invoker.invoke(
      "/strategies/propose",
      {
        session: alexSession,
        goal: mayaGoal,
      },
    );

  expect(result.ok).toBe(false);

  if (result.ok) {
    throw new Error(
      "Expected request to be forbidden.",
    );
  }

  expect(result.error).toEqual({
    kind: "domain",
    value: "FORBIDDEN",
  });
});

test("missing goal returns GOAL_NOT_FOUND", async () => {
  const app = assembleTestApplication();

  const session = await createSession(
    app,
    "maya",
  );

  const result =
    await app.invoker.invoke(
      "/strategies/propose",
      {
        session,
        goal: "missing-goal",
      },
    );

  expect(result.ok).toBe(false);

  if (result.ok) {
    throw new Error(
      "Expected missing goal error.",
    );
  }

  expect(result.error).toEqual({
    kind: "domain",
    value: "GOAL_NOT_FOUND",
  });
});

test("invalid session cannot request a strategy proposal", async () => {
  const app = assembleTestApplication();

  const goal = await createGoal(
    app,
    "maya",
  );

  const result =
    await app.invoker.invoke(
      "/strategies/propose",
      {
        session: "invalid-session",
        goal,
      },
    );

  expect(result.ok).toBe(false);
});
