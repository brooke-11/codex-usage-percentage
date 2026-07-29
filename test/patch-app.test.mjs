import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createPackage, extractFile } from "@electron/asar";
import * as patchApp from "../src/patch-app.mjs";

test("running-app installation requires explicit opt-in", () => {
  assert.equal(typeof patchApp.shouldRequireAppClosed, "function");
  assert.equal(patchApp.shouldRequireAppClosed(), true);
  assert.equal(patchApp.shouldRequireAppClosed({ allowRunning: false }), true);
  assert.equal(patchApp.shouldRequireAppClosed({ allowRunning: true }), false);
});

test("fresh archive reads discard the asar filesystem cache", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "codex-usage-cache-test-"));
  const first = path.join(root, "first");
  const second = path.join(root, "second");
  const installed = path.join(root, "app.asar");
  const replacement = path.join(root, "replacement.asar");

  try {
    await mkdir(first);
    await mkdir(second);
    await writeFile(path.join(first, "asset.js"), "old");
    await writeFile(path.join(second, "asset.js"), "new");
    await createPackage(first, installed);
    await createPackage(second, replacement);

    assert.equal(extractFile(installed, "asset.js").toString("utf8"), "old");
    await rename(replacement, installed);

    assert.equal(
      patchApp.extractFreshFile(installed, "asset.js").toString("utf8"),
      "new",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
