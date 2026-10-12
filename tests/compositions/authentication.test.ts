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
  Register,
  SignIn,
  CurrentUser,
  SignOut,
} from "../../src/compositions/authentication.ts";

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
        authentication: {
          Register,
          SignIn,
          CurrentUser,
          SignOut,
        },
      },
    },
  });
}

type AuthResponse = {
  account: string;
  session: string;
  expiresAt?: unknown;
};

type CurrentUserResponse = {
  account: string;
};

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
      `Invocation failed for ${path}`,
    );
  }

  return result.value as T;
}

test("register creates an authenticated session", async () => {
  const app = assembleTestApplication();

  const registered =
    await invokeValue<AuthResponse>(
      app,
      "/auth/register",
      {
        username: "maya",
        password: "password123",
      },
    );

  expect(registered.account).toBe("maya");
  expect(typeof registered.session).toBe("string");

  const current =
    await invokeValue<CurrentUserResponse>(
      app,
      "/auth/current",
      {
        session: registered.session,
      },
    );

  expect(current).toEqual({
    account: "maya",
  });
});

test("registered account persists across application instances", async () => {
  const firstApp = assembleTestApplication();

  await invokeValue<AuthResponse>(
    firstApp,
    "/auth/register",
    {
      username: "maya",
      password: "password123",
    },
  );

  // Completely new application instance,
  // but using the same Mongo database.
  const secondApp = assembleTestApplication();

  const signedIn =
    await invokeValue<AuthResponse>(
      secondApp,
      "/auth/sign-in",
      {
        username: "maya",
        password: "password123",
      },
    );

  expect(signedIn.account).toBe("maya");
  expect(typeof signedIn.session).toBe("string");

  const current =
    await invokeValue<CurrentUserResponse>(
      secondApp,
      "/auth/current",
      {
        session: signedIn.session,
      },
    );

  expect(current).toEqual({
    account: "maya",
  });
});

test("sign in returns a new valid session", async () => {
  const app = assembleTestApplication();

  const registered =
    await invokeValue<AuthResponse>(
      app,
      "/auth/register",
      {
        username: "alex",
        password: "password123",
      },
    );

  const signedIn =
    await invokeValue<AuthResponse>(
      app,
      "/auth/sign-in",
      {
        username: "alex",
        password: "password123",
      },
    );

  expect(signedIn.account).toBe("alex");
  expect(typeof signedIn.session).toBe("string");

  expect(signedIn.session).not.toBe(
    registered.session,
  );

  const current =
    await invokeValue<CurrentUserResponse>(
      app,
      "/auth/current",
      {
        session: signedIn.session,
      },
    );

  expect(current).toEqual({
    account: "alex",
  });
});

test("sign out ends the session", async () => {
  const app = assembleTestApplication();

  const registered =
    await invokeValue<AuthResponse>(
      app,
      "/auth/register",
      {
        username: "sam",
        password: "password123",
      },
    );

  await invokeValue(
    app,
    "/auth/sign-out",
    {
      session: registered.session,
    },
  );

  const sessionResult =
    await app.concepts.Sessioning.current({
      session: registered.session,
    });

  expect(sessionResult).toMatchObject({
    error: "UNKNOWN_SESSION",
  });
});
