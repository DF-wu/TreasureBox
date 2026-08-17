#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const cliDirectory = path.join(scriptDirectory, 'hackmd-web-cli');
const dependencyMarker = path.join(cliDirectory, 'node_modules', 'playwright-core', 'package.json');

if (!fs.existsSync(dependencyMarker)) {
  console.error('hackmd-web: installing the pinned browser runtime dependency (first run only)...');
  const npmArguments = ['ci', '--omit=dev', '--no-audit', '--no-fund'];
  const bundledNpmCli = path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
  const npmCommand = fs.existsSync(bundledNpmCli) ? process.execPath : 'npm';
  const installArguments = fs.existsSync(bundledNpmCli)
    ? [bundledNpmCli, ...npmArguments]
    : npmArguments;
  const install = spawnSync(
    npmCommand,
    installArguments,
    { cwd: cliDirectory, stdio: 'inherit' }
  );
  if (install.error) {
    console.error(`hackmd-web: could not run npm (${install.error.message})`);
    process.exit(1);
  }
  if (install.status !== 0) process.exit(install.status ?? 1);
}

const cliEntry = path.join(cliDirectory, 'bin', 'hackmd-web.js');
const run = spawnSync(process.execPath, [cliEntry, ...process.argv.slice(2)], {
  cwd: process.cwd(),
  stdio: 'inherit'
});

if (run.error) {
  console.error(`hackmd-web: could not start the CLI (${run.error.message})`);
  process.exit(1);
}
process.exitCode = run.status ?? 1;
