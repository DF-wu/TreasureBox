import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { CookieJar, importCookies, normalizeCookieExport } from '../src/cookies.js';

test('normalizes browser cookies and rejects unrelated domains', () => {
  const result = normalizeCookieExport([
    { name: 'connect.sid', value: 'signed', domain: '.hackmd.io', path: '/', secure: true, httpOnly: true },
    { name: 'foreign', value: 'secret', domain: '.example.com', path: '/' }
  ]);
  assert.equal(result.cookies.length, 1);
  assert.equal(result.skipped, 1);
  assert.equal(result.cookies[0].domain, 'hackmd.io');
  assert.equal(result.cookies[0].hostOnly, false);
});

test('cookie header obeys path, secure, and expiration constraints', () => {
  const jar = new CookieJar([
    { name: 'valid', value: 'one', domain: 'hackmd.io', path: '/', secure: true },
    { name: 'path', value: 'two', domain: 'hackmd.io', path: '/private', secure: true },
    { name: 'domain', value: 'four', domain: '.hackmd.io', path: '/', secure: true },
    { name: 'expired', value: 'three', domain: 'hackmd.io', path: '/', expires: 1 }
  ]);
  assert.equal(jar.header('https://hackmd.io/note'), 'valid=one; domain=four');
  assert.equal(jar.header('https://hackmd.io/private/note'), 'path=two; valid=one; domain=four');
  assert.equal(jar.header('https://hackmd.io/private-other'), 'valid=one; domain=four');
  assert.equal(jar.header('https://realtime.hackmd.io/note'), 'domain=four');
  assert.equal(jar.header('http://hackmd.io/private/note'), '');
});

test('orders same-name cookies by longest path first', () => {
  const jar = new CookieJar([
    { name: 'sid', value: 'root', domain: 'hackmd.io', path: '/', secure: true },
    { name: 'sid', value: 'specific', domain: 'hackmd.io', path: '/private', secure: true }
  ]);
  assert.equal(jar.header('https://hackmd.io/private/note'), 'sid=specific; sid=root');
});

test('import writes a private cookie store without printing values', async () => {
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'hackmd-rt-test-'));
  const source = path.join(directory, 'export.json');
  const destination = path.join(directory, 'cookies.json');
  await fs.promises.writeFile(source, JSON.stringify([
    { name: 'connect.sid', value: 'signed', domain: 'hackmd.io', path: '/', secure: true }
  ]));
  const result = await importCookies(source, destination, true);
  assert.deepEqual(result, { imported: 1, skipped: 0, path: destination });
  assert.equal((await fs.promises.stat(destination)).mode & 0o777, 0o600);
});
