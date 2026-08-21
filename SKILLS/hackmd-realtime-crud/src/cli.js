import fs from 'node:fs';
import path from 'node:path';

import { CookieJar, defaultCookiePath, importCookies } from './cookies.js';
import { CliError } from './errors.js';
import { fetchOverview } from './http.js';
import { createNote, deleteNote, getNote, listNotes, searchNotes, updateNote } from './notes.js';

const HELP = `hackmd-rt 2.0 - HackMD realtime OT CLI

Usage:
  hackmd-rt status [--json]
  hackmd-rt auth import --cookie-file PATH [--clear] [--json]
  hackmd-rt notes list [--json]
  hackmd-rt notes search QUERY [--limit N] [--json]
  hackmd-rt notes get SELECTOR [--raw|--json]
  hackmd-rt notes create --file PATH [--title TITLE] [--json]
  hackmd-rt notes update SELECTOR --file PATH [--json]
  hackmd-rt notes delete SELECTOR --yes [--json]

Global options:
  --cookies PATH   Cookie store (default: ${defaultCookiePath()})
  --timeout MS     Realtime handshake/write timeout (default: 20000)
`;

export function parseCommandLine(argv) {
  const options = {};
  const positionals = [];
  const booleans = new Set(['json', 'raw', 'clear', 'yes', 'help', 'version']);
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith('--')) {
      positionals.push(value);
      continue;
    }
    const separator = value.indexOf('=');
    const name = value.slice(2, separator < 0 ? undefined : separator);
    if (booleans.has(name)) {
      options[name] = separator < 0 || value.slice(separator + 1) !== 'false';
      continue;
    }
    const optionValue = separator < 0 ? argv[++index] : value.slice(separator + 1);
    if (optionValue === undefined || optionValue.startsWith('--')) throw new CliError(`--${name} requires a value.`);
    options[name] = optionValue;
  }
  return { options, positionals };
}

function positiveInteger(value, name) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new CliError(`--${name} must be a positive integer.`);
  return parsed;
}

export function validateInvocation(positionals, options) {
  const [group, action, ...rest] = positionals;
  const command = group === 'status' ? 'status' : `${group || ''} ${action || ''}`.trim();
  const allowedByCommand = {
    status: ['cookies', 'json'],
    'auth import': ['cookie-file', 'clear', 'cookies', 'json'],
    'notes list': ['cookies', 'json'],
    'notes search': ['cookies', 'json', 'limit'],
    'notes get': ['cookies', 'json', 'raw', 'timeout'],
    'notes create': ['cookies', 'file', 'json', 'timeout', 'title'],
    'notes update': ['cookies', 'file', 'json', 'timeout'],
    'notes delete': ['cookies', 'json', 'timeout', 'yes']
  };
  const globallyAllowed = new Set(['help', 'version']);
  const allowed = allowedByCommand[command];
  if (allowed) {
    const commandAllowed = new Set([...allowed, ...globallyAllowed]);
    const unknown = Object.keys(options).find((name) => !commandAllowed.has(name));
    if (unknown) throw new CliError(`Unknown option for ${command}: --${unknown}.`);
  }
  if (options.raw && options.json) throw new CliError('--raw and --json cannot be used together.');
  if (options.timeout !== undefined) positiveInteger(options.timeout, 'timeout');
  if (options.limit !== undefined) positiveInteger(options.limit, 'limit');

  if (command === 'status' || command === 'notes list' || command === 'notes create') {
    if (rest.length > 0) throw new CliError(`${command} does not accept positional arguments.`);
  } else if (command === 'auth import') {
    if (rest.length > 0) throw new CliError('auth import does not accept positional arguments.');
  } else if (command === 'notes get' || command === 'notes update' || command === 'notes delete') {
    if (rest.length !== 1) throw new CliError(`${command} requires exactly one selector.`);
  } else if (command === 'notes search' && rest.length === 0) {
    throw new CliError('notes search requires a query.');
  }
}

async function markdownInput(file) {
  if (!file) throw new CliError('Provide complete Markdown with --file PATH or --file -.');
  if (file === '-') {
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
    return Buffer.concat(chunks).toString('utf8');
  }
  try {
    return await fs.promises.readFile(path.resolve(file), 'utf8');
  } catch (error) {
    throw new CliError(`Could not read Markdown file: ${error.message}`);
  }
}

function output(value, options) {
  if (options.raw) {
    process.stdout.write(value.content);
    if (value.content && !value.content.endsWith('\n')) process.stdout.write('\n');
  } else if (options.json) {
    console.log(JSON.stringify(value, null, 2));
  } else if (Array.isArray(value)) {
    for (const item of value) console.log(`${item.title}\t${item.shortId || item.id}\t${item.workspace}`);
  } else {
    console.log(JSON.stringify(value, null, 2));
  }
}

export async function main(argv) {
  const { options, positionals } = parseCommandLine(argv);
  if (options.version) {
    console.log('2.0.0');
    return;
  }
  if (options.help || positionals.length === 0) {
    process.stdout.write(HELP);
    return;
  }
  validateInvocation(positionals, options);
  const cookies = path.resolve(options.cookies || defaultCookiePath());
  const timeoutMs = Number(options.timeout || 20_000);
  if (timeoutMs < 1_000) throw new CliError('--timeout must be at least 1000 ms.');

  const [group, action, ...rest] = positionals;
  if (group === 'auth' && action === 'import') {
    if (!options['cookie-file']) throw new CliError('auth import requires --cookie-file PATH.');
    output(await importCookies(options['cookie-file'], cookies, options.clear), options);
    return;
  }

  const jar = await CookieJar.load(cookies);
  if (group === 'status') {
    const notes = await fetchOverview(jar);
    await jar.save(cookies);
    output({ authenticated: true, notes: notes.length, cookies }, options);
    return;
  }
  if (group !== 'notes') throw new CliError(`Unknown command: ${positionals.join(' ')}`);

  let result;
  if (action === 'list') result = await listNotes(jar);
  else if (action === 'search') result = searchNotes(await fetchOverview(jar), rest.join(' '), Number(options.limit || 20));
  else if (action === 'get') {
    if (!rest[0]) throw new CliError('notes get requires a selector.');
    result = await getNote(jar, rest[0], timeoutMs);
  } else if (action === 'create') {
    result = await createNote(jar, await markdownInput(options.file), options.title || '', timeoutMs);
  } else if (action === 'update') {
    if (!rest[0]) throw new CliError('notes update requires a selector.');
    result = await updateNote(jar, rest[0], await markdownInput(options.file), timeoutMs);
  } else if (action === 'delete') {
    if (!rest[0]) throw new CliError('notes delete requires a selector.');
    if (!options.yes) throw new CliError('Refusing to delete without --yes.', 2);
    result = await deleteNote(jar, rest[0], timeoutMs);
  } else throw new CliError(`Unknown notes command: ${action || ''}`);

  await jar.save(cookies);
  output(result, options);
}
