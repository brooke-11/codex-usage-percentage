import os from "node:os";
import path from "node:path";

export const TARGET = Object.freeze({
  appPath: "/Applications/ChatGPT.app",
  backupRoot: path.join(
    os.homedir(),
    "Library/Application Support/Codex Usage Percentage Patch",
  ),
  unpackDir:
    "node_modules/{@worklouder,better-sqlite3,node-mac-permissions,node-pty,objc-js}",
});
