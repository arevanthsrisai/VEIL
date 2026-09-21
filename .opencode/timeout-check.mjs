// Verifies the adaptive timeout model baselines (global AGENTS.md §13) still hold on this machine.
// Run: node .opencode/timeout-check.mjs   (exit 1 = re-measure before trusting timeout tiers)
import { execSync } from "node:child_process";

// ponytail: fixed 5x drift tolerance; tighten only if failures start masking real slowness
const BASELINES = [
  { cmd: "git status", ms: 78 },
  { cmd: "node --version", ms: 41 },
];
const LIMIT_FACTOR = 5;

let failed = 0;
for (const { cmd, ms } of BASELINES) {
  const t0 = performance.now();
  let ok = true;
  try { execSync(cmd, { stdio: "ignore" }); } catch { ok = false; }
  const took = Math.round(performance.now() - t0);
  const pass = ok && took <= ms * LIMIT_FACTOR;
  if (!pass) failed++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${cmd}  ${took}ms (baseline ${ms}ms, limit ${ms * LIMIT_FACTOR}ms)`);
}
if (failed) {
  console.log(`${failed} check(s) failed — re-measure baselines with Measure-Command and update BASELINES here before trusting timeout tiers.`);
} else {
  console.log("Timeout model holds.");
}
process.exit(failed ? 1 : 0);
