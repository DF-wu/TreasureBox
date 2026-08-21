import assert from 'node:assert/strict';
import test from 'node:test';

import { csrfFromNewPage } from '../src/http.js';

test('extracts the CSRF token from the current new-note bootstrap', () => {
  assert.equal(csrfFromNewPage("<script>xhr.send('_csrf=token-123');</script>"), 'token-123');
});

test('fails closed when the new-note bootstrap changes', () => {
  assert.throws(() => csrfFromNewPage('<script>submit()</script>'), /no longer exposes/);
});