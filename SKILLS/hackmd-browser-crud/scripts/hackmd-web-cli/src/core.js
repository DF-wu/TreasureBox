import fs from 'node:fs';
import path from 'node:path';

export const BASE_URL = 'https://hackmd.io';

export class CliError extends Error {
  constructor(message, exitCode = 1) {
    super(message);
    this.name = 'CliError';
    this.exitCode = exitCode;
  }
}

const BOOLEAN_OPTIONS = new Set(['json', 'headed', 'yes', 'raw', 'help', 'version', 'clear']);

export function parseCommandLine(argv) {
  const options = {};
  const positionals = [];

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--') {
      positionals.push(...argv.slice(index + 1));
      break;
    }
    if (!argument.startsWith('--')) {
      positionals.push(argument);
      continue;
    }

    const equalsIndex = argument.indexOf('=');
    const name = argument.slice(2, equalsIndex < 0 ? undefined : equalsIndex);
    if (!name) throw new CliError('Invalid empty option.');

    if (BOOLEAN_OPTIONS.has(name)) {
      options[name] = equalsIndex < 0 ? true : argument.slice(equalsIndex + 1) !== 'false';
      continue;
    }

    if (equalsIndex >= 0) {
      options[name] = argument.slice(equalsIndex + 1);
      continue;
    }

    const value = argv[index + 1];
    if (value === undefined || value.startsWith('--')) {
      throw new CliError(`Option --${name} requires a value.`);
    }
    options[name] = value;
    index += 1;
  }

  return { options, positionals };
}

export function positiveInteger(value, fallback, optionName) {
  if (value === undefined) return fallback;
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new CliError(`--${optionName} must be a positive integer.`);
  }
  return parsed;
}

function normalizeBoolean(value) {
  if (typeof value === 'boolean') return value;
  return /^(1|true|yes)$/i.test(String(value || '').trim());
}

function normalizeSameSite(value) {
  const normalized = String(value || '').toLowerCase().replace(/[_ -]/g, '');
  if (normalized === 'strict') return 'Strict';
  if (normalized === 'none' || normalized === 'norestriction') return 'None';
  return 'Lax';
}

function cookieField(row, ...names) {
  for (const name of names) {
    if (row?.[name] !== undefined && row[name] !== null) return row[name];
  }
  return undefined;
}

function normalizeHost(rawHost) {
  let host = String(rawHost || '').trim();
  if (!host) return '';
  try {
    if (/^https?:\/\//i.test(host)) host = new URL(host).hostname;
  } catch {
    return '';
  }
  return host.replace(/^\./, '').replace(/\/$/, '').toLowerCase();
}

export function parseCookieExport(text, nowSeconds = Math.floor(Date.now() / 1000)) {
  let rows;
  try {
    rows = JSON.parse(text);
  } catch {
    throw new CliError('Cookie export must be a JSON array.');
  }
  if (!Array.isArray(rows)) throw new CliError('Cookie export must be a JSON array.');

  const cookies = [];
  let skipped = 0;

  for (const row of rows) {
    const name = String(cookieField(row, 'name', 'Name raw') || '').trim();
    const value = String(cookieField(row, 'value', 'Content raw') ?? '');
    const host = normalizeHost(cookieField(row, 'domain', 'host', 'Host raw'));
    const cookiePath = String(cookieField(row, 'path', 'Path raw') || '/');

    if (!name || host !== 'hackmd.io') {
      skipped += 1;
      continue;
    }

    const expiresValue = Number(cookieField(row, 'expires', 'expirationDate', 'Expires raw'));
    if (Number.isFinite(expiresValue) && expiresValue > 0 && expiresValue < nowSeconds) {
      skipped += 1;
      continue;
    }

    const secure = normalizeBoolean(cookieField(row, 'secure', 'Send for raw'));
    const sameSite = normalizeSameSite(cookieField(row, 'sameSite', 'SameSite raw'));
    const cookie = {
      name,
      value,
      url: `${secure ? 'https' : 'http'}://${host}${cookiePath.startsWith('/') ? cookiePath : `/${cookiePath}`}`,
      httpOnly: normalizeBoolean(cookieField(row, 'httpOnly', 'HTTP only raw')),
      secure,
      sameSite
    };
    if (Number.isFinite(expiresValue) && expiresValue > 0) cookie.expires = Math.floor(expiresValue);
    cookies.push(cookie);
  }

  return { cookies, skipped };
}

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
    userpath: note.userpath || null,
    permalink: note.permalink || null,
    isOwner: Boolean(note.isOwner),
    publishType: note.publishType || null,
    url: note.shortId ? `${BASE_URL}/${note.shortId}` : null
  };
}

export function selectorFromInput(input) {
  const raw = String(input || '').trim();
  if (!raw) return '';
  try {
    const url = new URL(raw);
    if (!/(^|\.)hackmd\.io$/i.test(url.hostname)) return raw;
    return decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() || raw);
  } catch {
    return raw;
  }
}

export function resolveNote(notes, input) {
  const raw = String(input || '').trim();
  const selector = selectorFromInput(raw);
  const matches = notes.filter((note) =>
    [note.id, note.shortId, note.permalink, note.title, note.shortId ? `${BASE_URL}/${note.shortId}` : null]
      .filter(Boolean)
      .some((candidate) => String(candidate) === selector || String(candidate) === raw)
  );

  if (matches.length === 0) throw new CliError(`Note not found: ${raw}`, 2);
  if (matches.length > 1) {
    const choices = matches.map((note) => `${note.title} (${note.shortId})`).join(', ');
    throw new CliError(`Ambiguous note selector. Use a short ID or URL: ${choices}`, 2);
  }
  return matches[0];
}

export function searchNotes(notes, query, limit = 20) {
  const needle = String(query || '').toLocaleLowerCase();
  if (!needle) throw new CliError('Search query cannot be empty.');
  const results = [];

  for (const note of notes) {
    const title = String(note.title || '');
    const content = String(note.content || '');
    const tags = Array.isArray(note.tags) ? note.tags.map(String) : [];
    const titleIndex = title.toLocaleLowerCase().indexOf(needle);
    const contentIndex = content.toLocaleLowerCase().indexOf(needle);
    const tagMatch = tags.some((tag) => tag.toLocaleLowerCase().includes(needle));
    if (titleIndex < 0 && contentIndex < 0 && !tagMatch) continue;

    const start = Math.max(0, contentIndex - 80);
    results.push({
      ...noteMetadata(note),
      matchedIn: [titleIndex >= 0 && 'title', tagMatch && 'tags', contentIndex >= 0 && 'content'].filter(Boolean),
      excerpt: contentIndex >= 0 ? content.slice(start, start + 240).replace(/\s+/g, ' ').trim() : null
    });
    if (results.length >= limit) break;
  }
  return results;
}

export async function readMarkdownFile(file) {
  if (!file) throw new CliError('Provide Markdown with --file PATH (or --file - for stdin).');
  if (file === '-') {
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString('utf8');
  }
  const resolved = path.resolve(file);
  try {
    return await fs.promises.readFile(resolved, 'utf8');
  } catch (error) {
    throw new CliError(`Could not read Markdown file: ${resolved} (${error.message})`);
  }
}

export function applyTitle(content, title) {
  if (!title) return content;
  const heading = `# ${String(title).trim()}`;
  if (content.replace(/^\uFEFF/, '').split(/\r?\n/, 1)[0].trim() === heading) return content;
  return `${heading}\n\n${content}`;
}
