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
  GoalDetail,
} from "../../src/compositions/goal-detail.ts";

import {
  GoalResults,
} from "../../src/compositions/results.ts";

import {
  StrategyState,
} from "../../src/compositions/strategy-state.ts";

import {
  ReviewContext,
  ReviewProgress,
  ApplyReviewStrategy,
} from "../../src/compositions/progress-review.ts";

import type {
  ReviewContext as ReviewData,
  ReviewContextProvider,
} from "../../src/concepts/Reasoning/review-types.ts";

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

const initial = [{
  description: "Apply weekly",
  successCriterion: "Five applications",
}];

const revised = [{
  description: "Improve targeting",
  successCriterion: "Five relevant roles selected",
}];

async function setup() {
  let readContext: ReviewContextProvider = async () => {
    throw new Error("Application is not assembled.");
  };

  const app = assemble({
    conceptSet: applicationConceptSet,

    instances:
      applicationConceptSet.implementations("mongo", {
        db: testDb.db,

        reviewContextProvider: (reference: string) =>
          readContext(reference),
      }),

    composition: {
      BetterSelf: {
        dashboard: { GoalDetail },
        results: { GoalResults },
        strategyState: { StrategyState },

        progressReview: {
          ReviewContext,
          ReviewProgress,
          ApplyReviewStrategy,
        },
      },
    },
  });

  readContext = async (reference) => {
    const value = await app.form(
      ReviewContext({
        goal: reference,
      }),
    );

    if (
      typeof value !== "object" ||
      value === null ||
      !("detail" in value) ||
      !("results" in value) ||
      !("state" in value)
    ) {
      throw new Error("Invalid review context.");
    }

    const state = value.state;

    if (
      typeof state !== "object" ||
      state === null ||
      !("strategy" in state) ||
      !Array.isArray(state.strategy) ||
      !("revision" in state) ||
      typeof state.revision !== "string"
    ) {
      throw new Error("Invalid strategy snapshot.");
    }

    return value as ReviewData;
  };

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

  await app.concepts.GoalPlanning.setStrategy({
    goal: created.goal,
    strategy: initial,
  });

  await app.concepts.ResultTracking.recordResult({
    goal: created.goal,
    description: "Two interviews",
    observedOn: "2026-10-19",
  });

  return {
    app,
    goal: created.goal,
    session: maya.session,
    otherSession: alex.session,
  };
}

test("review is advisory and edited acceptance creates a fresh revision", async () => {
  const { app, goal, session } = await setup();

  const before =
    await app.concepts.GoalPlanning._strategySnapshot({
      goal,
    });

  const result = await app.invoker.invoke(
    "/reviews/propose",
    {
      session,
      goal,
      context: { fake: true },
    },
  );

  expect(result.ok).toBe(true);

  if (!result.ok) {
    throw new Error(JSON.stringify(result.error));
  }

  expect(result.value).toMatchObject({
    revision: "initial",
    strategy: initial,
  });

  expect(
    await app.concepts.GoalPlanning._strategySnapshot({
      goal,
    }),
  ).toEqual(before);

  const accepted = await app.invoker.invoke(
    "/reviews/apply",
    {
      session,
      goal,
      strategy: revised,
      expectedRevision: "initial",
    },
  );

  expect(accepted).toEqual({
    ok: true,
    value: { goal },
  });

  const after =
    await app.concepts.GoalPlanning._strategySnapshot({
      goal,
    });

  expect(after[0]?.strategy).toEqual(revised);
  expect(after[0]?.revision).not.toBe("initial");

  expect(
    await app.concepts.ResultTracking._resultsByGoal({
      goal,
    }),
  ).toHaveLength(1);

  expect(
    await app.invoker.invoke("/reviews/apply", {
      session,
      goal,
      strategy: initial,
      expectedRevision: "initial",
    }),
  ).toEqual({
    ok: false,
    error: {
      kind: "domain",
      value: "STRATEGY_CHANGED",
    },
  });

  expect(
    await app.concepts.GoalPlanning._strategySnapshot({
      goal,
    }),
  ).toEqual(after);
});

test("two concurrent acceptances cannot both overwrite the same revision", async () => {
  const { app, goal, session } = await setup();

  const responses = await Promise.all(
    [1, 2].map(() =>
      app.invoker.invoke("/reviews/apply", {
        session,
        goal,
        strategy: revised,
        expectedRevision: "initial",
      }),
    ),
  );

  expect(
    responses.filter((value) => value.ok),
  ).toHaveLength(1);

  expect(
    responses.filter((value) => !value.ok),
  ).toEqual([{
    ok: false,
    error: {
      kind: "domain",
      value: "STRATEGY_CHANGED",
    },
  }]);
});

test("foreign or invalid sessions cannot review or apply", async () => {
  const {
    app,
    goal,
    otherSession,
  } = await setup();

  for (const path of [
    "/reviews/propose",
    "/reviews/apply",
  ]) {
    expect(
      await app.invoker.invoke(path, {
        session: otherSession,
        goal,
        strategy: revised,
        expectedRevision: "initial",
        user: "maya",
      }),
    ).toEqual({
      ok: false,
      error: {
        kind: "domain",
        value: "FORBIDDEN",
      },
    });

    const invalid = await app.invoker.invoke(
      path,
      {
        session: "invalid",
        goal,
        strategy: revised,
        expectedRevision: "initial",
      },
      {
        timeoutMs: 1000,
      },
    );

    expect(invalid.ok).toBe(false);
  }

  expect(
    await app.concepts.GoalPlanning._strategySnapshot({
      goal,
    }),
  ).toEqual([{
    strategy: initial,
    revision: "initial",
  }]);
});

test("invalid strategy and missing goals are refused", async () => {
  const { app, goal, session } = await setup();

  expect(
    await app.invoker.invoke("/reviews/apply", {
      session,
      goal,
      strategy: [],
      expectedRevision: "initial",
    }),
  ).toEqual({
    ok: false,
    error: {
      kind: "domain",
      value: "INVALID_STRATEGY",
    },
  });

  for (const path of [
    "/reviews/propose",
    "/reviews/apply",
  ]) {
    expect(
      await app.invoker.invoke(path, {
        session,
        goal: "missing",
        strategy: revised,
        expectedRevision: "initial",
      }),
    ).toEqual({
      ok: false,
      error: {
        kind: "domain",
        value: "GOAL_NOT_FOUND",
      },
    });
  }

  expect(
    await app.concepts.GoalPlanning._strategySnapshot({
      goal,
    }),
  ).toEqual([{
    strategy: initial,
    revision: "initial",
  }]);
});
