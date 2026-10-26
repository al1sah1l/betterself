
import type { Db } from "mongodb";

type ProofDocument = {
  _id: string;
  goal: string;
};

const tails = new Map<string, Promise<void>>();

export async function withGoalLock<T>(
  goal: string,
  operation: () => Promise<T>,
): Promise<T> {
  const previous = tails.get(goal) ?? Promise.resolve();

  let release!: () => void;

  const current = new Promise<void>((resolve) => {
    release = resolve;
  });

  const tail = previous.then(() => current);
  tails.set(goal, tail);

  await previous;

  try {
    return await operation();
  } finally {
    release();

    if (tails.get(goal) === tail) {
      tails.delete(goal);
    }
  }
}

const GUARDED_PATHS = new Set([
  "/goals/set-strategy",
  "/goals/update",
  "/commitments/create",
  "/commitments/retire",
  "/proofs/submit",
  "/groups/attach-goal",
  "/results/record",
  "/results/remove",
  "/reviews/apply",
]);

const PROOF_SCOPED_PATHS = new Set([
  "/proofs/resubmit",
  "/proofs/delete",
]);

export function guardedGoalId(
  path: string,
  input: unknown,
): string | null {
  if (!GUARDED_PATHS.has(path)) {
    return null;
  }

  if (
    typeof input !== "object" ||
    input === null ||
    !("goal" in input)
  ) {
    return null;
  }

  const goal = input.goal;

  return typeof goal === "string" && goal.trim()
    ? goal
    : null;
}

export function isProofScopedMutation(
  path: string,
): boolean {
  return PROOF_SCOPED_PATHS.has(path);
}

/**
 * Resolve the goal associated with a proof.
 *
 * This lookup alone is NOT a concurrency guarantee.
 * Callers must acquire the goal lock and then
 * revalidate the relationship.
 */
export async function goalForProof(
  database: Db,
  proofId: string,
): Promise<string | null> {
  if (!proofId) return null;

  const original = await database
    .collection<ProofDocument>("proofVerifying.proofs")
    .findOne(
      { _id: proofId },
      { projection: { goal: 1 } },
    );

  if (original) return original.goal;

  const attempt = await database
    .collection<ProofDocument>("proofVerifying.attempts")
    .findOne(
      { _id: proofId },
      { projection: { goal: 1 } },
    );

  return attempt?.goal ?? null;
}

/**
 * Recheck a proof relationship inside its goal lock.
 */
export async function proofStillBelongsToGoal(
  database: Db,
  proofId: string,
  goalId: string,
): Promise<boolean> {
  return (await goalForProof(database, proofId)) === goalId;
}

export async function withExistingGoal<T>(
  database: Db,
  goal: string,
  operation: () => Promise<T>,
  missing: () => T,
): Promise<T> {
  return withGoalLock(goal, async () => {
    const existing = await database
      .collection<{ _id: string }>("goalPlanning.goals")
      .findOne(
        { _id: goal },
        { projection: { _id: 1 } },
      );

    if (!existing) {
      return missing();
    }

    return operation();
  });
}
