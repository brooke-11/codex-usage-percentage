import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";

export function sha256Buffer(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

export async function sha256File(file) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}

export function assertSingleReplacement(source, anchor, label) {
  const count = source.split(anchor).length - 1;
  if (count !== 1) {
    throw new Error(`${label} anchor count must be 1; got ${count}`);
  }
}

export async function installWithRollback({ install, validate, rollback }) {
  let installed = false;
  try {
    await install();
    installed = true;
    return await validate();
  } catch (error) {
    if (installed) {
      try {
        await rollback();
      } catch (rollbackError) {
        throw new AggregateError(
          [error, rollbackError],
          "installation and automatic rollback both failed",
        );
      }
    }
    throw error;
  }
}
