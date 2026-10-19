import {
  afterAll,
  beforeAll,
  expect,
  test,
} from "bun:test";

import {
  mkdtemp,
  mkdir,
  rm,
  writeFile,
} from "node:fs/promises";

import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  serveFrontend,
} from "../../src/http/frontend.ts";

let root: string;

beforeAll(async () => {
  root = await mkdtemp(
    join(tmpdir(), "betterself-static-"),
  );

  await mkdir(join(root, "assets"));

  await writeFile(
    join(root, "index.html"),
    "<h1>BetterSelf</h1>",
  );

  await writeFile(
    join(root, "assets/app-test.js"),
    "export {};",
  );
});

afterAll(async () => {
  await rm(root, {
    recursive: true,
    force: true,
  });
});

test("serves the built homepage and hashed assets", async () => {
  const page = await serveFrontend(
    new Request("http://localhost/"),
    root,
  );

  expect(page.status).toBe(200);

  expect(await page.text()).toContain(
    "BetterSelf",
  );

  expect(
    page.headers.get("Cache-Control"),
  ).toBe("no-cache");

  const asset = await serveFrontend(
    new Request(
      "http://localhost/assets/app-test.js",
    ),
    root,
  );

  expect(asset.status).toBe(200);

  expect(
    asset.headers.get("Cache-Control"),
  ).toContain("immutable");
});

test("does not expose missing assets or files outside the build directory", async () => {
  const paths = [
    "/assets/missing.js",
    "/%2e%2e%2fpackage.json",
    "/.env",
  ];

  for (const path of paths) {
    const response = await serveFrontend(
      new Request(`http://localhost${path}`),
      root,
    );

    expect(response.status).toBe(404);
  }
});

test("HEAD has no body and POST is refused", async () => {
  const head = await serveFrontend(
    new Request("http://localhost/", {
      method: "HEAD",
    }),
    root,
  );

  expect(head.status).toBe(200);
  expect(await head.text()).toBe("");

  const post = await serveFrontend(
    new Request("http://localhost/", {
      method: "POST",
    }),
    root,
  );

  expect(post.status).toBe(405);
});
