import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { execFile as execFileCallback } from "node:child_process";
import {
  createPackageWithOptions,
  extractAll,
  extractFile,
  listPackage,
  uncache,
} from "@electron/asar";
import { TARGET } from "./config.mjs";
import {
  installWithRollback,
  sha256Buffer,
  sha256File,
} from "./files.mjs";
import { inspectRenderer, patchRenderer } from "./transform.mjs";

const execFile = promisify(execFileCallback);
const APP_BINARY = path.join(TARGET.appPath, "Contents/MacOS/ChatGPT");
const INFO_PLIST = path.join(TARGET.appPath, "Contents/Info.plist");
const RESOURCES = path.join(TARGET.appPath, "Contents/Resources");
const ARCHIVE = path.join(RESOURCES, "app.asar");
const UNPACKED = `${ARCHIVE}.unpacked`;

async function exists(targetPath) {
  try {
    await stat(targetPath);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

async function isDirectory(targetPath) {
  try {
    return (await stat(targetPath)).isDirectory();
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

async function plistValue(key) {
  const { stdout } = await execFile("/usr/libexec/PlistBuddy", [
    "-c",
    `Print :${key}`,
    INFO_PLIST,
  ]);
  return stdout.trim();
}

async function assertAppClosed() {
  try {
    await execFile("pgrep", ["-f", APP_BINARY]);
  } catch (error) {
    if (error?.code === 1) return;
    throw new Error(`could not determine whether Codex is running: ${error}`);
  }
  throw new Error("Codex is running; close it before applying or restoring");
}

function normalizeArchiveEntry(entry) {
  return entry.startsWith("/") ? entry.slice(1) : entry;
}

export function extractFreshFile(archivePath, filename) {
  uncache(archivePath);
  return extractFile(archivePath, filename);
}

function backupDirectory() {
  return path.join(TARGET.backupRoot, `${TARGET.version}-${TARGET.build}`);
}

function manifestData() {
  return {
    appPath: TARGET.appPath,
    version: TARGET.version,
    build: TARGET.build,
    archiveSha256: TARGET.archiveSha256,
    assetPath: TARGET.assetPath,
    assetSha256: TARGET.assetSha256,
  };
}

export async function inspectTarget() {
  const [version, build, archiveSha256] = await Promise.all([
    plistValue("CFBundleShortVersionString"),
    plistValue("CFBundleVersion"),
    sha256File(ARCHIVE),
  ]);

  if (version !== TARGET.version || build !== TARGET.build) {
    throw new Error(
      `unsupported Codex version ${version} (${build}); expected ${TARGET.version} (${TARGET.build})`,
    );
  }

  const assetBuffer = extractFreshFile(ARCHIVE, TARGET.assetPath);
  const asset = assetBuffer.toString("utf8");
  const assetSha256 = sha256Buffer(assetBuffer);
  const inspection = inspectRenderer(asset);

  if (inspection.patched) {
    if (
      archiveSha256 !== TARGET.patchedArchiveSha256 ||
      assetSha256 !== TARGET.patchedAssetSha256
    ) {
      throw new Error(
        "patched Codex files do not match the validated patch build",
      );
    }
    return {
      version,
      build,
      archiveSha256,
      assetSha256,
      asset,
      patched: true,
    };
  }

  if (archiveSha256 !== TARGET.archiveSha256) {
    throw new Error(
      `archive hash mismatch; expected ${TARGET.archiveSha256}, got ${archiveSha256}`,
    );
  }

  if (assetSha256 !== TARGET.assetSha256) {
    throw new Error(
      `renderer hash mismatch; expected ${TARGET.assetSha256}, got ${assetSha256}`,
    );
  }
  return {
    version,
    build,
    archiveSha256,
    assetSha256,
    asset,
    patched: false,
  };
}

export async function buildPatchedArchive(target = null) {
  target ??= await inspectTarget();
  if (target.patched) throw new Error("Codex is already patched");

  const tempDir = await mkdtemp(path.join(os.tmpdir(), "codex-usage-patch-"));
  const extractedRoot = path.join(tempDir, "extracted");
  const candidateArchive = path.join(tempDir, "app.asar");

  try {
    extractAll(ARCHIVE, extractedRoot);
    const assetFile = path.join(extractedRoot, TARGET.assetPath);
    const source = await readFile(assetFile, "utf8");
    const patched = patchRenderer(source);
    await writeFile(assetFile, patched);

    await createPackageWithOptions(extractedRoot, candidateArchive, {
      unpackDir: TARGET.unpackDir,
    });

    const candidateAssetBuffer = extractFreshFile(
      candidateArchive,
      TARGET.assetPath,
    );
    const candidateAsset = candidateAssetBuffer.toString("utf8");
    const candidateInspection = inspectRenderer(candidateAsset);
    if (!candidateInspection.patched) {
      throw new Error("candidate renderer does not contain the patch marker");
    }
    const [candidateArchiveSha256, candidateAssetSha256] = await Promise.all([
      sha256File(candidateArchive),
      Promise.resolve(sha256Buffer(candidateAssetBuffer)),
    ]);
    if (
      candidateArchiveSha256 !== TARGET.patchedArchiveSha256 ||
      candidateAssetSha256 !== TARGET.patchedAssetSha256
    ) {
      throw new Error("candidate patch checksums do not match the validated build");
    }

    const [originalEntries, candidateEntries] = await Promise.all([
      listPackage(ARCHIVE),
      listPackage(candidateArchive),
    ]);
    const originalSet = originalEntries.map(normalizeArchiveEntry).sort();
    const candidateSet = candidateEntries.map(normalizeArchiveEntry).sort();
    if (
      originalSet.length !== candidateSet.length ||
      originalSet.some((entry, index) => entry !== candidateSet[index])
    ) {
      throw new Error("candidate archive file list differs from the original");
    }

    if (!(await exists(`${candidateArchive}.unpacked`))) {
      throw new Error("candidate archive is missing its unpacked directory");
    }

    return {
      ok: true,
      version: target.version,
      build: target.build,
      assetPath: TARGET.assetPath,
      patched: true,
      tempDir,
      candidateArchive,
      candidateUnpacked: `${candidateArchive}.unpacked`,
    };
  } catch (error) {
    await rm(tempDir, { recursive: true, force: true });
    throw error;
  }
}

export function shouldRequireAppClosed(options = {}) {
  return options.allowRunning !== true;
}

async function createBackup() {
  const directory = backupDirectory();
  const manifest = path.join(directory, "manifest.json");
  if (await exists(manifest)) {
    const saved = JSON.parse(await readFile(manifest, "utf8"));
    if (
      saved.archiveSha256 !== TARGET.archiveSha256 ||
      saved.version !== TARGET.version ||
      saved.build !== TARGET.build
    ) {
      throw new Error("existing backup manifest does not match this patch");
    }
    if (
      (await sha256File(path.join(directory, "app.asar"))) !==
      TARGET.archiveSha256
    ) {
      throw new Error("existing backup archive failed checksum validation");
    }
    if (!(await isDirectory(path.join(directory, "app.asar.unpacked")))) {
      throw new Error("existing backup is missing its unpacked resource directory");
    }
    return directory;
  }

  await mkdir(directory, { recursive: true });
  await cp(ARCHIVE, path.join(directory, "app.asar"));
  await cp(UNPACKED, path.join(directory, "app.asar.unpacked"), {
    recursive: true,
    preserveTimestamps: true,
  });
  await writeFile(manifest, `${JSON.stringify(manifestData(), null, 2)}\n`);
  return directory;
}

async function replaceResources(sourceArchive, sourceUnpacked) {
  const suffix = `.codex-usage-${process.pid}-${Date.now()}`;
  const nextArchive = `${ARCHIVE}${suffix}.next`;
  const nextUnpacked = `${UNPACKED}${suffix}.next`;
  const oldArchive = `${ARCHIVE}${suffix}.old`;
  const oldUnpacked = `${UNPACKED}${suffix}.old`;
  let originalMoved = false;

  try {
    await cp(sourceArchive, nextArchive);
    await cp(sourceUnpacked, nextUnpacked, {
      recursive: true,
      preserveTimestamps: true,
    });

    await rename(ARCHIVE, oldArchive);
    await rename(UNPACKED, oldUnpacked);
    originalMoved = true;
    await rename(nextArchive, ARCHIVE);
    await rename(nextUnpacked, UNPACKED);
    await rm(oldArchive, { force: true });
    await rm(oldUnpacked, { recursive: true, force: true });
  } catch (error) {
    await rm(nextArchive, { force: true });
    await rm(nextUnpacked, { recursive: true, force: true });
    if (originalMoved) {
      await rm(ARCHIVE, { force: true });
      await rm(UNPACKED, { recursive: true, force: true });
      await rename(oldArchive, ARCHIVE);
      await rename(oldUnpacked, UNPACKED);
    }
    throw error;
  }
}

export async function applyPatch(options = {}) {
  if (shouldRequireAppClosed(options)) await assertAppClosed();
  const target = await inspectTarget();
  const candidate = await buildPatchedArchive(target);
  try {
    const backup = await createBackup();
    await installWithRollback({
      install: () =>
        replaceResources(
          candidate.candidateArchive,
          candidate.candidateUnpacked,
        ),
      validate: async () => {
        const installed = await inspectTarget();
        if (!installed.patched) {
          throw new Error(
            "installed renderer does not contain the patch marker",
          );
        }
      },
      rollback: () =>
        replaceResources(
          path.join(backup, "app.asar"),
          path.join(backup, "app.asar.unpacked"),
        ),
    });
    return {
      ok: true,
      mode: options.allowRunning === true ? "apply-live" : "apply",
      version: target.version,
      build: target.build,
      backup,
      patched: true,
    };
  } finally {
    await rm(candidate.tempDir, { recursive: true, force: true });
  }
}

export async function restoreBackup() {
  await assertAppClosed();
  const directory = backupDirectory();
  const manifestFile = path.join(directory, "manifest.json");
  if (!(await exists(manifestFile))) {
    throw new Error("no validated backup exists for this Codex version");
  }

  const manifest = JSON.parse(await readFile(manifestFile, "utf8"));
  if (
    manifest.version !== TARGET.version ||
    manifest.build !== TARGET.build ||
    manifest.appPath !== TARGET.appPath
  ) {
    throw new Error("backup manifest target does not match this Codex version");
  }

  const sourceArchive = path.join(directory, "app.asar");
  const sourceUnpacked = path.join(directory, "app.asar.unpacked");
  const digest = await sha256File(sourceArchive);
  if (digest !== TARGET.archiveSha256) {
    throw new Error("backup archive failed checksum validation");
  }

  await replaceResources(sourceArchive, sourceUnpacked);
  const restored = await inspectTarget();
  if (
    restored.patched ||
    restored.archiveSha256 !== TARGET.archiveSha256
  ) {
    throw new Error("restored Codex archive failed validation");
  }

  return {
    ok: true,
    mode: "restore",
    version: TARGET.version,
    build: TARGET.build,
    archiveSha256: restored.archiveSha256,
  };
}
