import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { inspectRenderer, patchRenderer } from "../src/transform.mjs";

const fixture = await readFile(
  new URL("../fixtures/account-footer-fragment.js", import.meta.url),
  "utf8",
);

const modernFixture = await readFile(
  new URL("../fixtures/account-footer-modern-fragment.js", import.meta.url),
  "utf8",
);

test("adds one weekly percentage node to the account footer", () => {
  const patched = patchRenderer(fixture);
  assert.match(patched, /__cupRate/);
  assert.match(patched, /604800/);
  assert.match(patched, /children:`\$\{__cupPct\}%`/);
  assert.match(patched, /text-base text-token-foreground/);
  assert.equal(inspectRenderer(patched).patched, true);
});

test("refuses an already patched renderer", () => {
  const patched = patchRenderer(fixture);
  assert.throws(() => patchRenderer(patched), /already patched/);
});

test("refuses missing or duplicate anchors", () => {
  assert.throws(() => patchRenderer("unrelated"), /anchor/);
  assert.throws(() => patchRenderer(fixture + fixture), /anchor/);
});

test("patches the modern account-footer structure", () => {
  const patched = patchRenderer(modernFixture);
  const inspection = inspectRenderer(patched);

  assert.equal(inspection.patched, true);
  assert.equal(inspection.family, "modern-account-footer");
  assert.match(patched, /__cupFamily=`modern-account-footer`/);
  assert.match(patched, /children:`\$\{__cupPct\}%`/);
  assert.match(patched, /text-base text-token-foreground/);
});

test("refuses a partial modern account-footer structure", () => {
  assert.throws(
    () =>
      patchRenderer(
        modernFixture.replace("rate_limit_reset_credits", "missing"),
      ),
    /supported account-footer structure/,
  );
});
