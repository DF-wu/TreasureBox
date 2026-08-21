#!/usr/bin/env node

import { main } from '../src/cli.js';

main(process.argv.slice(2)).catch((error) => {
  const exitCode = Number.isInteger(error.exitCode) ? error.exitCode : 1;
  process.stderr.write(`hackmd-rt: ${error.message}\n`);
  process.exitCode = exitCode;
});