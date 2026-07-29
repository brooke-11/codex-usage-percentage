import os from "node:os";
import path from "node:path";

export const TARGET = Object.freeze({
  appPath: "/Applications/ChatGPT.app",
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
  unpackDir:
    "node_modules/{@worklouder,better-sqlite3,node-mac-permissions,node-pty,objc-js}",
});
