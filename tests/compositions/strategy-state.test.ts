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
  StrategyState,
  GetStrategyState,
} from "../../src/compositions/strategy-state.ts";

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

async function setup() {
  const app = assemble({
    conceptSet: applicationConceptSet,

    instances:
      applicationConceptSet.implementations("mongo", {
        db: testDb.db,
      }),

    composition: {
      BetterSelf: {
        strategyState: {
          StrategyState,
          GetStrategyState,
        },
      },
    },
  });

  const created =
    await app.concepts.GoalPlanning.createGoal({
      owner: "maya",
      outcome: "Internship",
      currentContext: "Applying",
      constraints: "Five hours",
      timeline: "Summer",
      successDefinition: "Offer",
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

test("initial strategy and revisions have stable and distinct identities", async () => {
  const { app, goal, session } = await setup();

  expect(
    await app.invoker.invoke(
      "/dashboard/strategy-state",
      { session, goal },
    ),
  ).toEqual({
    ok: true,
    value: {
      state: {
        strategy: [],
        revision: "initial",
      },
    },
  });

  const strategy = [
    {
      description: "Apply",
      successCriterion: "Five applications",
    },
  ];

  await app.concepts.GoalPlanning.setStrategy({
    goal,
    strategy,
  });

  expect(
    await app.concepts.GoalPlanning._strategySnapshot({
      goal,
    }),
  ).toEqual([
    {
      strategy,
      revision: "initial",
    },
  ]);

  await app.concepts.CommitmentTracking.createCommitment({
    goal,
    description: "Apply",
    recurring: true,
    schedule: "Weekly",
    sourceStep: "step:0",
  });

  const oldCommitments =
    await app.concepts.CommitmentTracking._commitmentsByGoal({
      goal,
    });

  const revised = [
    {
      description: "Network",
      successCriterion: "Three conversations",
    },
  ];

  await app.concepts.GoalPlanning.reviseStrategy({
    goal,
    strategy: revised,
  });

  const first =
    await app.concepts.GoalPlanning._strategySnapshot({
      goal,
    });

  expect(first[0]?.strategy).toEqual(revised);
  expect(first[0]?.revision).not.toBe("initial");

  expect(
    await app.concepts.GoalPlanning._strategySnapshot({
      goal,
    }),
  ).toEqual(first);

  expect(
    await app.concepts.CommitmentTracking._commitmentsByGoal({
      goal,
    }),
  ).toEqual(oldCommitments);

  await app.concepts.GoalPlanning.reviseStrategy({
    goal,
    strategy: revised,
  });

  const second =
    await app.concepts.GoalPlanning._strategySnapshot({
      goal,
    });

  expect(second[0]?.revision).not.toBe(
    first[0]?.revision,
  );
});

test("strategy state requires owner session and handles missing goals", async () => {
  const {
    app,
    goal,
    session,
    otherSession,
  } = await setup();

  expect(
    await app.invoker.invoke(
      "/dashboard/strategy-state",
      {
        session: otherSession,
        goal,
        user: "maya",
      },
    ),
  ).toEqual({
    ok: false,
    error: {
      kind: "domain",
      value: "FORBIDDEN",
    },
  });

  expect(
    await app.invoker.invoke(
      "/dashboard/strategy-state",
      {
        session,
        goal: "missing",
      },
    ),
  ).toEqual({
    ok: false,
    error: {
      kind: "domain",
      value: "GOAL_NOT_FOUND",
    },
  });

  const invalid = await app.invoker.invoke(
    "/dashboard/strategy-state",
    {
      session: "invalid",
      goal,
    },
    {
      timeoutMs: 1000,
    },
  );

  expect(invalid.ok).toBe(false);
});
