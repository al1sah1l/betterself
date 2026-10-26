
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

import {
  SubmitProof,
} from "../../src/compositions/proofs.ts";

import {
  CurrentUser,
} from "../../src/compositions/authentication.ts";

import {
  RecordCompletionFromProof,
} from "../../src/compositions/completion.ts";

import {
  ShareProofWithGroup,
} from "../../src/compositions/proof-sharing.ts";

import {
  handleImageRequest,
  imageEvidenceIsOwned,
} from "../../src/http/images.ts";

import {
  openTestDb,
  type TestDb,
} from "../test-db.ts";

let testDb: TestDb;

function createApp() {
  const instances =
    applicationConceptSet.implementations("mongo", {
      db: testDb.db,
    });

  return assemble({
    conceptSet: applicationConceptSet,
    instances,
    composition: {
      BetterSelf: {
        authentication: {
          CurrentUser,
        },
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
      },
    },
  });
}

type TestApp = ReturnType<typeof createApp>;

async function sessionFor(
  app: TestApp,
  user: string,
): Promise<string> {
  const result =
    await app.concepts.Sessioning.start({
      subject: user,
    });

  if (
    !result ||
    typeof result !== "object" ||
    !("session" in result) ||
    typeof result.session !== "string"
  ) {
    throw new Error("Session creation failed");
  }

  return result.session;
}

async function invokeValue<T>(
  app: TestApp,
  path: string,
  input: Record<string, unknown>,
): Promise<T> {
  const result = await app.invoker.invoke(
    path,
    input,
  );

  if (!result.ok) {
    throw new Error(JSON.stringify(result.error));
  }

  return result.value as T;
}

const png = Uint8Array.from([
  137, 80, 78, 71, 13, 10, 26, 10,
  0, 0, 0, 0,
]);

function imageHandler(
  app: TestApp,
  request: Request,
): Promise<Response> {
  return handleImageRequest(
    request,
    (path, input) =>
      app.invoker.invoke(path, input),
    testDb.db,
  );
}

async function uploadImage(
  app: TestApp,
  session: string,
): Promise<string> {
  const form = new FormData();

  form.set("session", session);
  form.set(
    "image",
    new File(
      [new Uint8Array(png)],
      "evidence.png",
      { type: "image/png" },
    ),
  );

  const response = await imageHandler(
    app,
    new Request(
      "http://localhost/api/images/upload",
      {
        method: "POST",
        body: form,
      },
    ),
  );

  expect(response.status).toBe(200);

  const result = await response.json() as {
    evidence: string;
  };

  return result.evidence;
}

async function viewImage(
  app: TestApp,
  session: string,
  evidence: string,
): Promise<Response> {
  return imageHandler(
    app,
    new Request(
      "http://localhost/api/images/view",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          session,
          evidence,
        }),
      },
    ),
  );
}

beforeAll(async () => {
  testDb = await openTestDb();
}, 120_000);

beforeEach(async () => {
  await testDb.db.dropDatabase();
});

afterAll(async () => {
  await testDb.close();
});

test(
  "three images create one proof and one completion, with group access",
  async () => {
    const app = createApp();

    const maya = await sessionFor(app, "maya");
    const alex = await sessionFor(app, "alex");
    const charlie = await sessionFor(app, "charlie");

    // Create a real goal.
    const goalResult =
      await app.concepts.GoalPlanning.createGoal({
        owner: "maya",
        outcome: "Finish my portfolio",
        currentContext: "I have three projects",
        constraints: "Five hours per week",
        timeline: "This semester",
        successDefinition: "Portfolio published",
      });

    if (
      !("goal" in goalResult) ||
      typeof goalResult.goal !== "string"
    ) {
      throw new Error("Goal creation failed");
    }

    const goal = goalResult.goal;

    // One-time commitment.
    const commitmentResult =
      await app.concepts.CommitmentTracking.createCommitment({
        goal,
        description: "Publish portfolio homepage",
        recurring: false,
        schedule: "This week",
      });

    if (
      !("commitment" in commitmentResult) ||
      typeof commitmentResult.commitment !== "string"
    ) {
      throw new Error("Commitment creation failed");
    }

    const commitment = commitmentResult.commitment;

    // Create, join, and attach group.
    const { group } =
      await invokeValue<{ group: string }>(
        app,
        "/groups/create",
        {
          session: maya,
          name: "Portfolio Accountability",
          topic: "Career development",
        },
      );

    await invokeValue(
      app,
      "/groups/join",
      {
        session: alex,
        group,
      },
    );

    await invokeValue(
      app,
      "/groups/attach-goal",
      {
        session: maya,
        group,
        goal,
      },
    );

    // Three separate image uploads.
    const images = [
      await uploadImage(app, maya),
      await uploadImage(app, maya),
      await uploadImage(app, maya),
    ];

    expect(new Set(images).size).toBe(3);

    // The submitter owns all three references.
    expect(
      await imageEvidenceIsOwned(
        (path, input) =>
          app.invoker.invoke(path, input),
        maya,
        images,
        testDb.db,
      ),
    ).toBe(true);

    // Another user cannot attach Maya's images.
    expect(
      await imageEvidenceIsOwned(
        (path, input) =>
          app.invoker.invoke(path, input),
        charlie,
        images,
        testDb.db,
      ),
    ).toBe(false);

    const occurrence =
      new Date("2026-10-26T15:00:00.000Z");

    // Submit ONE proof with ALL three images.
    const { proof } =
      await invokeValue<{ proof: string }>(
        app,
        "/proofs/submit",
        {
          session: maya,
          goal,
          commitment,
          occurrence,
          evidence: [
            "Portfolio published",
            ...images,
          ],
        },
      );

    await app.whenIdle();

    const savedProof =
      await app.concepts.ProofVerifying._proof({
        proof,
      });

    expect(savedProof).toHaveLength(1);
    expect(savedProof[0].evidence).toEqual([
      "Portfolio published",
      ...images,
    ]);

    // Exactly ONE completion claim.
    const completions =
      await app.concepts.CommitmentTracking
        ._completionsByCommitment({
          commitment,
        });

    expect(completions).toHaveLength(1);

    // Exactly ONE shared proof.
    const shared =
      await app.concepts.AccountabilityGrouping
        ._sharedProofs({
          group,
        });

    expect(shared).toEqual([{ proof }]);

    // Author and group member can view.
    for (const image of images) {
      expect(
        (await viewImage(app, maya, image)).status,
      ).toBe(200);

      expect(
        (await viewImage(app, alex, image)).status,
      ).toBe(200);

      expect(
        (await viewImage(app, charlie, image)).status,
      ).toBe(403);
    }

    // One-time commitment cannot be completed again.
    const duplicate =
      await app.invoker.invoke(
        "/proofs/submit",
        {
          session: maya,
          goal,
          commitment,
          occurrence:
            new Date("2026-10-26T16:00:00.000Z"),
          evidence: ["Another submission"],
        },
      );

    expect(duplicate.ok).toBe(false);

    await app.whenIdle();

    const finalCompletions =
      await app.concepts.CommitmentTracking
        ._completionsByCommitment({
          commitment,
        });

    expect(finalCompletions).toHaveLength(1);
  },
);
