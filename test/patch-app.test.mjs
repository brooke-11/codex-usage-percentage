import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createPackage, extractFile } from "@electron/asar";
import { TARGET } from "../src/config.mjs";
import * as patchApp from "../src/patch-app.mjs";

test("builds backup metadata from the inspected target", () => {
  const target = {
    version: "26.727.51351",
    build: "6119",
    archiveSha256: "archive",
    assetPath: "webview/assets/app-initial-new.js",
    assetSha256: "asset",
    family: "modern-account-footer",
  };

  assert.deepEqual(patchApp.manifestData(target), {
    appPath: TARGET.appPath,
    version: "26.727.51351",
    build: "6119",
    archiveSha256: "archive",
    assetPath: "webview/assets/app-initial-new.js",
    assetSha256: "asset",
    family: "modern-account-footer",
  });
});

test("discovers exactly one renderer JavaScript asset", () => {
  assert.equal(
    patchApp.discoverRendererAsset([
      "/webview/assets/app-initial-abc.css",
      "/webview/assets/app-initial-xyz.js",
    ]),
    "webview/assets/app-initial-xyz.js",
  );
});

test("refuses missing and duplicate renderer JavaScript assets", () => {
  assert.throws(() => patchApp.discoverRendererAsset([]), /count must be 1/);
  assert.throws(
    () =>
      patchApp.discoverRendererAsset([
        "/webview/assets/app-initial-a.js",
        "/webview/assets/app-initial-b.js",
      ]),
    /count must be 1/,
  );
});

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
