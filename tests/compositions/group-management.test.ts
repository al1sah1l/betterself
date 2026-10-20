import {
  afterAll,
  beforeAll,
  beforeEach,
  expect,
  test,
} from "bun:test";

import { assemble } from "@mit-sdg/sync-engine/assembly";
import { applicationConceptSet } from "../../src/concepts.ts";
import * as groupManagement from "../../src/compositions/group-management.ts";
import { CreateGroup } from "../../src/compositions/groups.ts";
import { openTestDb, type TestDb } from "../test-db.ts";

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
  const instances = applicationConceptSet.implementations("mongo", {
    db: testDb.db,
  });

  return assemble({
    conceptSet: applicationConceptSet,
    instances,
    composition: {
      BetterSelf: {
        groupManagement,
        groups: { CreateGroup },
      },
    },
  });
}

type TestApplication = ReturnType<typeof assembleTestApplication>;

async function sessionFor(app: TestApplication, subject: string) {
  const result = await app.concepts.Sessioning.start({ subject });

  if (!("session" in result) || typeof result.session !== "string") {
    throw new Error("Could not create session.");
  }

  return result.session;
}

async function createGroup(
  app: TestApplication,
  visibility = "private",
) {
  const result = await app.concepts.AccountabilityGrouping.createGroup({
    owner: "maya",
    name: "Career Circle",
    topic: "Internship applications",
    visibility,
  });

  if (!("group" in result) || typeof result.group !== "string") {
    throw new Error("Could not create group.");
  }

  return result.group;
}

test("authenticated search returns public groups without exposing private groups", async () => {
  const app = assembleTestApplication();
  const session = await sessionFor(app, "alex");
  const publicGroup = await createGroup(app, "public");
  await createGroup(app, "private");

  const result = await app.invoker.invoke(
    "/dashboard/public-groups",
    { session, search: "career" },
  );

  expect(result).toEqual({
    ok: true,
    value: {
      groups: [{
        group: publicGroup,
        name: "Career Circle",
        topic: "Internship applications",
      }],
    },
  });
});

test("a member can read settings but a nonmember cannot spoof membership", async () => {
  const app = assembleTestApplication();
  const group = await createGroup(app);
  const ownerSession = await sessionFor(app, "maya");
  const otherSession = await sessionFor(app, "alex");

  const allowed = await app.invoker.invoke("/groups/settings", {
    session: ownerSession,
    group,
  });

  expect(allowed).toEqual({
    ok: true,
    value: {
      settings: {
        group,
        owner: "maya",
        name: "Career Circle",
        topic: "Internship applications",
        visibility: "private",
      },
    },
  });

  const denied = await app.invoker.invoke("/groups/settings", {
    session: otherSession,
    user: "maya",
    group,
  });

  expect(denied).toEqual({
    ok: false,
    error: { kind: "domain", value: "FORBIDDEN" },
  });
});

test("owner can update settings and another user cannot spoof ownership", async () => {
  const app = assembleTestApplication();
  const group = await createGroup(app);
  const ownerSession = await sessionFor(app, "maya");
  const otherSession = await sessionFor(app, "alex");

  const denied = await app.invoker.invoke("/groups/update", {
    session: otherSession,
    owner: "maya",
    group,
    name: "Unauthorized change",
    topic: "Changed",
    visibility: "public",
  });

  expect(denied).toEqual({
    ok: false,
    error: { kind: "domain", value: "NOT_GROUP_OWNER" },
  });

  expect(
    await app.concepts.AccountabilityGrouping._groupSettings({ group }),
  ).toMatchObject([{
    name: "Career Circle",
    visibility: "private",
  }]);

  const updated = await app.invoker.invoke("/groups/update", {
    session: ownerSession,
    group,
    name: "Updated Circle",
    topic: "Interview preparation",
    visibility: "public",
  });

  expect(updated).toEqual({
    ok: true,
    value: { group },
  });

  expect(
    await app.concepts.AccountabilityGrouping._groupSettings({ group }),
  ).toEqual([{
    owner: "maya",
    name: "Updated Circle",
    topic: "Interview preparation",
    visibility: "public",
  }]);
});

test("only the owner can delete a group through the endpoint", async () => {
  const app = assembleTestApplication();
  const group = await createGroup(app);
  const ownerSession = await sessionFor(app, "maya");
  const otherSession = await sessionFor(app, "alex");

  const denied = await app.invoker.invoke("/groups/delete", {
    session: otherSession,
    owner: "maya",
    group,
  });

  expect(denied).toEqual({
    ok: false,
    error: { kind: "domain", value: "NOT_GROUP_OWNER" },
  });

  expect(
    await app.concepts.AccountabilityGrouping._group({ group }),
  ).toHaveLength(1);

  const deleted = await app.invoker.invoke("/groups/delete", {
    session: ownerSession,
    group,
  });

  expect(deleted).toEqual({
    ok: true,
    value: { group },
  });

  expect(
    await app.concepts.AccountabilityGrouping._group({ group }),
  ).toEqual([]);
});

test("missing group settings return GROUP_NOT_FOUND", async () => {
  const app = assembleTestApplication();
  const session = await sessionFor(app, "maya");

  const result = await app.invoker.invoke("/groups/settings", {
    session,
    group: "missing-group",
  });

  expect(result).toEqual({
    ok: false,
    error: { kind: "domain", value: "GROUP_NOT_FOUND" },
  });
});

test("group creation accepts visibility and defaults to private", async () => {
  const app = assembleTestApplication();
  const session = await sessionFor(app, "maya");

  for (const visibility of [undefined, "public"]) {
    const result = await app.invoker.invoke("/groups/create", {
      session,
      name: "New Circle",
      topic: "Reading",
      ...(visibility === undefined ? {} : { visibility }),
    });

    if (!result.ok) {
      throw new Error(JSON.stringify(result.error));
    }

    const value = result.value as { group: string };

    expect(
      await app.concepts.AccountabilityGrouping._groupSettings({
        group: value.group,
      }),
    ).toEqual([{
      owner: "maya",
      name: "New Circle",
      topic: "Reading",
      visibility: visibility ?? "private",
    }]);
  }
});

test("invalid sessions cannot search, read settings, update, or delete groups", async () => {
  const app = assembleTestApplication();
  const group = await createGroup(app);

  const requests = [
    {
      path: "/dashboard/public-groups",
      input: { search: "" },
    },
    {
      path: "/groups/settings",
      input: { group },
    },
    {
      path: "/groups/update",
      input: {
        group,
        name: "Changed",
        topic: "Changed",
        visibility: "public",
      },
    },
    {
      path: "/groups/delete",
      input: { group },
    },
  ];

  for (const request of requests) {
    const result = await app.invoker.invoke(
      request.path,
      {
        ...request.input,
        session: "invalid-session",
      },
      { timeoutMs: 1000 },
    );

    expect(result.ok).toBe(false);
  }

  await app.whenIdle();

  expect(
    await app.concepts.AccountabilityGrouping._groupSettings({ group }),
  ).toEqual([{
    owner: "maya",
    name: "Career Circle",
    topic: "Internship applications",
    visibility: "private",
  }]);
});
