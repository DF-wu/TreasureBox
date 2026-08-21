import assert from 'node:assert/strict';
import test from 'node:test';

import { applyOperation, replacementOperation, transformOperations } from '../src/ot.js';

test('builds a minimal replacement operation', () => {
  const operation = replacementOperation('abcde', 'abXYde');
  assert.deepEqual(operation.toJSON(), [2, 'XY', -1, 2]);
  assert.equal(operation.apply('abcde'), 'abXYde');
});

test('uses UTF-16 code-unit lengths for supplementary characters', () => {
  const before = 'a🌸b';
  const after = 'a🌸中文b';
  const operation = replacementOperation(before, after);
  assert.equal(operation.apply(before), after);
  assert.equal(operation.baseLength, before.length);
});

test('applies and transforms serialized concurrent operations', () => {
  assert.equal(applyOperation('abc', [1, 'x', 2]), 'axbc');
  const [left, right] = transformOperations([1, 'x', 2], [2, 'y', 1]);
  assert.equal(applyOperation(applyOperation('abc', [1, 'x', 2]), right), 'axbyc');
  assert.equal(applyOperation(applyOperation('abc', [2, 'y', 1]), left), 'axbyc');
});