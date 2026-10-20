import { afterAll, beforeAll, beforeEach, expect, test } from "bun:test";
import { CommitmentTrackingConcept } from "../../src/concepts/CommitmentTracking/CommitmentTracking.ts";
import { openTestDb, type TestDb } from "../test-db.ts";

let testDb: TestDb;
let commitments: CommitmentTrackingConcept<string>;

beforeAll(async () => {
  testDb = await openTestDb();
}, 120_000);

beforeEach(async () => {
  await testDb.db.dropDatabase();
  commitments = new CommitmentTrackingConcept<string>(testDb.db);
});

afterAll(async () => {
  await testDb.close();
});

test("a commitment can be created and retrieved", async () => {
  const { commitment } = await commitments.createCommitment({
    goal: "goal-1",
    description: "Send 5 networking messages",
    recurring: false,
    schedule: "2026-10-15",
  });

  const rows = await commitments._commitment({ commitment });

  expect(rows).toHaveLength(1);
  expect(rows[0]?.goal).toBe("goal-1");
  expect(rows[0]?.description).toBe("Send 5 networking messages");
  expect(rows[0]?.recurring).toBe(false);
  expect(rows[0]?.schedule).toBe("2026-10-15");
  expect(rows[0]?.active).toBe(true);
});

test("an active commitment can be claimed complete", async () => {
  const { commitment } = await commitments.createCommitment({
    goal: "goal-1",
    description: "Send 5 networking messages",
    recurring: false,
    schedule: "2026-10-15",
  });

  const occurrence = new Date("2026-10-15T12:00:00Z");

  const { completion } = await commitments.claimComplete({
    commitment,
    occurrence,
  });

  expect(completion).toBeString();

  const rows = await commitments._completionsByCommitment({
    commitment,
  });

  expect(rows).toHaveLength(1);
  expect(rows[0]?.occurrence).toEqual(occurrence);
});

test("the same occurrence cannot be claimed complete twice", async () => {
  const { commitment } = await commitments.createCommitment({
    goal: "goal-1",
    description: "Send 5 networking messages",
    recurring: true,
    schedule: "Every Monday",
  });

  const occurrence = new Date("2026-10-19T12:00:00Z");

  await commitments.claimComplete({
    commitment,
    occurrence,
  });

  await expect(
    commitments.claimComplete({
      commitment,
      occurrence,
    }),
  ).rejects.toThrow(
    "This occurrence has already been completed.",
  );
});

test("a recurring commitment can have multiple completed occurrences", async () => {
  const { commitment } = await commitments.createCommitment({
    goal: "goal-1",
    description: "Send 5 networking messages",
    recurring: true,
    schedule: "Every Monday",
  });

  const firstOccurrence = new Date("2026-10-19T12:00:00Z");
  const secondOccurrence = new Date("2026-10-26T12:00:00Z");

  await commitments.claimComplete({
    commitment,
    occurrence: firstOccurrence,
  });

  await commitments.claimComplete({
    commitment,
    occurrence: secondOccurrence,
  });

  const rows = await commitments._completionsByCommitment({
    commitment,
  });

  expect(rows).toHaveLength(2);
  expect(rows.map((row) => row.occurrence)).toEqual([
    firstOccurrence,
    secondOccurrence,
  ]);
});

test("an active commitment can be retired", async () => {
  const { commitment } = await commitments.createCommitment({
    goal: "goal-1",
    description: "Send 5 networking messages",
    recurring: true,
    schedule: "Every Monday",
  });

  await commitments.retireCommitment({ commitment });

  const rows = await commitments._commitment({ commitment });

  expect(rows).toHaveLength(1);
  expect(rows[0]?.active).toBe(false);
});

test("a retired commitment cannot be claimed complete", async () => {
  const { commitment } = await commitments.createCommitment({
    goal: "goal-1",
    description: "Send 5 networking messages",
    recurring: true,
    schedule: "Every Monday",
  });

  await commitments.retireCommitment({ commitment });

  await expect(
    commitments.claimComplete({
      commitment,
      occurrence: new Date("2026-10-19T12:00:00Z"),
    }),
  ).rejects.toThrow(
    "This commitment is no longer active.",
  );
});

test("a commitment cannot be retired twice", async () => {
  const { commitment } = await commitments.createCommitment({
    goal: "goal-1",
    description: "Send 5 networking messages",
    recurring: true,
    schedule: "Every Monday",
  });

  await commitments.retireCommitment({ commitment });

  await expect(
    commitments.retireCommitment({ commitment }),
  ).rejects.toThrow(
    "This commitment is already retired.",
  );
});

test("actions refuse when the commitment does not exist", async () => {
  const missingCommitment = "missing-commitment";

  await expect(
    commitments.claimComplete({
      commitment: missingCommitment,
      occurrence: new Date("2026-10-19T12:00:00Z"),
    }),
  ).rejects.toThrow(
    "There is no such commitment.",
  );

  await expect(
    commitments.retireCommitment({
      commitment: missingCommitment,
    }),
  ).rejects.toThrow(
    "There is no such commitment.",
  );
});

test("retiring a commitment preserves its previous completions", async () => {
  const { commitment } = await commitments.createCommitment({
    goal: "goal-1",
    description: "Send 5 networking messages",
    recurring: true,
    schedule: "Every Monday",
  });

  const occurrence = new Date("2026-10-19T12:00:00Z");

  await commitments.claimComplete({
    commitment,
    occurrence,
  });

  await commitments.retireCommitment({
    commitment,
  });

  const rows = await commitments._completionsByCommitment({
    commitment,
  });

  expect(rows).toHaveLength(1);
  expect(rows[0]?.occurrence).toEqual(occurrence);
});

test("commitments are returned by goal in creation order", async () => {
  await commitments.createCommitment({
    goal: "goal-1",
    description: "First commitment",
    recurring: false,
    schedule: "Monday",
  });

  await commitments.createCommitment({
    goal: "goal-1",
    description: "Second commitment",
    recurring: true,
    schedule: "Every Friday",
  });

  await commitments.createCommitment({
    goal: "goal-2",
    description: "Different goal commitment",
    recurring: false,
    schedule: "Tomorrow",
  });

  const rows = await commitments._commitmentsByGoal({
    goal: "goal-1",
  });

  expect(rows).toHaveLength(2);
  expect(rows.map((row) => row.description)).toEqual([
    "First commitment",
    "Second commitment",
  ]);
});

test("a goal with no commitments gets an empty list", async () => {
  const rows = await commitments._commitmentsByGoal({
    goal: "goal-with-no-commitments",
  });

  expect(rows).toEqual([]);
});

test("completions are returned for the correct commitment in occurrence order", async () => {
  const { commitment: firstCommitment } =
    await commitments.createCommitment({
      goal: "goal-1",
      description: "Send networking messages",
      recurring: true,
      schedule: "Every Monday",
    });

  const { commitment: secondCommitment } =
    await commitments.createCommitment({
      goal: "goal-1",
      description: "Apply to internships",
      recurring: true,
      schedule: "Every Friday",
    });

  const laterOccurrence = new Date("2026-10-26T12:00:00Z");
  const earlierOccurrence = new Date("2026-10-19T12:00:00Z");

  await commitments.claimComplete({
    commitment: firstCommitment,
    occurrence: laterOccurrence,
  });

  await commitments.claimComplete({
    commitment: firstCommitment,
    occurrence: earlierOccurrence,
  });

  await commitments.claimComplete({
    commitment: secondCommitment,
    occurrence: new Date("2026-10-20T12:00:00Z"),
  });

  const rows = await commitments._completionsByCommitment({
    commitment: firstCommitment,
  });

  expect(rows).toHaveLength(2);
  expect(rows.map((row) => row.occurrence)).toEqual([
    earlierOccurrence,
    laterOccurrence,
  ]);
});

test("a missing commitment returns no row", async () => {
  const rows = await commitments._commitment({
    commitment: "missing-commitment",
  });

  expect(rows).toEqual([]);
});

test("only one simultaneous completion claim succeeds for the same occurrence", async () => {
  const { commitment } = await commitments.createCommitment({
    goal: "goal-1",
    description: "Send networking messages",
    recurring: true,
    schedule: "Every Monday",
  });

  const occurrence = new Date("2026-10-19T12:00:00Z");

  const results = await Promise.allSettled([
    commitments.claimComplete({
      commitment,
      occurrence,
    }),
    commitments.claimComplete({
      commitment,
      occurrence,
    }),
  ]);

  const succeeded = results.filter(
    (result) => result.status === "fulfilled",
  );

  const failed = results.filter(
    (result) => result.status === "rejected",
  );

  expect(succeeded).toHaveLength(1);
  expect(failed).toHaveLength(1);
});

test("a commitment with no completions gets an empty list", async () => {
  const { commitment } = await commitments.createCommitment({
    goal: "goal-1",
    description: "Send networking messages",
    recurring: true,
    schedule: "Every Monday",
  });

  const rows = await commitments._completionsByCommitment({
    commitment,
  });

  expect(rows).toEqual([]);
});

test("a one-time commitment cannot be completed more than once", async () => {
  const { commitment } = await commitments.createCommitment({
    goal: "goal-1",
    description: "Submit internship application",
    recurring: false,
    schedule: "2026-10-20",
  });

  await commitments.claimComplete({
    commitment,
    occurrence: new Date("2026-10-20T12:00:00Z"),
  });

  await expect(
    commitments.claimComplete({
      commitment,
      occurrence: new Date("2026-10-21T12:00:00Z"),
    }),
  ).rejects.toThrow(
    "This one-time commitment has already been completed.",
  );
});

test("only one simultaneous completion succeeds for a one-time commitment", async () => {
  const { commitment } = await commitments.createCommitment({
    goal: "goal-1",
    description: "Submit internship application",
    recurring: false,
    schedule: "2026-10-20",
  });

  const results = await Promise.allSettled([
    commitments.claimComplete({
      commitment,
      occurrence: new Date("2026-10-20T12:00:00Z"),
    }),
    commitments.claimComplete({
      commitment,
      occurrence: new Date("2026-10-21T12:00:00Z"),
    }),
  ]);

  const succeeded = results.filter(
    (result) => result.status === "fulfilled",
  );

  const failed = results.filter(
    (result) => result.status === "rejected",
  );

  expect(succeeded).toHaveLength(1);
  expect(failed).toHaveLength(1);
});

test("checkProofSubmission allows recurring commitments without changing completions", async () => {
  const { commitment } = await commitments.createCommitment({
    goal: "goal-1",
    description: "Practice coding daily",
    recurring: true,
    schedule: "Every day",
  });

  const occurrence = new Date("2026-10-20T12:00:00Z");

  const result = await commitments.checkProofSubmission({
    commitment,
    occurrence,
  });

  expect(result).toEqual({
    commitment,
    recurring: true,
  });

  expect(
    await commitments._completionsByCommitment({ commitment }),
  ).toHaveLength(0);
});

test("checkProofSubmission allows a new one-time commitment", async () => {
  const { commitment } = await commitments.createCommitment({
    goal: "goal-1",
    description: "Submit application",
    recurring: false,
    schedule: "2026-10-20",
  });

  const result = await commitments.checkProofSubmission({
    commitment,
    occurrence: new Date("2026-10-20T12:00:00Z"),
  });

  expect(result).toEqual({
    commitment,
    recurring: false,
  });

  expect(
    await commitments._completionsByCommitment({ commitment }),
  ).toHaveLength(0);
});

test("checkProofSubmission allows the same one-time occurrence but rejects another", async () => {
  const { commitment } = await commitments.createCommitment({
    goal: "goal-1",
    description: "Submit application",
    recurring: false,
    schedule: "2026-10-20",
  });

  const occurrence = new Date("2026-10-20T12:00:00Z");

  await commitments.claimComplete({
    commitment,
    occurrence,
  });

  expect(
    await commitments.checkProofSubmission({
      commitment,
      occurrence,
    }),
  ).toEqual({
    commitment,
    recurring: false,
  });

  await expect(
    commitments.checkProofSubmission({
      commitment,
      occurrence: new Date("2026-10-21T12:00:00Z"),
    }),
  ).rejects.toThrow(
    "This one-time commitment has already been completed.",
  );

  const completions =
    await commitments._completionsByCommitment({ commitment });

  expect(completions).toHaveLength(1);
  expect(completions[0]?.occurrence).toEqual(occurrence);
});

test("checkProofSubmission rejects retired commitments", async () => {
  const { commitment } = await commitments.createCommitment({
    goal: "goal-1",
    description: "Practice coding",
    recurring: true,
    schedule: "Every day",
  });

  await commitments.retireCommitment({ commitment });

  await expect(
    commitments.checkProofSubmission({
      commitment,
      occurrence: new Date("2026-10-20T12:00:00Z"),
    }),
  ).rejects.toThrow(
    "This commitment is no longer active.",
  );

  expect(
    await commitments._completionsByCommitment({ commitment }),
  ).toHaveLength(0);
});

test("checkProofSubmission rejects nonexistent commitments", async () => {
  await expect(
    commitments.checkProofSubmission({
      commitment: "nonexistent-commitment",
      occurrence: new Date("2026-10-20T12:00:00Z"),
    }),
  ).rejects.toThrow("There is no such commitment.");
});
