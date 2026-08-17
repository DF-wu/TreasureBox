import fs from 'node:fs';
import path from 'node:path';
import {
  CliError,
  applyTitle,
  noteMetadata,
  parseCommandLine,
  parseCookieExport,
  positiveInteger,
  readMarkdownFile,
  resolveNote,
  searchNotes
} from './core.js';
import {
  createNote,
  defaultProfilePath,
  deleteNote,
  fetchOverview,
  openNote,
  openOverview,
  readEditorContent,
  updateNote,
  withBrowser
} from './browser.js';

const VERSION = '0.1.0';

const HELP = `hackmd-web ${VERSION}

Cookie-backed HackMD CLI. It does not call api.hackmd.io/v1 or the official MCP.

Usage:
  hackmd-web login [--timeout 600]
  hackmd-web status
  hackmd-web auth import --cookie-file PATH [--clear]
  hackmd-web notes list [--limit 50] [--json]
  hackmd-web notes search QUERY [--limit 20] [--json]
  hackmd-web notes get SELECTOR [--raw|--json]
  hackmd-web notes create --file PATH [--title TITLE] [--headed] [--json]
  hackmd-web notes update SELECTOR --file PATH [--headed] [--json]
  hackmd-web notes delete SELECTOR --yes [--headed] [--json]

Global options:
  --profile PATH   Persistent browser profile (default: user-private config path)
  --browser PATH   Chrome/Edge executable (or set HACKMD_WEB_BROWSER)
  --headed         Show the browser for a mutation
  --json           Machine-readable output

SELECTOR may be a note ID, short ID, exact title, permalink, or HackMD URL.
Use --file - to read Markdown from stdin.`;

function writeJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function printRows(items) {
  if (items.length === 0) {
    console.log('No notes found.');
    return;
  }
  const rows = items.map((item) => ({
    ID: item.shortId || item.id || '',
    Title: item.title || '',
    Workspace: item.workspace || 'personal',
    Updated: item.lastchangeAt || '',
    Tags: Array.isArray(item.tags) ? item.tags.join(',') : ''
  }));
  console.table(rows);
}

function browserOptions(options, headed = false) {
  return {
    profile: options.profile || defaultProfilePath(),
    browser: options.browser,
    headed: headed || Boolean(options.headed)
  };
}

async function statusCommand(options) {
  return withBrowser(browserOptions(options), async ({ page, profile, executablePath }) => {
    await openOverview(page);
    const notes = await fetchOverview(page);
    const result = { authenticated: true, noteCount: notes.length, profile, browser: executablePath };
    if (options.json) writeJson(result);
    else {
      console.log('Authenticated: yes');
      console.log(`Notes: ${notes.length}`);
      console.log(`Profile: ${profile}`);
      console.log(`Browser: ${executablePath}`);
    }
  });
}

async function loginCommand(options) {
  const timeoutSeconds = positiveInteger(options.timeout, 600, 'timeout');
  return withBrowser(browserOptions(options, true), async ({ page, profile }) => {
    await openOverview(page);
    try {
      const notes = await fetchOverview(page);
      console.log(`Already authenticated (${notes.length} notes).`);
      console.log(`Profile: ${profile}`);
      return;
    } catch {
      console.error('Complete HackMD sign-in, SSO, CAPTCHA, or 2FA in the opened browser.');
    }

    const deadline = Date.now() + timeoutSeconds * 1000;
    while (Date.now() < deadline) {
      try {
        const notes = await fetchOverview(page);
        console.log(`Login saved (${notes.length} notes).`);
        console.log(`Profile: ${profile}`);
        return;
      } catch {
        await page.waitForTimeout(1_000);
      }
    }
    throw new CliError(`Login was not completed within ${timeoutSeconds} seconds.`, 3);
  });
}

async function importCookiesCommand(options) {
  if (!options['cookie-file']) throw new CliError('auth import requires --cookie-file PATH.');
  const cookiePath = path.resolve(options['cookie-file']);
  let text;
  try {
    text = await fs.promises.readFile(cookiePath, 'utf8');
  } catch (error) {
    throw new CliError(`Could not read cookie export: ${cookiePath} (${error.message})`);
  }
  const { cookies, skipped } = parseCookieExport(text);
  if (cookies.length === 0) throw new CliError('Cookie export contained no usable hackmd.io cookies.');

  return withBrowser(browserOptions(options), async ({ context, page, profile }) => {
    if (options.clear) await context.clearCookies();
    await context.addCookies(cookies);
    await openOverview(page);
    const notes = await fetchOverview(page);
    const result = { imported: cookies.length, skipped, authenticated: true, noteCount: notes.length, profile };
    if (options.json) writeJson(result);
    else {
      console.log(`Imported ${cookies.length} HackMD cookies; skipped ${skipped}.`);
      console.log(`Authenticated: yes (${notes.length} notes)`);
      console.log(`Profile: ${profile}`);
    }
  });
}

async function readCommand(action, args, options) {
  return withBrowser(browserOptions(options), async ({ page }) => {
    await openOverview(page);
    const notes = await fetchOverview(page);

    if (action === 'list') {
      const limit = positiveInteger(options.limit, 50, 'limit');
      const result = notes.slice(0, limit).map(noteMetadata);
      if (options.json) writeJson({ total: notes.length, items: result });
      else printRows(result);
      return;
    }

    if (action === 'search') {
      const query = args.join(' ').trim();
      if (!query) throw new CliError('notes search requires a query.');
      const limit = positiveInteger(options.limit, 20, 'limit');
      const result = searchNotes(notes, query, limit);
      if (options.json) writeJson({ count: result.length, items: result });
      else printRows(result);
      return;
    }

    const selector = args.join(' ').trim();
    if (!selector) throw new CliError('notes get requires a selector.');
    const note = resolveNote(notes, selector);
    await openNote(page, note);
    const result = { ...noteMetadata(note), content: await readEditorContent(page) };
    if (options.json) writeJson(result);
    else process.stdout.write(result.content.endsWith('\n') ? result.content : `${result.content}\n`);
  });
}

async function mutationCommand(action, args, options) {
  const content = action === 'delete' ? null : applyTitle(await readMarkdownFile(options.file), options.title);
  return withBrowser(browserOptions(options), async ({ page }) => {
    await openOverview(page);
    const notes = await fetchOverview(page);

    if (action === 'create') {
      const saved = await createNote(page, content);
      const result = { action: 'created', note: noteMetadata(saved), verified: 'saved revision and reloaded Markdown matched', access: 'website UI' };
      if (options.json) writeJson(result);
      else console.log(`Created: ${result.note.title}\n${result.note.url}\nVerified: ${result.verified}`);
      return;
    }

    const selector = args.join(' ').trim();
    if (!selector) throw new CliError(`notes ${action} requires a selector.`);
    const original = resolveNote(notes, selector);

    if (action === 'update') {
      const saved = await updateNote(page, original, content);
      const result = { action: 'updated', note: noteMetadata(saved), verified: 'saved revision and reloaded Markdown matched', access: 'website UI' };
      if (options.json) writeJson(result);
      else console.log(`Updated: ${result.note.title}\n${result.note.url}\nVerified: ${result.verified}`);
      return;
    }

    if (!options.yes) {
      throw new CliError(`Refusing to delete without --yes. Resolved note: ${original.title} (${original.shortId || original.id})`, 2);
    }
    const deleted = await deleteNote(page, original);
    const result = { action: 'deleted', note: deleted, verified: 'absent from active-note overview', access: 'website UI', recovery: 'HackMD Trash' };
    if (options.json) writeJson(result);
    else console.log(`Moved to Trash: ${deleted.title}\nVerified: ${result.verified}`);
  });
}

export async function main(argv) {
  const { options, positionals } = parseCommandLine(argv);
  if (options.version) {
    console.log(VERSION);
    return;
  }
  if (options.help || positionals.length === 0) {
    console.log(HELP);
    return;
  }

  const [group, subcommand, ...rest] = positionals;
  if (group === 'login') return loginCommand(options);
  if (group === 'status') return statusCommand(options);
  if (group === 'auth' && subcommand === 'import') return importCookiesCommand(options);

  const directActions = new Set(['list', 'search', 'get', 'create', 'update', 'delete']);
  const action = group === 'notes' ? subcommand : directActions.has(group) ? group : null;
  const args = group === 'notes' ? rest : [subcommand, ...rest].filter(Boolean);
  if (!action) throw new CliError(`Unknown command.\n\n${HELP}`, 2);
  if (['list', 'search', 'get'].includes(action)) return readCommand(action, args, options);
  return mutationCommand(action, args, options);
}
