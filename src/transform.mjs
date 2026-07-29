const START_FROM = "function c0l(){let e=(0,l0l.c)(43),";
const START_TO = "function c0l(){let e=(0,l0l.c)(44),";

const DATA_FROM = ",{data:v}=o2r(),y=i??v?.accountId??null";
const DATA_TO =
  ",{data:v}=o2r(),{data:__cupRate}=Y(NE)," +
  "__cupWin=[__cupRate?.rate_limit?.primary_window,__cupRate?.rate_limit?.secondary_window]" +
  ".find(e=>e!=null&&Math.abs((e.limit_window_seconds??0)-604800)<=60)," +
  "__cupUsed=__cupWin?.used_percent," +
  "__cupPct=__cupUsed==null||!Number.isFinite(Number(__cupUsed))?null:" +
  "Math.round(Math.min(Math.max(100-Number(__cupUsed),0),100))," +
  "y=i??v?.accountId??null";

const RENDER_FROM =
  "let te;return e[41]===q?te=e[42]:(te=(0,m7.jsxs)(`div`,{" +
  "className:`flex min-w-0 flex-1 items-center gap-0 sidebar-item`," +
  "children:[q,ee]}),e[41]=q,e[42]=te),te}";

const RENDER_TO =
  "let te;return e[41]!==q||e[42]!==__cupPct?(te=(0,m7.jsxs)(`div`,{" +
  "className:`flex min-w-0 flex-1 items-center gap-0 sidebar-item`," +
  "children:[q,__cupPct==null?null:(0,m7.jsx)(`span`,{" +
  "className:`shrink-0 text-base text-token-foreground`," +
  "children:`${__cupPct}%`}),ee]}),e[41]=q,e[42]=__cupPct,e[43]=te):te=e[43],te}";

const REPLACEMENTS = [
  ["component cache", START_FROM, START_TO],
  ["rate-limit data", DATA_FROM, DATA_TO],
  ["account footer render", RENDER_FROM, RENDER_TO],
];

function count(source, needle) {
  return source.split(needle).length - 1;
}

export function inspectRenderer(source) {
  const anchorCounts = Object.fromEntries(
    REPLACEMENTS.map(([name, from]) => [name, count(source, from)]),
  );
  return {
    patched: source.includes("__cupRate") && source.includes("__cupPct"),
    anchorCounts,
  };
}

export function patchRenderer(source) {
  const inspection = inspectRenderer(source);
  if (inspection.patched) {
    throw new Error("renderer is already patched");
  }

  for (const [name] of REPLACEMENTS) {
    if (inspection.anchorCounts[name] !== 1) {
      throw new Error(
        `${name} anchor count must be 1; got ${inspection.anchorCounts[name]}`,
      );
    }
  }

  return REPLACEMENTS.reduce(
    (result, [, from, to]) => result.replace(from, to),
    source,
  );
}
