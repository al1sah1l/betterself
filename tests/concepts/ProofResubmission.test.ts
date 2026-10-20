import {
  afterAll,
  beforeAll,
  beforeEach,
  expect,
  test,
} from "bun:test";

import {
  ProofVerifyingConcept,
} from "../../src/concepts/ProofVerifying/ProofVerifying.ts";

import { openTestDb, type TestDb } from "../test-db.ts";

let testDb: TestDb;
let proofs: ProofVerifyingConcept<string, string, string, string>;

const occurrence = new Date("2026-10-12T17:00:00.000Z");

beforeAll(async () => {
  testDb = await openTestDb();
}, 120_000);

beforeEach(async () => {
  await testDb.db.dropDatabase();

  proofs = new ProofVerifyingConcept(testDb.db);
});

afterAll(async () => {
  await testDb.close();
});

async function submit() {
  return proofs.submitProof({
    submitter: "maya",
    goal: "goal-1",
    commitment: "commitment-1",
    occurrence,
    evidence: ["Original evidence"],
  });
}

async function dispute(proof: string) {
  await proofs.reviewProof({
    reviewer: "alex",
    proof,
    decision: "disputed",
    note: "Please provide clearer evidence.",
  });
}

test("resubmission preserves the previous proof and its reviews", async () => {
  const original = await submit();
  await dispute(original.proof);

  const revised = await proofs.resubmitProof({
    submitter: "maya",
    previousProof: original.proof,
    evidence: ["Clearer evidence"],
  });

  expect(revised.proof).not.toBe(original.proof);

  expect(await proofs._proof({ proof: original.proof })).toEqual([{
    submitter: "maya",
    goal: "goal-1",
    commitment: "commitment-1",
    occurrence,
    evidence: ["Original evidence"],
  }]);

  expect(
    await proofs._verificationsByProof({ proof: original.proof }),
  ).toEqual([{
    reviewer: "alex",
    decision: "disputed",
    note: "Please provide clearer evidence.",
  }]);

  expect(
    await proofs._verificationsByProof({ proof: revised.proof }),
  ).toEqual([]);

  expect(
    await proofs._proofAttempt({ proof: original.proof }),
  ).toEqual([{ attempt: 1, current: false }]);

  expect(
    await proofs._proofAttempt({ proof: revised.proof }),
  ).toEqual([{ attempt: 2, current: true }]);

  expect(
    await proofs._proofForOccurrence({
      commitment: "commitment-1",
      occurrence,
    }),
  ).toEqual([{
    proof: revised.proof,
    submitter: "maya",
    goal: "goal-1",
    evidence: ["Clearer evidence"],
  }]);

  expect(
    await proofs._proofsByCommitment({
      commitment: "commitment-1",
    }),
  ).toHaveLength(2);
});

test("pending, verified, and mixed proofs cannot be resubmitted", async () => {
  const original = await submit();

  await expect(
    proofs.resubmitProof({
      submitter: "maya",
      previousProof: original.proof,
      evidence: ["New evidence"],
    }),
  ).rejects.toThrow(
    "Only a disputed proof without verified reviews can be resubmitted.",
  );

  await proofs.reviewProof({
    reviewer: "sam",
    proof: original.proof,
    decision: "verified",
    note: "Looks complete.",
  });

  await expect(
    proofs.resubmitProof({
      submitter: "maya",
      previousProof: original.proof,
      evidence: ["New evidence"],
    }),
  ).rejects.toThrow(
    "Only a disputed proof without verified reviews can be resubmitted.",
  );

  await dispute(original.proof);

  await expect(
    proofs.resubmitProof({
      submitter: "maya",
      previousProof: original.proof,
      evidence: ["New evidence"],
    }),
  ).rejects.toThrow(
    "Only a disputed proof without verified reviews can be resubmitted.",
  );

  expect(
    await proofs._proofsByCommitment({ commitment: "commitment-1" }),
  ).toHaveLength(1);
});

test("resubmission checks author, existence, and evidence without adding attempts", async () => {
  const original = await submit();
  await dispute(original.proof);

  await expect(
    proofs.resubmitProof({
      submitter: "alex",
      previousProof: original.proof,
      evidence: ["New evidence"],
    }),
  ).rejects.toThrow("Only the submitter can resubmit this proof.");

  await expect(
    proofs.resubmitProof({
      submitter: "maya",
      previousProof: "missing",
      evidence: ["New evidence"],
    }),
  ).rejects.toThrow("There is no such proof.");

  await expect(
    proofs.resubmitProof({
      submitter: "maya",
      previousProof: original.proof,
      evidence: [],
    }),
  ).rejects.toThrow("At least one piece of evidence is required.");

  expect(
    await proofs._proofsByCommitment({ commitment: "commitment-1" }),
  ).toHaveLength(1);

  expect(
    await proofs._proofAttempt({ proof: original.proof }),
  ).toEqual([{ attempt: 1, current: true }]);
});

test("only one concurrent resubmission succeeds", async () => {
  const original = await submit();
  await dispute(original.proof);

  const results = await Promise.allSettled([
    proofs.resubmitProof({
      submitter: "maya",
      previousProof: original.proof,
      evidence: ["First new evidence"],
    }),
    proofs.resubmitProof({
      submitter: "maya",
      previousProof: original.proof,
      evidence: ["Second new evidence"],
    }),
  ]);

  expect(
    results.filter((result) => result.status === "fulfilled"),
  ).toHaveLength(1);

  expect(
    results.filter((result) => result.status === "rejected"),
  ).toHaveLength(1);

  expect(
    await proofs._proofsByCommitment({ commitment: "commitment-1" }),
  ).toHaveLength(2);
});

test("superseded proofs cannot receive new reviews", async () => {
  const original = await submit();
  await dispute(original.proof);

  await proofs.resubmitProof({
    submitter: "maya",
    previousProof: original.proof,
    evidence: ["Clearer evidence"],
  });

  await expect(
    proofs.reviewProof({
      reviewer: "sam",
      proof: original.proof,
      decision: "verified",
      note: "Reviewing old evidence",
    }),
  ).rejects.toThrow("This proof has a newer submission.");

  expect(
    await proofs._verificationsByProof({ proof: original.proof }),
  ).toHaveLength(1);
});

test("deleting a pending attempt restores its disputed predecessor", async () => {
  const original = await submit();
  await dispute(original.proof);

  const revised = await proofs.resubmitProof({
    submitter: "maya",
    previousProof: original.proof,
    evidence: ["Clearer evidence"],
  });

  await proofs.deletePendingProof({
    submitter: "maya",
    proof: revised.proof,
  });

  expect(
    await proofs._proof({ proof: revised.proof }),
  ).toEqual([]);

  expect(
    await proofs._proofAttempt({ proof: original.proof }),
  ).toEqual([{ attempt: 1, current: true }]);

  const another = await proofs.resubmitProof({
    submitter: "maya",
    previousProof: original.proof,
    evidence: ["Another attempt"],
  });

  expect(
    await proofs._proofAttempt({ proof: another.proof }),
  ).toEqual([{ attempt: 2, current: true }]);
});
