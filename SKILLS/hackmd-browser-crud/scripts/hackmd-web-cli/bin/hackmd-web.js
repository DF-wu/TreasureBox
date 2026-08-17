#!/usr/bin/env node

import { main } from '../src/cli.js';

main(process.argv.slice(2)).catch((error) => {
  const message = error?.message || String(error);
  console.error(`hackmd-web: ${message}`);
  if (process.env.HACKMD_WEB_DEBUG && error?.stack) {
    console.error(error.stack);
  }
  process.exitCode = Number.isInteger(error?.exitCode) ? error.exitCode : 1;
});
