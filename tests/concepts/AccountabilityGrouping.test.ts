import {
  afterAll,
  beforeAll,
  beforeEach,
  expect,
  test,
} from "bun:test";

import { AccountabilityGroupingConcept } from "../../src/concepts/AccountabilityGrouping/AccountabilityGrouping.ts";
import { openTestDb, type TestDb } from "../test-db.ts";

let testDb: TestDb;

let groups: AccountabilityGroupingConcept<
  string,
  string,
  string
>;

beforeAll(async () => {
  testDb = await openTestDb();
}, 120_000);

beforeEach(async () => {
  await testDb.db.dropDatabase();

  groups = new AccountabilityGroupingConcept<
    string,
    string,
    string
  >(testDb.db);
});

afterAll(async () => {
  await testDb.close();
});

async function createGroup({
  owner = "maya",
  name = "Recruiting Buddies",
  topic = "Software engineering recruiting",
} = {}) {
  return groups.createGroup({
    owner,
    name,
    topic,
  });
}

async function pause() {
  await new Promise((resolve) =>
    setTimeout(resolve, 2),
  );
}

test("a group can be created and the owner becomes a member", async () => {
  const { group } = await createGroup();

  const groupRows = await groups._group({ group });
  const members = await groups._members({ group });

  expect(groupRows).toEqual([
    {
      name: "Recruiting Buddies",
      topic: "Software engineering recruiting",
    },
  ]);

  expect(members).toEqual([
    {
      user: "maya",
    },
  ]);
});

test("a missing group returns no row", async () => {
  const rows = await groups._group({
    group: "missing-group",
  });

  expect(rows).toEqual([]);
});

test("a user can join an existing group", async () => {
  const { group } = await createGroup();

  await groups.joinGroup({
    group,
    user: "alex",
  });

  const members = await groups._members({ group });

  expect(
    members.map((member) => member.user),
  ).toContain("alex");
});

test("a user cannot join a missing group", async () => {
  await expect(
    groups.joinGroup({
      group: "missing-group",
      user: "alex",
    }),
  ).rejects.toThrow(
    "There is no such group.",
  );
});

test("a user cannot join the same group twice", async () => {
  const { group } = await createGroup();

  await groups.joinGroup({
    group,
    user: "alex",
  });

  await expect(
    groups.joinGroup({
      group,
      user: "alex",
    }),
  ).rejects.toThrow(
    "This user is already a member of this group.",
  );
});

test("only one simultaneous duplicate membership succeeds", async () => {
  const { group } = await createGroup();

  const results = await Promise.allSettled([
    groups.joinGroup({
      group,
      user: "alex",
    }),
    groups.joinGroup({
      group,
      user: "alex",
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

test("a group member can attach a goal", async () => {
  const { group } = await createGroup();

  await groups.attachGoal({
    group,
    user: "maya",
    goal: "goal-1",
  });

  const rows = await groups._groupForGoal({
    goal: "goal-1",
  });

  expect(rows).toEqual([
    {
      group,
    },
  ]);
});

test("a goal cannot be attached to a missing group", async () => {
  await expect(
    groups.attachGoal({
      group: "missing-group",
      user: "maya",
      goal: "goal-1",
    }),
  ).rejects.toThrow(
    "There is no such group.",
  );
});

test("a non-member cannot attach a goal", async () => {
  const { group } = await createGroup();

  await expect(
    groups.attachGoal({
      group,
      user: "alex",
      goal: "goal-1",
    }),
  ).rejects.toThrow(
    "This user is not a member of this group.",
  );
});

test("a goal can belong to at most one accountability group", async () => {
  const { group: firstGroup } =
    await createGroup({
      name: "First group",
    });

  const { group: secondGroup } =
    await createGroup({
      name: "Second group",
    });

  await groups.attachGoal({
    group: firstGroup,
    user: "maya",
    goal: "goal-1",
  });

  await expect(
    groups.attachGoal({
      group: secondGroup,
      user: "maya",
      goal: "goal-1",
    }),
  ).rejects.toThrow(
    "This goal is already attached to an accountability group.",
  );
});

test("only one simultaneous attachment of the same goal succeeds", async () => {
  const { group: firstGroup } =
    await createGroup({
      name: "First group",
    });

  const { group: secondGroup } =
    await createGroup({
      name: "Second group",
    });

  const results = await Promise.allSettled([
    groups.attachGoal({
      group: firstGroup,
      user: "maya",
      goal: "goal-1",
    }),

    groups.attachGoal({
      group: secondGroup,
      user: "maya",
      goal: "goal-1",
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

test("an unattached goal returns no group", async () => {
  const rows = await groups._groupForGoal({
    goal: "goal-with-no-group",
  });

  expect(rows).toEqual([]);
});

test("proof can be shared with the group attached to its goal", async () => {
  const { group } = await createGroup();

  await groups.attachGoal({
    group,
    user: "maya",
    goal: "goal-1",
  });

  const result = await groups.shareProof({
    goal: "goal-1",
    proof: "proof-1",
  });

  expect(result.group).toBe(group);

  const rows = await groups._sharedProofs({
    group,
  });

  expect(rows).toEqual([
    {
      proof: "proof-1",
    },
  ]);
});

test("proof cannot be shared for an unattached goal", async () => {
  await expect(
    groups.shareProof({
      goal: "goal-1",
      proof: "proof-1",
    }),
  ).rejects.toThrow(
    "This goal is not attached to an accountability group.",
  );
});

test("the same proof cannot be shared twice with a group", async () => {
  const { group } = await createGroup();

  await groups.attachGoal({
    group,
    user: "maya",
    goal: "goal-1",
  });

  await groups.shareProof({
    goal: "goal-1",
    proof: "proof-1",
  });

  await expect(
    groups.shareProof({
      goal: "goal-1",
      proof: "proof-1",
    }),
  ).rejects.toThrow(
    "This proof has already been shared with this group.",
  );
});

test("only one simultaneous duplicate proof share succeeds", async () => {
  const { group } = await createGroup();

  await groups.attachGoal({
    group,
    user: "maya",
    goal: "goal-1",
  });

  const results = await Promise.allSettled([
    groups.shareProof({
      goal: "goal-1",
      proof: "proof-1",
    }),

    groups.shareProof({
      goal: "goal-1",
      proof: "proof-1",
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

test("shared proofs are returned only for the requested group in sharing order", async () => {
  const { group: firstGroup } =
    await createGroup({
      name: "First group",
    });

  const { group: secondGroup } =
    await createGroup({
      name: "Second group",
    });

  await groups.attachGoal({
    group: firstGroup,
    user: "maya",
    goal: "goal-1",
  });

  await groups.attachGoal({
    group: secondGroup,
    user: "maya",
    goal: "goal-2",
  });

  await groups.shareProof({
    goal: "goal-1",
    proof: "proof-1",
  });

  await pause();

  await groups.shareProof({
    goal: "goal-1",
    proof: "proof-2",
  });

  await groups.shareProof({
    goal: "goal-2",
    proof: "other-proof",
  });

  const rows = await groups._sharedProofs({
    group: firstGroup,
  });

  expect(rows.map((row) => row.proof)).toEqual([
    "proof-1",
    "proof-2",
  ]);
});

test("a group with no shared proofs gets an empty list", async () => {
  const { group } = await createGroup();

  const rows = await groups._sharedProofs({
    group,
  });

  expect(rows).toEqual([]);
});

test("checkMember returns the group for a member of the attached goal", async () => {
  const { group } = await createGroup();

  await groups.joinGroup({
    group,
    user: "alex",
  });

  await groups.attachGoal({
    group,
    user: "maya",
    goal: "goal-1",
  });

  const result = await groups.checkMember({
    goal: "goal-1",
    user: "alex",
  });

  expect(result.group).toBe(group);
});

test("checkMember refuses when the goal is not attached", async () => {
  await expect(
    groups.checkMember({
      goal: "goal-1",
      user: "alex",
    }),
  ).rejects.toThrow(
    "This goal is not attached to an accountability group.",
  );
});

test("checkMember refuses when the user is not a member", async () => {
  const { group } = await createGroup();

  await groups.attachGoal({
    group,
    user: "maya",
    goal: "goal-1",
  });

  await expect(
    groups.checkMember({
      goal: "goal-1",
      user: "alex",
    }),
  ).rejects.toThrow(
    "This user is not a member of this group.",
  );
});

test("groups for a user are filtered and returned in membership order", async () => {
  const { group: firstGroup } =
    await createGroup({
      owner: "maya",
      name: "First group",
    });

  await pause();

  const { group: secondGroup } =
    await createGroup({
      owner: "alex",
      name: "Second group",
    });

  await groups.joinGroup({
    group: secondGroup,
    user: "maya",
  });

  await createGroup({
    owner: "sam",
    name: "Unrelated group",
  });

  const rows = await groups._groupsForUser({
    user: "maya",
  });

  expect(rows.map((row) => row.group)).toEqual([
    firstGroup,
    secondGroup,
  ]);
});

test("a user with no groups gets an empty list", async () => {
  const rows = await groups._groupsForUser({
    user: "nobody",
  });

  expect(rows).toEqual([]);
});

test("members are returned in membership creation order", async () => {
  const { group } = await createGroup({
    owner: "maya",
  });

  await pause();

  await groups.joinGroup({
    group,
    user: "alex",
  });

  await pause();

  await groups.joinGroup({
    group,
    user: "sam",
  });

  const rows = await groups._members({
    group,
  });

  expect(rows.map((row) => row.user)).toEqual([
    "maya",
    "alex",
    "sam",
  ]);
});

test("a missing group has no members", async () => {
  const rows = await groups._members({
    group: "missing-group",
  });

  expect(rows).toEqual([]);
});

test("a missing group has no shared proofs", async () => {
  const rows = await groups._sharedProofs({
    group: "missing-group",
  });

  expect(rows).toEqual([]);
});