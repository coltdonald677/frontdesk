#!/usr/bin/env node
/**
 * Project Pluto verification orchestrator.
 * Runs automated checks in a safe order; does not connect to or mutate production databases.
 */

import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const ROOT = resolve(process.cwd());

/** @type {Array<{ id: string; label: string; command: string; args: string[]; env?: Record<string, string> }>} */
const STAGES = [
  {
    id: "tests",
    label: "Automated tests (vitest)",
    command: "npm",
    args: ["run", "test"],
  },
  {
    id: "typecheck",
    label: "TypeScript typecheck",
    command: "npm",
    args: ["run", "typecheck"],
  },
  {
    id: "build",
    label: "Production build",
    command: "npm",
    args: ["run", "build"],
  },
  {
    id: "migration-validation",
    label: "Migration file validation",
    command: "node",
    args: ["scripts/validate-migrations.mjs"],
  },
  {
    id: "env-shape",
    label: "Environment variable shape validation",
    command: "node",
    args: ["scripts/validate-env-shape.mjs"],
  },
];

function runStage(stage) {
  console.log(`\n${"=".repeat(72)}`);
  console.log(`VERIFY STAGE: ${stage.label}`);
  console.log("=".repeat(72));

  const result = spawnSync(stage.command, stage.args, {
    cwd: ROOT,
    env: { ...process.env, ...stage.env },
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.error) {
    return { ok: false, detail: result.error.message };
  }

  if (result.status !== 0) {
    return { ok: false, detail: `exit code ${result.status ?? "unknown"}` };
  }

  return { ok: true };
}

function main() {
  console.log("Project Pluto — verify pipeline");
  console.log(`Working directory: ${ROOT}`);
  console.log(`Stages: ${STAGES.map((s) => s.id).join(" → ")}`);

  const startedAt = Date.now();

  for (const stage of STAGES) {
    const outcome = runStage(stage);
    if (!outcome.ok) {
      console.error(`\n${"!".repeat(72)}`);
      console.error(`VERIFY FAILED at stage: ${stage.id} (${stage.label})`);
      if (outcome.detail) {
        console.error(`Detail: ${outcome.detail}`);
      }
      console.error(`${"!".repeat(72)}`);
      console.error("\nFix the failure above, then re-run: npm run verify");
      process.exit(1);
    }
  }

  const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`\n${"=".repeat(72)}`);
  console.log(`VERIFY PASSED — all ${STAGES.length} stages completed in ${elapsedSec}s`);
  console.log(`${"=".repeat(72)}`);
}

main();
