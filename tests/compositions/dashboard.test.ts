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
  ListMyGoals,
  MyGoals,
} from "../../src/compositions/dashboard.ts";

import {
  GetGoalDetail,
  GoalDetail,
} from "../../src/compositions/goal-detail.ts";

import {
  ListMyGroups,
  MyGroups,
} from "../../src/compositions/my-groups.ts";

import {
  GroupMember,
  GroupProofs,
  ListGroupProofs,
} from "../../src/compositions/group-proofs.ts";

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
        dashboard: {
          ListMyGoals,
          MyGoals,
          GetGoalDetail,
          GoalDetail,
          ListMyGroups,
          MyGroups,
          GroupMember,
          GroupProofs,
          ListGroupProofs,
        },
        verification: {
          ReviewProof,
        },
      },
    },
  });
}

type TestApplication =
  ReturnType<typeof assembleTestApplication>;

async function createSession(
  app: TestApplication,
  subject: string,
) {
  const result = await app.concepts.Sessioning.start({
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

const goalContext = {
  outcome: "Get a software engineering internship",
  currentContext: "I have a resume but have not started applying.",
  constraints: "Five hours per week.",
  timeline: "By summer 2027",
  successDefinition: "Receive and accept an internship offer.",
};

async function createGoal(
  app: TestApplication,
  owner: string,
) {
  const result = await app.concepts.GoalPlanning.createGoal({
    owner,
    ...goalContext,
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

async function createGroup(
  app: TestApplication,
  owner: string,
  name: string,
) {
  const result =
    await app.concepts.AccountabilityGrouping.createGroup({
      owner,
      name,
      topic: "Self-directed goals",
    });

  if (
    typeof result !== "object" ||
    result === null ||
    !("group" in result) ||
    typeof result.group !== "string"
  ) {
    throw new Error("Could not create group.");
  }

  return result.group;
}

type GoalsResponse = {
  goals: Array<{
    goal: string;
    outcome: string;
    currentContext: string;
    constraints: string;
    timeline: string;
    successDefinition: string;
  }>;
};

async function listGoals(
  app: TestApplication,
  session: string,
  user?: string,
): Promise<GoalsResponse> {
  const result = await app.invoker.invoke(
    "/dashboard/goals",
    {
      session,
      ...(user === undefined ? {} : { user }),
    },
  );

  if (!result.ok) {
    throw new Error(JSON.stringify(result.error));
  }

  return result.value as GoalsResponse;
}

test("authenticated user sees only their own goals and goal context", async () => {
  const app = assembleTestApplication();

  const mayaSession = await createSession(app, "maya");
  const alexSession = await createSession(app, "alex");

  const mayaGoal = await createGoal(app, "maya");
  const alexGoal = await createGoal(app, "alex");

  const mayaResponse = await listGoals(app, mayaSession);
  const alexResponse = await listGoals(app, alexSession);

  expect(mayaResponse.goals).toEqual([
    { goal: mayaGoal, ...goalContext },
  ]);

  expect(alexResponse.goals).toEqual([
    { goal: alexGoal, ...goalContext },
  ]);
});

test("user with no goals receives an empty list", async () => {
  const app = assembleTestApplication();

  await createGoal(app, "maya");
  const alexSession = await createSession(app, "alex");

  const response = await listGoals(app, alexSession);

  expect(response.goals).toEqual([]);
});

test("client-supplied user cannot change whose goals are returned", async () => {
  const app = assembleTestApplication();

  const mayaGoal = await createGoal(app, "maya");
  await createGoal(app, "alex");

  const mayaSession = await createSession(app, "maya");

  const response = await listGoals(
    app,
    mayaSession,
    "alex",
  );

  expect(response.goals).toEqual([
    { goal: mayaGoal, ...goalContext },
  ]);
});

test("invalid session cannot list goals", async () => {
  const app = assembleTestApplication();

  await createGoal(app, "maya");

  const result = await app.invoker.invoke(
    "/dashboard/goals",
    {
      session: "invalid-session",
    },
  );

  expect(result.ok).toBe(false);
});

test("owner can open a goal without strategy or commitments", async () => {
  const app = assembleTestApplication();

  const session = await createSession(app, "maya");
  const goal = await createGoal(app, "maya");

  const result = await app.invoker.invoke(
    "/dashboard/goal",
    {
      session,
      goal,
    },
  );

  if (!result.ok) {
    throw new Error(JSON.stringify(result.error));
  }

  expect(result.value).toEqual({
    detail: {
      goal,
      ...goalContext,
      currentStrategy: null,
      group: null,
      commitments: [],
    },
  });
});

test("another user cannot open someone else's goal", async () => {
  const app = assembleTestApplication();

  const goal = await createGoal(app, "maya");
  const session = await createSession(app, "alex");

  const result = await app.invoker.invoke(
    "/dashboard/goal",
    { session, goal },
  );

  if (result.ok) {
    throw new Error("Expected request to be forbidden.");
  }

  expect(result.error).toEqual({
    kind: "domain",
    value: "FORBIDDEN",
  });
});

test("opening a missing goal returns GOAL_NOT_FOUND", async () => {
  const app = assembleTestApplication();

  const session = await createSession(app, "maya");

  const result = await app.invoker.invoke(
    "/dashboard/goal",
    {
      session,
      goal: "missing-goal",
    },
  );

  if (result.ok) {
    throw new Error("Expected missing goal error.");
  }

  expect(result.error).toEqual({
    kind: "domain",
    value: "GOAL_NOT_FOUND",
  });
});

test("invalid session cannot open goal detail", async () => {
  const app = assembleTestApplication();

  const goal = await createGoal(app, "maya");

  const result = await app.invoker.invoke(
    "/dashboard/goal",
    {
      session: "invalid-session",
      goal,
    },
  );

  expect(result.ok).toBe(false);
});

test("goal detail includes saved strategy, attached group, completion claims, and only this goal's commitments", async () => {
  const app = assembleTestApplication();

  const session = await createSession(app, "maya");
  const goal = await createGoal(app, "maya");
  const otherGoal = await createGoal(app, "maya");

  const strategy = [
    {
      description: "Prepare a resume for internship applications.",
      successCriterion: "One updated resume is ready to submit.",
    },
  ];

  await app.concepts.GoalPlanning.setStrategy({
    goal,
    strategy,
  });

  const commitmentFields = {
    description: "Update my resume",
    recurring: false,
    schedule: "By Friday",
  };

  const created =
    await app.concepts.CommitmentTracking.createCommitment({
      goal,
      ...commitmentFields,
    });

  if (
    typeof created !== "object" ||
    created === null ||
    !("commitment" in created) ||
    typeof created.commitment !== "string"
  ) {
    throw new Error("Could not create commitment.");
  }

  await app.concepts.CommitmentTracking.createCommitment({
    goal: otherGoal,
    description: "This belongs to another goal",
    recurring: true,
    schedule: "Every Monday",
  });

  const group = await createGroup(
    app,
    "maya",
    "Career Accountability",
  );

  await app.concepts.AccountabilityGrouping.attachGoal({
    group,
    user: "maya",
    goal,
  });

  const occurrence = new Date("2026-10-14T17:00:00.000Z");

  const claimed =
    await app.concepts.CommitmentTracking.claimComplete({
      commitment: created.commitment,
      occurrence,
    });

  if (
    typeof claimed !== "object" ||
    claimed === null ||
    !("completion" in claimed) ||
    typeof claimed.completion !== "string"
  ) {
    throw new Error("Could not create completion claim.");
  }

  const result = await app.invoker.invoke(
    "/dashboard/goal",
    { session, goal },
  );

  if (!result.ok) {
    throw new Error(JSON.stringify(result.error));
  }

  expect(result.value).toEqual({
    detail: {
      goal,
      ...goalContext,
      currentStrategy: strategy,
      group,
      commitments: [
        {
          commitment: created.commitment,
          ...commitmentFields,
          active: true,
          sourceStep: null,
          proofs: [],
          completions: [
            {
              completion: claimed.completion,
              occurrence,
              proofs: [],
            },
          ],
        },
      ],
    },
  });
});

test("my groups includes owned and joined groups but excludes other groups", async () => {
  const app = assembleTestApplication();

  const session = await createSession(app, "maya");

  const ownedGroup = await createGroup(
    app,
    "maya",
    "Maya's group",
  );

  const joinedGroup = await createGroup(
    app,
    "alex",
    "Shared group",
  );

  await app.concepts.AccountabilityGrouping.joinGroup({
    group: joinedGroup,
    user: "maya",
  });

  await createGroup(app, "alex", "Alex's private group");

  const result = await app.invoker.invoke(
    "/dashboard/groups",
    {
      session,
      user: "alex",
    },
  );

  if (!result.ok) {
    throw new Error(JSON.stringify(result.error));
  }

  const value = result.value as {
    groups: Array<{
      group: string;
      name: string;
      topic: string;
    }>;
  };

  expect(value.groups).toHaveLength(2);

  expect(value.groups).toContainEqual({
    group: ownedGroup,
    name: "Maya's group",
    topic: "Self-directed goals",
  });

  expect(value.groups).toContainEqual({
    group: joinedGroup,
    name: "Shared group",
    topic: "Self-directed goals",
  });
});

test("user with no memberships receives an empty group list", async () => {
  const app = assembleTestApplication();

  await createGroup(app, "alex", "Alex's group");

  const session = await createSession(app, "maya");

  const result = await app.invoker.invoke(
    "/dashboard/groups",
    { session },
  );

  if (!result.ok) {
    throw new Error(JSON.stringify(result.error));
  }

  expect(result.value).toEqual({
    groups: [],
  });
});

test("invalid session cannot list groups", async () => {
  const app = assembleTestApplication();

  await createGroup(app, "maya", "Maya's group");

  const result = await app.invoker.invoke(
    "/dashboard/groups",
    {
      session: "invalid-session",
    },
  );

  expect(result.ok).toBe(false);
});

test("joined member can read an empty group proof list", async () => {
  const app = assembleTestApplication();

  const group = await createGroup(app, "maya", "Shared group");

  await app.concepts.AccountabilityGrouping.joinGroup({
    group,
    user: "alex",
  });

  const session = await createSession(app, "alex");

  const result = await app.invoker.invoke(
    "/dashboard/group-proofs",
    { session, group },
  );

  if (!result.ok) {
    throw new Error(JSON.stringify(result.error));
  }

  expect(result.value).toEqual({ proofs: [] });
});

test("nonmember cannot read group proofs even with a supplied member identity", async () => {
  const app = assembleTestApplication();

  const group = await createGroup(app, "maya", "Maya's group");
  const session = await createSession(app, "alex");

  const result = await app.invoker.invoke(
    "/dashboard/group-proofs",
    {
      session,
      group,
      user: "maya",
    },
  );

  if (result.ok) {
    throw new Error("Expected request to be forbidden.");
  }

  expect(result.error).toEqual({
    kind: "domain",
    value: "FORBIDDEN",
  });
});

test("missing group returns GROUP_NOT_FOUND", async () => {
  const app = assembleTestApplication();

  const session = await createSession(app, "maya");

  const result = await app.invoker.invoke(
    "/dashboard/group-proofs",
    {
      session,
      group: "missing-group",
    },
  );

  if (result.ok) {
    throw new Error("Expected missing group error.");
  }

  expect(result.error).toEqual({
    kind: "domain",
    value: "GROUP_NOT_FOUND",
  });
});

test("invalid session cannot read group proofs", async () => {
  const app = assembleTestApplication();

  const group = await createGroup(app, "maya", "Maya's group");

  const result = await app.invoker.invoke(
    "/dashboard/group-proofs",
    {
      session: "invalid-session",
      group,
    },
  );

  expect(result.ok).toBe(false);
});

test("group proofs includes evidence and updates after peer review", async () => {
  const app = assembleTestApplication();

  const goal = await createGoal(app, "maya");
  const group = await createGroup(app, "maya", "Shared group");
  const session = await createSession(app, "alex");

  await app.concepts.AccountabilityGrouping.joinGroup({
    group,
    user: "alex",
  });

  await app.concepts.AccountabilityGrouping.attachGoal({
    group,
    user: "maya",
    goal,
  });

  const created =
    await app.concepts.CommitmentTracking.createCommitment({
      goal,
      description: "Apply to five internships",
      recurring: true,
      schedule: "Every Monday",
    });

  if (
    typeof created !== "object" ||
    created === null ||
    !("commitment" in created) ||
    typeof created.commitment !== "string"
  ) {
    throw new Error("Could not create commitment.");
  }

  const commitment = created.commitment;
  const occurrence = new Date("2026-10-12T17:00:00.000Z");
  const evidence = [
    "Screenshot of submitted applications",
    "Application confirmation email",
  ];

  const submitted = await app.concepts.ProofVerifying.submitProof({
    submitter: "maya",
    goal,
    commitment,
    occurrence,
    evidence,
  });

  if (
    typeof submitted !== "object" ||
    submitted === null ||
    !("proof" in submitted) ||
    typeof submitted.proof !== "string"
  ) {
    throw new Error("Could not submit proof.");
  }

  const proof = submitted.proof;

  await app.concepts.AccountabilityGrouping.shareProof({
    goal,
    proof,
  });

  const expectedProof = {
    proof,
    submitter: "maya",
    goal,
    commitment,
    occurrence,
    evidence,
    outcome: "Get a software engineering internship",
    successDefinition: "Receive and accept an internship offer.",
    description: "Apply to five internships",
    recurring: true,
    schedule: "Every Monday",
    sourceStep: null,
    strategy: [],
    strategyRevision: "initial",
    attempt: 1,
    current: true,
  };

  const before = await app.invoker.invoke(
    "/dashboard/group-proofs",
    { session, group },
  );

  if (!before.ok) {
    throw new Error(JSON.stringify(before.error));
  }

  expect(before.value).toEqual({
    proofs: [
      {
        ...expectedProof,
        verifications: [],
      },
    ],
  });

  const note = "The evidence supports the claimed completion.";

  const reviewed = await app.invoker.invoke(
    "/proofs/review",
    {
      session,
      proof,
      decision: "verified",
      note,
    },
  );

  if (!reviewed.ok) {
    throw new Error(JSON.stringify(reviewed.error));
  }

  await app.whenIdle();

  const after = await app.invoker.invoke(
    "/dashboard/group-proofs",
    { session, group },
  );

  if (!after.ok) {
    throw new Error(JSON.stringify(after.error));
  }

  expect(after.value).toEqual({
    proofs: [
      {
        ...expectedProof,
        verifications: [
          {
            reviewer: "alex",
            decision: "verified",
            note,
          },
        ],
      },
    ],
  });
});

test("goal owner sees proof and peer review without a completion claim", async () => {
  const app = assembleTestApplication();

  const session = await createSession(app, "maya");
  const goal = await createGoal(app, "maya");

  const commitmentFields = {
    description: "Update my resume",
    recurring: false,
    schedule: "By Friday",
  };

  const created =
    await app.concepts.CommitmentTracking.createCommitment({
      goal,
      ...commitmentFields,
    });

  if (
    typeof created !== "object" ||
    created === null ||
    !("commitment" in created) ||
    typeof created.commitment !== "string"
  ) {
    throw new Error("Could not create commitment.");
  }

  const commitment = created.commitment;
  const occurrence = new Date("2026-10-14T17:00:00.000Z");
  const evidence = ["Link to my updated resume"];

  // Direct concept setup deliberately creates proof without a claim.
  const submitted =
    await app.concepts.ProofVerifying.submitProof({
      submitter: "maya",
      goal,
      commitment,
      occurrence,
      evidence,
    });

  if (
    typeof submitted !== "object" ||
    submitted === null ||
    !("proof" in submitted) ||
    typeof submitted.proof !== "string"
  ) {
    throw new Error("Could not submit proof.");
  }

  const proof = submitted.proof;
  const note = "The updated resume is visible.";

  await app.concepts.ProofVerifying.reviewProof({
    reviewer: "alex",
    proof,
    decision: "verified",
    note,
  });

  const completions =
    await app.concepts.CommitmentTracking._completionsByCommitment({
      commitment,
    });

  expect(completions).toEqual([]);

  const result = await app.invoker.invoke(
    "/dashboard/goal",
    { session, goal },
  );

  if (!result.ok) {
    throw new Error(JSON.stringify(result.error));
  }

  expect(result.value).toEqual({
    detail: {
      goal,
      ...goalContext,
      currentStrategy: null,
      group: null,
      commitments: [
        {
          commitment,
          ...commitmentFields,
          active: true,
          sourceStep: null,
          completions: [],
          proofs: [
            {
              proof,
              occurrence,
              evidence,
              attempt: 1,
              current: true,
              verifications: [
                {
                  reviewer: "alex",
                  decision: "verified",
                  note,
                },
              ],
            },
          ],
        },
      ],
    },
  });
});
