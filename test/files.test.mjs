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

test("target configuration contains only stable application settings", () => {
  assert.deepEqual(TARGET, {
    appPath: "/Applications/ChatGPT.app",
    backupRoot: path.join(
      os.homedir(),
      "Library/Application Support/Codex Usage Percentage Patch",
    ),
    unpackDir:
      "node_modules/{@worklouder,better-sqlite3,node-mac-permissions,node-pty,objc-js}",
  });
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

test("dry-run output uses the inspected asset and structural family", async () => {
  const cli = await readFile(
    new URL("../src/cli.mjs", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(cli, /TARGET\.assetPath/);
  assert.match(cli, /family: target\.family/);
  assert.match(cli, /family: candidate\.family/);
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
