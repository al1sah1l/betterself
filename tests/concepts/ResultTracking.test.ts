import {
  afterAll,
  beforeAll,
  beforeEach,
  expect,
  test,
} from "bun:test";

import {
  ResultTrackingConcept,
  InvalidResult,
  ResultNotFound,
} from "../../src/concepts/ResultTracking/ResultTracking.ts";

import {
  openTestDb,
  type TestDb,
} from "../test-db.ts";

let testDb: TestDb;
let results: ResultTrackingConcept<string>;

beforeAll(async () => {
  testDb = await openTestDb();
}, 120_000);

beforeEach(async () => {
  await testDb.db.dropDatabase();

  results = new ResultTrackingConcept<string>(
    testDb.db,
  );
});

afterAll(async () => {
  await testDb.close();
});

test("record, read by date, isolate goals, and remove an observation", async () => {
  const older = await results.recordResult({
    goal: "a",
    description: " First interview ",
    observedOn: "2026-10-18",
  });

  const newer = await results.recordResult({
    goal: "a",
    description: "Offer received",
    observedOn: "2026-10-19",
  });

  await results.recordResult({
    goal: "b",
    description: "Another goal",
    observedOn: "2026-10-19",
  });

  expect(
    await results._resultsByGoal({ goal: "a" }),
  ).toEqual([
    {
      result: newer.result,
      description: "Offer received",
      observedOn: "2026-10-19",
    },
    {
      result: older.result,
      description: "First interview",
      observedOn: "2026-10-18",
    },
  ]);

  await results.removeResult({
    goal: "a",
    result: older.result,
  });

  expect(
    await results._resultsByGoal({ goal: "a" }),
  ).toHaveLength(1);

  await expect(
    results.removeResult({
      goal: "a",
      result: older.result,
    }),
  ).rejects.toBeInstanceOf(ResultNotFound);
});

test("invalid input does not add results", async () => {
  const invalidInputs = [
    {
      description: " ",
      observedOn: "2026-10-19",
    },
    {
      description: "x".repeat(2001),
      observedOn: "2026-10-19",
    },
    {
      description: "Interview",
      observedOn: "2026-02-30",
    },
    {
      description: "Interview",
      observedOn: "not-a-date",
    },
  ];

  for (const fields of invalidInputs) {
    await expect(
      results.recordResult({
        goal: "a",
        ...fields,
      }),
    ).rejects.toBeInstanceOf(InvalidResult);
  }

  expect(
    await results._resultsByGoal({ goal: "a" }),
  ).toEqual([]);
});

test("wrong goal or missing identity cannot remove a result", async () => {
  const { result } = await results.recordResult({
    goal: "a",
    description: "Interview",
    observedOn: "2026-10-19",
  });

  for (const input of [
    { goal: "b", result },
    { goal: "a", result: "missing" },
  ]) {
    await expect(
      results.removeResult(input),
    ).rejects.toBeInstanceOf(ResultNotFound);
  }

  expect(
    await results._resultsByGoal({ goal: "a" }),
  ).toHaveLength(1);
});
