import assert from 'node:assert/strict';
import test from 'node:test';

import { parseCommandLine, validateInvocation } from '../src/cli.js';

test('parses values and boolean options', () => {
  assert.deepEqual(parseCommandLine(['notes', 'get', 'id', '--timeout', '5000', '--json']), {
    options: { timeout: '5000', json: true },
    positionals: ['notes', 'get', 'id']
  });
});

test('rejects unknown and incompatible options', () => {
  assert.throws(
    () => validateInvocation(['notes', 'get', 'id'], { surprise: true }),
    /Unknown option/
  );
  assert.throws(
    () => validateInvocation(['notes', 'get', 'id'], { raw: true, json: true }),
    /cannot be used together/
  );
});

test('validates positional arity and numeric options', () => {
  assert.throws(() => validateInvocation(['notes', 'get'], {}), /exactly one selector/);
  assert.throws(() => validateInvocation(['notes', 'list', 'extra'], {}), /does not accept/);
  assert.throws(() => validateInvocation(['notes', 'search', 'query'], { limit: 'wat' }), /positive integer/);
  assert.throws(() => validateInvocation(['notes', 'search', 'query'], { limit: '-1' }), /positive integer/);
});