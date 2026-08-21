import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveNote, searchNotes, selectorFromInput, updateById } from '../src/notes.js';
import { CliError } from '../src/errors.js';

const notes = [
  { id: 'uuid-1', shortId: 'short-1', title: 'Alpha', tags: ['one'], content: 'excerpt', teamname: null },
  { id: 'uuid-2', shortId: 'short-2', title: 'Beta', tags: ['two'], content: 'needle here', teamname: 'team' }
];

test('normalizes HackMD URLs without accepting foreign URLs', () => {
  assert.equal(selectorFromInput('https://hackmd.io/short-1'), 'short-1');
  assert.equal(selectorFromInput('https://example.com/short-1'), 'https://example.com/short-1');
});

test('resolves exact title and ID selectors', () => {
  assert.equal(resolveNote(notes, 'Alpha').id, 'uuid-1');
  assert.equal(resolveNote(notes, 'short-2').id, 'uuid-2');
});

test('rejects duplicate exact titles', () => {
  assert.throws(() => resolveNote([...notes, { ...notes[0], id: 'uuid-3' }], 'Alpha'), /Ambiguous/);
});

test('searches overview metadata and excerpts', () => {
  assert.deepEqual(searchNotes(notes, 'needle').map((note) => note.id), ['uuid-2']);
  assert.deepEqual(searchNotes(notes, 'one').map((note) => note.id), ['uuid-1']);
});

test('reconciles a lost acknowledgement through exact readback', async () => {
  const realtime = {
    write: async () => {
      throw new CliError('ack lost', 5, { mayHaveApplied: true });
    },
    read: async () => ({ content: '# requested', revision: 4 })
  };
  assert.deepEqual(await updateById({}, 'note-id', '# requested', 1_000, realtime), {
    changed: true,
    concurrent: false,
    revision: 4,
    verified: true,
    acknowledgementLost: true
  });
});

test('reports an uncertain update when acknowledgement and content disagree', async () => {
  const realtime = {
    write: async () => {
      throw new CliError('ack lost', 5, { mayHaveApplied: true });
    },
    read: async () => ({ content: '# concurrent', revision: 4 })
  };
  await assert.rejects(
    updateById({}, 'note-id', '# requested', 1_000, realtime),
    (error) => error.exitCode === 5 && error.details.mayHaveApplied === true
  );
});
