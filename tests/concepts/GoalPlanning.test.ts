import { afterAll, beforeAll, beforeEach, expect, test } from "bun:test";
import { GoalPlanningConcept } from "../../src/concepts/GoalPlanning/GoalPlanning.ts";
import { openTestDb, type TestDb } from "../test-db.ts";

let testDb: TestDb;
let goals: GoalPlanningConcept<string>;

beforeAll(async () => {
  testDb = await openTestDb();
}, 120_000);

beforeEach(async () => {
  await testDb.db.dropDatabase();
  goals = new GoalPlanningConcept<string>(testDb.db);
});

afterAll(async () => {
  await testDb.close();
});

test("a user can create and retrieve a goal", async () => {
  const { goal } = await goals.createGoal({
    owner: "maya",
    outcome: "Get a software engineering internship",
    currentContext: "Computer science student with limited internship experience",
    constraints: "Balancing recruiting with coursework",
    timeline: "By Summer 2027",
    successDefinition: "Receive and accept a software engineering internship offer",
  });

  const rows = await goals._goal({ goal });

  expect(rows).toHaveLength(1);
  expect(rows[0]?.owner).toBe("maya");
  expect(rows[0]?.outcome).toBe(
    "Get a software engineering internship",
  );
});

test("a user can set a strategy for a goal", async () => {
  const { goal } = await goals.createGoal({
    owner: "maya",
    outcome: "Get a software engineering internship",
    currentContext: "Computer science student",
    constraints: "Limited time",
    timeline: "By Summer 2027",
    successDefinition: "Receive and accept an internship offer",
  });

  const strategy = [
    {
      description: "Reach out to alumni and recruiters",
      successCriterion: "Complete 5 networking conversations",
    },
    {
      description: "Apply to relevant positions",
      successCriterion: "Submit 20 targeted applications",
    },
  ];

  await goals.setStrategy({
    goal,
    strategy,
  });

  const rows = await goals._goal({ goal });

  expect(rows).toHaveLength(1);
  expect(rows[0]?.currentStrategy).toEqual(strategy);
});

test("a user can revise an existing strategy", async () => {
  const { goal } = await goals.createGoal({
    owner: "maya",
    outcome: "Get a software engineering internship",
    currentContext: "Computer science student",
    constraints: "Limited time",
    timeline: "By Summer 2027",
    successDefinition: "Receive and accept an internship offer",
  });

  await goals.setStrategy({
    goal,
    strategy: [
      {
        description: "Apply broadly",
        successCriterion: "Submit 30 applications",
      },
    ],
  });

  const revisedStrategy = [
    {
      description: "Focus on targeted applications",
      successCriterion: "Submit 15 tailored applications",
    },
    {
      description: "Network with alumni",
      successCriterion: "Complete 5 networking conversations",
    },
  ];

  await goals.reviseStrategy({
    goal,
    strategy: revisedStrategy,
  });

  const rows = await goals._goal({ goal });

  expect(rows[0]?.currentStrategy).toEqual(revisedStrategy);
});

test("a strategy cannot be set twice", async () => {
  const { goal } = await goals.createGoal({
    owner: "maya",
    outcome: "Get a software engineering internship",
    currentContext: "Computer science student",
    constraints: "Limited time",
    timeline: "By Summer 2027",
    successDefinition: "Receive and accept an internship offer",
  });

  await goals.setStrategy({
    goal,
    strategy: [
      {
        description: "Apply to internships",
        successCriterion: "Submit 20 applications",
      },
    ],
  });

  expect(
    goals.setStrategy({
      goal,
      strategy: [
        {
          description: "Use a different strategy",
          successCriterion: "Complete 10 networking conversations",
        },
      ],
    }),
  ).rejects.toThrow("This goal already has a strategy.");
});

test("a strategy cannot be revised before it is set", async () => {
  const { goal } = await goals.createGoal({
    owner: "maya",
    outcome: "Get a software engineering internship",
    currentContext: "Computer science student",
    constraints: "Limited time",
    timeline: "By Summer 2027",
    successDefinition: "Receive and accept an internship offer",
  });

  expect(
    goals.reviseStrategy({
      goal,
      strategy: [
        {
          description: "Focus on networking",
          successCriterion: "Complete 5 networking conversations",
        },
      ],
    }),
  ).rejects.toThrow("This goal does not have a strategy yet.");
});

test("a user can update a goal", async () => {
  const { goal } = await goals.createGoal({
    owner: "maya",
    outcome: "Get an internship",
    currentContext: "Computer science student",
    constraints: "Limited time",
    timeline: "By Summer 2027",
    successDefinition: "Receive an internship offer",
  });

  await goals.updateGoal({
    goal,
    outcome: "Get a software engineering internship",
    currentContext: "Computer science student with project experience",
    constraints: "Balancing recruiting with coursework",
    timeline: "By May 2027",
    successDefinition: "Receive and accept a software engineering internship offer",
  });

  const rows = await goals._goal({ goal });

  expect(rows).toHaveLength(1);
  expect(rows[0]?.outcome).toBe(
    "Get a software engineering internship",
  );
  expect(rows[0]?.currentContext).toBe(
    "Computer science student with project experience",
  );
  expect(rows[0]?.constraints).toBe(
    "Balancing recruiting with coursework",
  );
  expect(rows[0]?.timeline).toBe("By May 2027");
  expect(rows[0]?.successDefinition).toBe(
    "Receive and accept a software engineering internship offer",
  );
});

test("a user can delete a goal", async () => {
  const { goal } = await goals.createGoal({
    owner: "maya",
    outcome: "Get a software engineering internship",
    currentContext: "Computer science student",
    constraints: "Limited time",
    timeline: "By Summer 2027",
    successDefinition: "Receive and accept an internship offer",
  });

  await goals.deleteGoal({ goal });

  const rows = await goals._goal({ goal });

  expect(rows).toHaveLength(0);
});

test("a user can retrieve only their own goals", async () => {
  await goals.createGoal({
    owner: "maya",
    outcome: "Get a software engineering internship",
    currentContext: "Computer science student",
    constraints: "Limited time",
    timeline: "By Summer 2027",
    successDefinition: "Receive and accept an internship offer",
  });

  await goals.createGoal({
    owner: "maya",
    outcome: "Build BetterSelf",
    currentContext: "Working on the alpha MVP",
    constraints: "Course deadline",
    timeline: "This semester",
    successDefinition: "Complete a working MVP",
  });

  await goals.createGoal({
    owner: "alex",
    outcome: "Run a marathon",
    currentContext: "Training regularly",
    constraints: "Limited training time",
    timeline: "By next spring",
    successDefinition: "Finish the marathon",
  });

  const rows = await goals._goalsByOwner({ owner: "maya" });

  expect(rows).toHaveLength(2);
  expect(rows.every((goal) => goal.outcome !== "Run a marathon")).toBe(true);
});

test("actions refuse when the goal does not exist", async () => {
  const missingGoal = "missing-goal";

  await expect(
    goals.setStrategy({
      goal: missingGoal,
      strategy: [
        {
          description: "Apply to internships",
          successCriterion: "Submit 20 applications",
        },
      ],
    }),
  ).rejects.toThrow("There is no such goal.");

  await expect(
    goals.reviseStrategy({
      goal: missingGoal,
      strategy: [
        {
          description: "Focus on networking",
          successCriterion: "Complete 5 conversations",
        },
      ],
    }),
  ).rejects.toThrow("There is no such goal.");

  await expect(
    goals.updateGoal({
      goal: missingGoal,
      outcome: "Updated goal",
      currentContext: "Updated context",
      constraints: "Updated constraints",
      timeline: "Updated timeline",
      successDefinition: "Updated definition",
    }),
  ).rejects.toThrow("There is no such goal.");

  await expect(
    goals.deleteGoal({
      goal: missingGoal,
    }),
  ).rejects.toThrow("There is no such goal.");
});

test("goals are returned in creation order", async () => {
  await goals.createGoal({
    owner: "maya",
    outcome: "First goal",
    currentContext: "Context 1",
    constraints: "Constraints 1",
    timeline: "Timeline 1",
    successDefinition: "Success 1",
  });

  await goals.createGoal({
    owner: "maya",
    outcome: "Second goal",
    currentContext: "Context 2",
    constraints: "Constraints 2",
    timeline: "Timeline 2",
    successDefinition: "Success 2",
  });

  await goals.createGoal({
    owner: "maya",
    outcome: "Third goal",
    currentContext: "Context 3",
    constraints: "Constraints 3",
    timeline: "Timeline 3",
    successDefinition: "Success 3",
  });

  const rows = await goals._goalsByOwner({ owner: "maya" });

  expect(rows.map((goal) => goal.outcome)).toEqual([
    "First goal",
    "Second goal",
    "Third goal",
  ]);
});

test("updating a goal preserves its existing strategy", async () => {
  const { goal } = await goals.createGoal({
    owner: "maya",
    outcome: "Get an internship",
    currentContext: "Computer science student",
    constraints: "Limited time",
    timeline: "By Summer 2027",
    successDefinition: "Receive an internship offer",
  });

  const strategy = [
    {
      description: "Apply to targeted roles",
      successCriterion: "Submit 15 tailored applications",
    },
  ];

  await goals.setStrategy({
    goal,
    strategy,
  });

  await goals.updateGoal({
    goal,
    outcome: "Get a software engineering internship",
    currentContext: "Computer science student with project experience",
    constraints: "Balancing recruiting with coursework",
    timeline: "By May 2027",
    successDefinition: "Receive and accept a software engineering internship offer",
  });

  const rows = await goals._goal({ goal });

  expect(rows[0]?.currentStrategy).toEqual(strategy);
});

test("a user with no goals gets an empty list", async () => {
  const rows = await goals._goalsByOwner({ owner: "maya" });

  expect(rows).toEqual([]);
});