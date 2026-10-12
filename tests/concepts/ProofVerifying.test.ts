import {
  afterAll,
  beforeAll,
  beforeEach,
  expect,
  test,
} from "bun:test";

import { ProofVerifyingConcept } from "../../src/concepts/ProofVerifying/ProofVerifying.ts";
import { openTestDb, type TestDb } from "../test-db.ts";

let testDb: TestDb;

let proofs: ProofVerifyingConcept<
  string,
  string,
  string,
  string
>;

beforeAll(async () => {
  testDb = await openTestDb();
}, 120_000);

beforeEach(async () => {
  await testDb.db.dropDatabase();

  proofs = new ProofVerifyingConcept<
    string,
    string,
    string,
    string
  >(testDb.db);
});

afterAll(async () => {
  await testDb.close();
});

async function createProof({
  submitter = "maya",
  goal = "goal-1",
  commitment = "commitment-1",
  occurrence = new Date("2026-10-19T12:00:00Z"),
  evidence = "Screenshot showing completed applications",
} = {}) {
  return proofs.submitProof({
    submitter,
    goal,
    commitment,
    occurrence,
    evidence,
  });
}

test("a proof can be submitted and retrieved", async () => {
  const occurrence =
    new Date("2026-10-19T12:00:00Z");

  const { proof } = await createProof({
    occurrence,
  });

  const rows = await proofs._proof({ proof });

  expect(rows).toHaveLength(1);
  expect(rows[0]?.submitter).toBe("maya");
  expect(rows[0]?.goal).toBe("goal-1");
  expect(rows[0]?.commitment).toBe("commitment-1");
  expect(rows[0]?.occurrence).toEqual(occurrence);
  expect(rows[0]?.evidence).toBe(
    "Screenshot showing completed applications",
  );
});

test("a missing proof returns no row", async () => {
  const rows = await proofs._proof({
    proof: "missing-proof",
  });

  expect(rows).toEqual([]);
});

test("a proof can be found by commitment and occurrence", async () => {
  const occurrence =
    new Date("2026-10-19T12:00:00Z");

  const { proof } = await createProof({
    commitment: "commitment-1",
    occurrence,
  });

  await createProof({
    commitment: "commitment-2",
    occurrence,
    evidence: "Different evidence",
  });

  const rows = await proofs._proofForOccurrence({
    commitment: "commitment-1",
    occurrence,
  });

  expect(rows).toHaveLength(1);
  expect(rows[0]?.proof).toBe(proof);
  expect(rows[0]?.submitter).toBe("maya");
});

test("an occurrence without proof returns no row", async () => {
  const rows =
    await proofs._proofForOccurrence({
      commitment: "commitment-1",
      occurrence:
        new Date("2026-10-19T12:00:00Z"),
    });

  expect(rows).toEqual([]);
});

test("proof cannot be submitted twice for the same commitment occurrence", async () => {
  const occurrence =
    new Date("2026-10-19T12:00:00Z");

  await createProof({
    commitment: "commitment-1",
    occurrence,
  });

  await expect(
    proofs.submitProof({
      submitter: "alex",
      goal: "goal-1",
      commitment: "commitment-1",
      occurrence,
      evidence: "Another proof",
    }),
  ).rejects.toThrow(
    "Proof has already been submitted for this occurrence.",
  );
});

test("only one simultaneous proof submission succeeds for the same occurrence", async () => {
  const occurrence =
    new Date("2026-10-19T12:00:00Z");

  const results = await Promise.allSettled([
    proofs.submitProof({
      submitter: "maya",
      goal: "goal-1",
      commitment: "commitment-1",
      occurrence,
      evidence: "Evidence A",
    }),

    proofs.submitProof({
      submitter: "maya",
      goal: "goal-1",
      commitment: "commitment-1",
      occurrence,
      evidence: "Evidence B",
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

test("different occurrences of the same commitment can have different proofs", async () => {
  await createProof({
    commitment: "commitment-1",
    occurrence:
      new Date("2026-10-19T12:00:00Z"),
  });

  await createProof({
    commitment: "commitment-1",
    occurrence:
      new Date("2026-10-26T12:00:00Z"),
  });

  const first =
    await proofs._proofForOccurrence({
      commitment: "commitment-1",
      occurrence:
        new Date("2026-10-19T12:00:00Z"),
    });

  const second =
    await proofs._proofForOccurrence({
      commitment: "commitment-1",
      occurrence:
        new Date("2026-10-26T12:00:00Z"),
    });

  expect(first).toHaveLength(1);
  expect(second).toHaveLength(1);
  expect(first[0]?.proof).not.toBe(
    second[0]?.proof,
  );
});

test("different commitments can have proof for the same occurrence", async () => {
  const occurrence =
    new Date("2026-10-19T12:00:00Z");

  await createProof({
    commitment: "commitment-1",
    occurrence,
  });

  await expect(
    createProof({
      commitment: "commitment-2",
      occurrence,
      evidence: "Second commitment evidence",
    }),
  ).resolves.toHaveProperty("proof");
});

test("another user can verify a proof", async () => {
  const { proof } = await createProof();

  await proofs.reviewProof({
    reviewer: "alex",
    proof,
    decision: "verified",
    note: "Looks good.",
  });

  const rows =
    await proofs._verificationsByProof({
      proof,
    });

  expect(rows).toHaveLength(1);
  expect(rows[0]).toEqual({
    reviewer: "alex",
    decision: "verified",
    note: "Looks good.",
  });
});

test("a reviewer can dispute a proof", async () => {
  const { proof } = await createProof();

  await proofs.reviewProof({
    reviewer: "alex",
    proof,
    decision: "disputed",
    note: "The evidence does not show completion.",
  });

  const rows =
    await proofs._verificationsByProof({
      proof,
    });

  expect(rows).toHaveLength(1);
  expect(rows[0]?.decision).toBe("disputed");
});

test("a user cannot review their own proof", async () => {
  const { proof } = await createProof({
    submitter: "maya",
  });

  await expect(
    proofs.reviewProof({
      reviewer: "maya",
      proof,
      decision: "verified",
      note: "I verified myself.",
    }),
  ).rejects.toThrow(
    "A user cannot review their own proof.",
  );
});

test("a missing proof cannot be reviewed", async () => {
  await expect(
    proofs.reviewProof({
      reviewer: "alex",
      proof: "missing-proof",
      decision: "verified",
      note: "Looks good.",
    }),
  ).rejects.toThrow(
    "There is no such proof.",
  );
});

test("the same reviewer cannot review the same proof twice", async () => {
  const { proof } = await createProof();

  await proofs.reviewProof({
    reviewer: "alex",
    proof,
    decision: "verified",
    note: "Looks good.",
  });

  await expect(
    proofs.reviewProof({
      reviewer: "alex",
      proof,
      decision: "disputed",
      note: "Changed my mind.",
    }),
  ).rejects.toThrow(
    "This user has already reviewed this proof.",
  );
});

test("only one simultaneous review from the same reviewer succeeds", async () => {
  const { proof } = await createProof();

  const results = await Promise.allSettled([
    proofs.reviewProof({
      reviewer: "alex",
      proof,
      decision: "verified",
      note: "Looks good.",
    }),

    proofs.reviewProof({
      reviewer: "alex",
      proof,
      decision: "disputed",
      note: "Not enough evidence.",
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

test("different reviewers can review the same proof", async () => {
  const { proof } = await createProof();

  await proofs.reviewProof({
    reviewer: "alex",
    proof,
    decision: "verified",
    note: "Looks good.",
  });

  await proofs.reviewProof({
    reviewer: "sam",
    proof,
    decision: "disputed",
    note: "I disagree.",
  });

  const rows =
    await proofs._verificationsByProof({
      proof,
    });

  expect(rows).toHaveLength(2);

  expect(
    rows.map((row) => row.reviewer),
  ).toEqual(
    expect.arrayContaining(["alex", "sam"]),
  );
});

test("verifications are returned only for the requested proof", async () => {
  const { proof: firstProof } =
    await createProof({
      commitment: "commitment-1",
    });

  const { proof: secondProof } =
    await createProof({
      commitment: "commitment-2",
    });

  await proofs.reviewProof({
    reviewer: "alex",
    proof: firstProof,
    decision: "verified",
    note: "First proof review",
  });

  await proofs.reviewProof({
    reviewer: "sam",
    proof: secondProof,
    decision: "verified",
    note: "Second proof review",
  });

  const rows =
    await proofs._verificationsByProof({
      proof: firstProof,
    });

  expect(rows).toHaveLength(1);
  expect(rows[0]?.reviewer).toBe("alex");
});

test("a proof with no reviews gets an empty verification list", async () => {
  const { proof } = await createProof();

  const rows =
    await proofs._verificationsByProof({
      proof,
    });

  expect(rows).toEqual([]);
});

test("verifications are returned in creation order", async () => {
  const { proof } = await createProof();

  await proofs.reviewProof({
    reviewer: "alex",
    proof,
    decision: "verified",
    note: "First review",
  });

  // Make the timestamps distinct so creation order is unambiguous.
  await new Promise((resolve) =>
    setTimeout(resolve, 2),
  );

  await proofs.reviewProof({
    reviewer: "sam",
    proof,
    decision: "disputed",
    note: "Second review",
  });

  const rows =
    await proofs._verificationsByProof({
      proof,
    });

  expect(rows.map((row) => row.reviewer)).toEqual([
    "alex",
    "sam",
  ]);
});