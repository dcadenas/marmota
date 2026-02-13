#!/usr/bin/env node
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";

const REPO = "https://github.com/marmot-protocol/marmot-ts.git";
const COMMIT = "9c61efc";
const DIR = "vendor/marmot-ts";

if (existsSync(`${DIR}/dist/index.js`)) process.exit(0);

if (existsSync(DIR)) rmSync(DIR, { recursive: true, force: true });
mkdirSync("vendor", { recursive: true });

execSync(`git clone --single-branch --branch master ${REPO} ${DIR}`, {
  stdio: "inherit",
});
execSync(`git -C ${DIR} checkout ${COMMIT}`, { stdio: "inherit" });
execSync("npm install --ignore-scripts", { cwd: DIR, stdio: "inherit" });
execSync("npx tsc -b tsconfig.build.json", { cwd: DIR, stdio: "inherit" });
