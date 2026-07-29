import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { TARGET } from "../src/config.mjs";
import * as files from "../src/files.mjs";

const { assertSingleReplacement, sha256Buffer, sha256File } = files;

const execFile = promisify(execFileCallback);

test("target configuration matches Codex 26.721.81911 build 5973", () => {
  assert.deepEqual(
    {
      version: TARGET.version,
      build: TARGET.build,
      assetPath: TARGET.assetPath,
      archiveSha256: TARGET.archiveSha256,
      assetSha256: TARGET.assetSha256,
      patchedArchiveSha256: TARGET.patchedArchiveSha256,
      patchedAssetSha256: TARGET.patchedAssetSha256,
      backupRoot: TARGET.backupRoot,
    },
    {
      version: "26.721.81911",
      build: "5973",
      assetPath: "webview/assets/app-initial-CRKqnyc3.js",
      archiveSha256:
        "3c9a101d9beec3718b0fcfc19e427c644a934045f48b3fe0e16b68b0b3f23e61",
      assetSha256:
        "aec8d391931b58565f6aa08c65efc3c24c43272618b98f232f340ae2fcc1f3e4",
      patchedArchiveSha256:
        "7c317460ac4ec9e240c22474d4daf0f3a4b903bb3f5cc1b718b662922102d78e",
      patchedAssetSha256:
        "63b042b330ae660c7ab6154869badbe88b5b8921504d4f270552ee33276b5b5d",
      backupRoot: path.join(
        os.homedir(),
        "Library/Application Support/Codex Usage Percentage Patch",
      ),
    },
  );
});

test("sha256File returns a lowercase SHA-256 digest", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "codex-usage-test-"));
  const file = path.join(dir, "value.txt");
  await writeFile(file, "abc");
  assert.equal(
    await sha256File(file),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
  assert.equal(await readFile(file, "utf8"), "abc");
});

test("sha256Buffer returns a lowercase SHA-256 digest", () => {
  assert.equal(
    sha256Buffer(Buffer.from("abc")),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
});

test("assertSingleReplacement rejects zero and duplicate anchors", () => {
  assert.throws(() => assertSingleReplacement("abc", "x", "label"), /label/);
  assert.throws(
    () => assertSingleReplacement("x--x", "x", "label"),
    /label/,
  );
});

test("patch app module passes the Node syntax check", async () => {
  const modulePath = new URL("../src/patch-app.mjs", import.meta.url);
  await execFile(process.execPath, ["--check", modulePath.pathname]);
});

test("installWithRollback restores the previous state after validation fails", async () => {
  let state = "original";
  assert.equal(typeof files.installWithRollback, "function");

  await assert.rejects(
    files.installWithRollback({
      install: async () => {
        state = "patched";
      },
      validate: async () => {
        throw new Error("candidate failed validation");
      },
      rollback: async () => {
        state = "original";
      },
    }),
    /candidate failed validation/,
  );

  assert.equal(state, "original");
});
