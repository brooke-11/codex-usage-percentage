const PATCH_PREFIX = "__cupFamily=`";
const IDENTIFIER = "[A-Za-z_$][\\w$]*";

const LEGACY_START_FROM = "function c0l(){let e=(0,l0l.c)(43),";
const LEGACY_START_TO = "function c0l(){let e=(0,l0l.c)(44),";

const LEGACY_DATA_FROM = ",{data:v}=o2r(),y=i??v?.accountId??null";
const LEGACY_DATA_TO =
  ",{data:v}=o2r(),{data:__cupRate}=Y(NE)," +
  "__cupFamily=`legacy-account-footer`," +
  "__cupWin=[__cupRate?.rate_limit?.primary_window,__cupRate?.rate_limit?.secondary_window]" +
  ".find(e=>e!=null&&Math.abs((e.limit_window_seconds??0)-604800)<=60)," +
  "__cupUsed=__cupWin?.used_percent," +
  "__cupPct=__cupUsed==null||!Number.isFinite(Number(__cupUsed))?null:" +
  "Math.round(Math.min(Math.max(100-Number(__cupUsed),0),100))," +
  "y=i??v?.accountId??null";

const LEGACY_RENDER_FROM =
  "let te;return e[41]===q?te=e[42]:(te=(0,m7.jsxs)(`div`,{" +
  "className:`flex min-w-0 flex-1 items-center gap-0 sidebar-item`," +
  "children:[q,ee]}),e[41]=q,e[42]=te),te}";

const LEGACY_RENDER_TO =
  "let te;return e[41]!==q||e[42]!==__cupPct?(te=(0,m7.jsxs)(`div`,{" +
  "className:`flex min-w-0 flex-1 items-center gap-0 sidebar-item`," +
  "children:[q,__cupPct==null?null:(0,m7.jsx)(`span`,{" +
  "className:`shrink-0 text-base text-token-foreground`," +
  "children:`${__cupPct}%`}),ee]}),e[41]=q,e[42]=__cupPct,e[43]=te):te=e[43],te}";

const legacyReplacements = [
  ["component cache", LEGACY_START_FROM, LEGACY_START_TO],
  ["rate-limit data", LEGACY_DATA_FROM, LEGACY_DATA_TO],
  ["account footer render", LEGACY_RENDER_FROM, LEGACY_RENDER_TO],
];

const modernRateQueryPattern = new RegExp(
  `\\{data:(${IDENTIFIER})\\}=(${IDENTIFIER}\\(${IDENTIFIER}\\)),` +
    `${IDENTIFIER}=${IDENTIFIER}\\(\\1\\),` +
    `${IDENTIFIER}=${IDENTIFIER}\\(\\1\\),` +
    `[\\s\\S]{0,600}?\\1\\?\\.rate_limit_reset_credits\\?\\.available_count`,
  "g",
);

const modernAccountDataPattern = new RegExp(
  `\\{data:(${IDENTIFIER})\\}=(${IDENTIFIER})\\(\\),` +
    `(${IDENTIFIER})=(${IDENTIFIER})\\?\\?\\1\\?\\.accountId\\?\\?null`,
  "g",
);

const modernRenderPattern = new RegExp(
  `let (${IDENTIFIER});return (${IDENTIFIER})\\[(\\d+)\\]===(${IDENTIFIER})` +
    `\\?\\1=\\2\\[(\\d+)\\]:\\(\\1=\\(0,(${IDENTIFIER})\\.jsxs\\)` +
    `\\(\\x60div\\x60,\\{className:\\x60flex min-w-0 flex-1 items-center gap-0 sidebar-item\\x60,` +
    `children:\\[\\4,(${IDENTIFIER})\\]\\}\\),\\2\\[\\3\\]=\\4,` +
    `\\2\\[\\5\\]=\\1\\),\\1\\}`,
  "g",
);

function count(source, needle) {
  return source.split(needle).length - 1;
}

function matchesFor(source, pattern) {
  return Array.from(source.matchAll(pattern));
}

function legacyInspection(source) {
  const anchorCounts = Object.fromEntries(
    legacyReplacements.map(([name, from]) => [name, count(source, from)]),
  );
  return {
    family: "legacy-account-footer",
    complete: Object.values(anchorCounts).every((value) => value === 1),
    anchorCounts,
  };
}

function modernInspection(source) {
  const anchorCounts = {
    "rate-limit query": matchesFor(source, modernRateQueryPattern).length,
    "account data": matchesFor(source, modernAccountDataPattern).length,
    "account footer render": matchesFor(source, modernRenderPattern).length,
  };
  return {
    family: "modern-account-footer",
    complete: Object.values(anchorCounts).every((value) => value === 1),
    anchorCounts,
  };
}

const adapters = [
  {
    family: "legacy-account-footer",
    inspect: legacyInspection,
    patch(source) {
      return legacyReplacements.reduce(
        (result, [, from, to]) => result.replace(from, to),
        source,
      );
    },
  },
  {
    family: "modern-account-footer",
    inspect: modernInspection,
    patch(source) {
      const rateMatches = matchesFor(source, modernRateQueryPattern);
      const rateQuery = rateMatches[0][2];

      let result = source.replace(
        modernAccountDataPattern,
        (_match, accountData, accountHook, accountKey, accountId) =>
          `{data:${accountData}}=${accountHook}(),` +
          `{data:__cupRate}=${rateQuery},` +
          "__cupFamily=`modern-account-footer`," +
          "__cupWin=[__cupRate?.rate_limit?.primary_window,__cupRate?.rate_limit?.secondary_window]" +
          ".find(e=>e!=null&&Math.abs((e.limit_window_seconds??0)-604800)<=60)," +
          "__cupUsed=__cupWin?.used_percent," +
          "__cupPct=__cupUsed==null||!Number.isFinite(Number(__cupUsed))?null:" +
          "Math.round(Math.min(Math.max(100-Number(__cupUsed),0),100))," +
          `${accountKey}=${accountId}??${accountData}?.accountId??null`,
      );

      result = result.replace(
        modernRenderPattern,
        (_match, _result, _cache, _dependencyIndex, button, _valueIndex, jsx, trailing) =>
          `return (0,${jsx}.jsxs)(\`div\`,{` +
          "className:`flex min-w-0 flex-1 items-center gap-0 sidebar-item`," +
          `children:[${button},__cupPct==null?null:(0,${jsx}.jsx)(\`span\`,{` +
          "className:`shrink-0 text-base text-token-foreground`," +
          `children:\`\${__cupPct}%\`}),${trailing}]})}`,
      );

      return result;
    },
  },
];

function patchFamily(source) {
  const marker = source.match(/__cupFamily=`([^`]+)`/);
  return marker?.[1] ?? null;
}

export function inspectRenderer(source) {
  const family = patchFamily(source);
  const candidates = adapters.map((adapter) => adapter.inspect(source));
  return {
    patched:
      family != null &&
      source.includes("__cupRate") &&
      source.includes("__cupPct"),
    family,
    candidates,
  };
}

export function patchRenderer(source) {
  const inspection = inspectRenderer(source);
  if (inspection.patched || source.includes(PATCH_PREFIX)) {
    throw new Error("renderer is already patched");
  }

  const matches = adapters.filter(
    (_adapter, index) => inspection.candidates[index].complete,
  );
  if (matches.length !== 1) {
    throw new Error(
      `supported account-footer structure anchors count must be 1; got ${matches.length}`,
    );
  }

  const patched = matches[0].patch(source);
  const patchedInspection = inspectRenderer(patched);
  if (!patchedInspection.patched || patchedInspection.family !== matches[0].family) {
    throw new Error("renderer patch did not produce a valid family marker");
  }
  return patched;
}
