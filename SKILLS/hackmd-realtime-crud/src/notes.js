import { CliError } from './errors.js';
import { BASE_URL, createEmptyNote, fetchOverview } from './http.js';
import { replacementOperation } from './ot.js';
import { readRealtime, writeRealtime } from './realtime.js';

export function noteMetadata(note) {
  return {
    id: note.id ?? null,
    shortId: note.shortId ?? null,
    title: note.title || 'Untitled',
    tags: Array.isArray(note.tags) ? note.tags : [],
    lastchangeAt: note.lastchangeAt ?? null,
    createdAt: note.createdAt ?? null,
    workspace: note.teamname || 'personal',
    teampath: note.teampath || null,
    permalink: note.permalink || null,
    isOwner: Boolean(note.isOwner),
    url: note.shortId ? `${BASE_URL}/${note.shortId}` : null
  };
}

export function selectorFromInput(input) {
  const raw = String(input || '').trim();
  if (!raw) return '';
  try {
    const url = new URL(raw);
    if (url.origin !== BASE_URL) return raw;
    return decodeURIComponent(url.pathname.split('/').filter(Boolean).at(-1) || raw);
  } catch {
    return raw;
  }
}

export function resolveNote(notes, input) {
  const raw = String(input || '').trim();
  const selector = selectorFromInput(raw);
  const matches = notes.filter((note) => [
    note.id,
    note.shortId,
    note.permalink,
    note.title,
    note.shortId ? `${BASE_URL}/${note.shortId}` : null
  ].filter(Boolean).some((candidate) => String(candidate) === selector || String(candidate) === raw));
  if (matches.length === 0) throw new CliError(`Note not found: ${raw}`, 2);
  if (matches.length > 1) throw new CliError('Ambiguous note selector. Use a note ID or URL.', 2);
  return matches[0];
}

export function searchNotes(notes, query, limit = 20) {
  const needle = String(query || '').toLocaleLowerCase();
  if (!needle) throw new CliError('Search query cannot be empty.');
  return notes.filter((note) => {
    const title = String(note.title || '').toLocaleLowerCase();
    const excerpt = String(note.content || '').toLocaleLowerCase();
    const tags = Array.isArray(note.tags) ? note.tags.map((tag) => String(tag).toLocaleLowerCase()) : [];
    return title.includes(needle) || excerpt.includes(needle) || tags.some((tag) => tag.includes(needle));
  }).slice(0, limit).map(noteMetadata);
}

async function resolveFromOverview(jar, selector) {
  const notes = await fetchOverview(jar);
  return { note: resolveNote(notes, selector), notes };
}

export async function listNotes(jar) {
  return (await fetchOverview(jar)).map(noteMetadata);
}

export async function getNote(jar, selector, timeoutMs) {
  let note;
  let noteId = selectorFromInput(selector);
  try {
    note = (await resolveFromOverview(jar, selector)).note;
    noteId = note.shortId || note.id;
  } catch (error) {
    if (error.exitCode !== 3 && !/^[-_A-Za-z0-9]+$/.test(noteId)) throw error;
  }
  const snapshot = await readRealtime(jar, noteId, timeoutMs);
  return { ...(note ? noteMetadata(note) : { shortId: noteId, url: `${BASE_URL}/${noteId}` }), ...snapshot };
}

export async function createNote(jar, content, title, timeoutMs) {
  const created = await createEmptyNote(jar, title);
  const heading = title ? `# ${title.trim()}` : '';
  const firstLine = content.replace(/^\uFEFF/, '').split(/\r?\n/, 1)[0].trim();
  const completeContent = heading && firstLine !== heading ? `${heading}\n\n${content}` : content;
  try {
    const result = await updateById(jar, created.noteId, completeContent, timeoutMs);
    return { ...created, ...result };
  } catch (error) {
    throw new CliError(
      `Created ${created.url}, but content initialization did not complete: ${error.message}`,
      error.exitCode || 5,
      { ...error.details, noteId: created.noteId, url: created.url, created: true }
    );
  }
}

export async function updateById(
  jar,
  noteId,
  content,
  timeoutMs,
  realtime = { read: readRealtime, write: writeRealtime }
) {
  let write;
  try {
    write = await realtime.write(jar, noteId, (before) => replacementOperation(before, content), timeoutMs);
  } catch (error) {
    if (!error.details?.mayHaveApplied) throw error;
    const reconciled = await realtime.read(jar, noteId, timeoutMs).catch((readError) => {
      throw new CliError(
        `Update outcome is unknown for ${BASE_URL}/${noteId}; acknowledgement and reconciliation both failed (${readError.message}).`,
        5,
        { noteId, mayHaveApplied: true }
      );
    });
    if (reconciled.content === content) {
      return {
        changed: true,
        concurrent: false,
        revision: reconciled.revision,
        verified: true,
        acknowledgementLost: true
      };
    }
    throw new CliError(
      `Update outcome is uncertain for ${BASE_URL}/${noteId}; the current content does not match the request. Reconcile before retrying.`,
      5,
      { noteId, mayHaveApplied: true, revision: reconciled.revision }
    );
  }
  const verified = await realtime.read(jar, noteId, timeoutMs);
  if (verified.content !== content) {
    throw new CliError(
      'The note changed during the update; realtime OT preserved the concurrent edit, so exact verification failed.',
      4,
      { noteId, revision: verified.revision, concurrent: write.concurrent }
    );
  }
  return { changed: write.changed, concurrent: write.concurrent, revision: verified.revision, verified: true };
}

export async function updateNote(jar, selector, content, timeoutMs) {
  let note;
  let noteId = selectorFromInput(selector);
  try {
    note = (await resolveFromOverview(jar, selector)).note;
    noteId = note.shortId || note.id;
  } catch (error) {
    if (error.exitCode !== 3 && !/^[-_A-Za-z0-9]+$/.test(noteId)) throw error;
  }
  const result = await updateById(jar, noteId, content, timeoutMs);
  return { ...(note ? noteMetadata(note) : { shortId: noteId, url: `${BASE_URL}/${noteId}` }), ...result };
}

export async function deleteNote(jar, selector, timeoutMs) {
  const { note } = await resolveFromOverview(jar, selector);
  const noteId = note.shortId || note.id;
  const connection = await (await import('./realtime.js')).connectRealtime(jar, noteId, timeoutMs);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      connection.socket.close();
      resolve();
    }, Math.min(timeoutMs, 2_000));
    connection.socket.once('disconnect', () => {
      clearTimeout(timer);
      resolve();
    });
    connection.socket.once('info', (info) => {
      clearTimeout(timer);
      connection.socket.close();
      reject(new CliError(`HackMD rejected the delete request (code ${info?.code || 'unknown'}).`, 3));
    });
    connection.socket.emit('delete');
  });
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    let notes;
    try {
      notes = await fetchOverview(jar);
    } catch (error) {
      throw new CliError(
        `Delete outcome is unknown for ${BASE_URL}/${noteId}; verification failed (${error.message}). Check HackMD Trash before retrying.`,
        5,
        { noteId, mayHaveDeleted: true }
      );
    }
    if (!notes.some((candidate) => candidate.shortId === noteId || candidate.id === noteId)) {
      return { ...noteMetadata(note), deleted: true, verified: true, recovery: 'HackMD Trash' };
    }
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
  throw new CliError(
    `The note still appears active after the delete request: ${BASE_URL}/${noteId}.`,
    5,
    { noteId, mayHaveDeleted: true }
  );
}
