#!/usr/bin/env node
import { rm } from "node:fs/promises";
import {
  applyPatch,
  buildPatchedArchive,
  inspectTarget,
  restoreBackup,
} from "./patch-app.mjs";

const command = process.argv[2];

try {
  if (command === "dry-run") {
    const target = await inspectTarget();
    if (target.patched) {
      console.log(
        JSON.stringify(
          {
            ok: true,
            mode: command,
            version: target.version,
            build: target.build,
            assetPath: target.assetPath,
            family: target.family,
            patched: true,
            alreadyInstalled: true,
          },
          null,
          2,
        ),
      );
    } else {
      const candidate = await buildPatchedArchive(target);
      try {
        console.log(
          JSON.stringify(
            {
              ok: true,
              mode: command,
              version: candidate.version,
              build: candidate.build,
              assetPath: candidate.assetPath,
              family: candidate.family,
              patched: candidate.patched,
            },
            null,
            2,
          ),
        );
      } finally {
        await rm(candidate.tempDir, { recursive: true, force: true });
      }
    }
  } else if (command === "apply") {
    console.log(JSON.stringify(await applyPatch(), null, 2));
  } else if (command === "apply-live") {
    console.log(
      JSON.stringify(await applyPatch({ allowRunning: true }), null, 2),
    );
  } else if (command === "restore") {
    console.log(JSON.stringify(await restoreBackup(), null, 2));
  } else {
    throw new Error(
      "usage: node src/cli.mjs dry-run|apply|apply-live|restore",
    );
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
