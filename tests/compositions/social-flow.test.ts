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
  CreateGroup,
  JoinGroup,
  AttachGoal,
} from "../../src/compositions/groups.ts";

import { SubmitProof } from "../../src/compositions/proofs.ts";

import { RecordCompletionFromProof } from "../../src/compositions/completion.ts";

import { ShareProofWithGroup } from "../../src/compositions/proof-sharing.ts";

import { ReviewProof } from "../../src/compositions/verification.ts";

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
        groups: {
          CreateGroup,
          JoinGroup,
          AttachGoal,
        },

        proofs: {
          SubmitProof,
        },

        completion: {
          RecordCompletionFromProof,
        },

        proofSharing: {
          ShareProofWithGroup,
        },

        verification: {
          ReviewProof,
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
        "Preparing for recruiting.",
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

async function createCommitment(
  app: ReturnType<typeof assembleTestApplication>,
  goal: string,
) {
  const result =
    await app.concepts.CommitmentTracking.createCommitment({
      goal,
      description:
        "Apply to five internships",
      recurring: true,
      schedule:
        "Every Monday",
    });

  if (
    typeof result !== "object" ||
    result === null ||
    !("commitment" in result) ||
    typeof result.commitment !== "string"
  ) {
    throw new Error(
      "Could not create commitment.",
    );
  }

  return result.commitment;
}

async function invokeValue<T>(
  app: ReturnType<typeof assembleTestApplication>,
  path: string,
  payload: Record<string, unknown>,
): Promise<T> {
  const result = await app.invoker.invoke(
    path,
    payload,
  );

  if (!result.ok) {
    throw new Error(
      JSON.stringify(result.error),
    );
  }

  return result.value as T;
}

test("full accountability flow shares and verifies proof", async () => {
  const app = assembleTestApplication();

  /*
   * 1. Maya and Alex have authenticated sessions.
   */
  const mayaSession = await createSession(
    app,
    "maya",
  );

  const alexSession = await createSession(
    app,
    "alex",
  );

  /*
   * 2. Maya already has a goal and commitment.
   */
  const goal = await createGoal(
    app,
    "maya",
  );

  const commitment = await createCommitment(
    app,
    goal,
  );

  /*
   * 3. Maya creates an accountability group.
   */
  const createdGroup =
    await invokeValue<{ group: string }>(
      app,
      "/groups/create",
      {
        session: mayaSession,
        name: "Internship Accountability",
        topic: "career",
      },
    );

  const group = createdGroup.group;

  expect(typeof group).toBe("string");

  /*
   * Creating a group automatically makes Maya
   * a member.
   */
  let members =
    await app.concepts.AccountabilityGrouping._members({
      group,
    });

  expect(members).toEqual([
    {
      user: "maya",
    },
  ]);

  /*
   * 4. Alex joins the group.
   */
  await invokeValue(
    app,
    "/groups/join",
    {
      session: alexSession,
      group,
    },
  );

  members =
    await app.concepts.AccountabilityGrouping._members({
      group,
    });

  expect(members).toEqual([
    {
      user: "maya",
    },
    {
      user: "alex",
    },
  ]);

  /*
   * 5. Maya attaches her goal to the group.
   */
  await invokeValue(
    app,
    "/groups/attach-goal",
    {
      session: mayaSession,
      group,
      goal,
    },
  );

  const attachment =
    await app.concepts.AccountabilityGrouping._groupForGoal({
      goal,
    });

  expect(attachment).toEqual([
    {
      group,
    },
  ]);

  /*
   * 6. Maya submits proof.
   */
  const occurrence =
    new Date("2026-10-12T17:00:00.000Z");

  const submittedProof =
    await invokeValue<{ proof: string }>(
      app,
      "/proofs/submit",
      {
        session: mayaSession,
        goal,
        commitment,
        occurrence,
        evidence: [
          "Screenshot of submitted applications",
          "Application confirmation email",
        ],
      },
    );

  const proof = submittedProof.proof;

  expect(typeof proof).toBe("string");

  /*
   * Allow the proof-triggered reactions to finish:
   *
   * submitProof
   *   -> claimComplete
   *   -> shareProof
   */
  await app.whenIdle();

  /*
   * 7. Completion was recorded automatically.
   */
  const completions =
    await app.concepts.CommitmentTracking._completionsByCommitment({
      commitment,
    });

  expect(completions).toHaveLength(1);

  expect(completions[0].occurrence).toEqual(
    occurrence,
  );

  /*
   * 8. Proof was automatically shared with
   * the attached accountability group.
   */
  const sharedProofs =
    await app.concepts.AccountabilityGrouping._sharedProofs({
      group,
    });

  expect(sharedProofs).toEqual([
    {
      proof,
    },
  ]);

  /*
   * 9. Alex verifies Maya's proof through the
   * session-protected review endpoint.
   */
  await invokeValue(
    app,
    "/proofs/review",
    {
      session: alexSession,
      proof,
      decision: "verified",
      note:
        "The evidence supports the claimed completion.",
    },
  );

  await app.whenIdle();

  /*
   * 10. Verification is stored as Alex,
   * derived from his session.
   */
  const verifications =
    await app.concepts.ProofVerifying._verificationsByProof({
      proof,
    });

  expect(verifications).toHaveLength(1);

  expect(verifications[0]).toMatchObject({
    reviewer: "alex",
    decision: "verified",
    note:
      "The evidence supports the claimed completion.",
  });
});
