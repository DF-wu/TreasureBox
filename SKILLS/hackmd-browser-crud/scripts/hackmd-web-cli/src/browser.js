import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { BASE_URL, CliError, noteMetadata, resolveNote } from './core.js';

const OVERVIEW_URL = `${BASE_URL}/?nav=overview`;

export function defaultProfilePath() {
  if (process.env.HACKMD_WEB_PROFILE) return path.resolve(process.env.HACKMD_WEB_PROFILE);
  if (process.platform === 'win32') {
    return path.join(process.env.LOCALAPPDATA || os.homedir(), 'hackmd-web-cli', 'profile');
  }
  return path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'hackmd-web-cli', 'profile');
}

export function findBrowserExecutable(explicitPath) {
  const candidates = [
    explicitPath,
    process.env.HACKMD_WEB_BROWSER,
    process.platform === 'win32' && path.join(process.env.PROGRAMFILES || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    process.platform === 'win32' && path.join(process.env['PROGRAMFILES(X86)'] || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    process.platform === 'win32' && path.join(process.env.PROGRAMFILES || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    process.platform === 'darwin' && '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    process.platform === 'darwin' && '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    process.platform === 'linux' && '/usr/bin/google-chrome',
    process.platform === 'linux' && '/usr/bin/microsoft-edge',
    process.platform === 'linux' && '/usr/bin/chromium'
  ].filter(Boolean);
  const match = candidates.find((candidate) => fs.existsSync(candidate));
  if (!match) {
    throw new CliError('Chrome or Edge was not found. Set HACKMD_WEB_BROWSER to the browser executable path.');
  }
  return match;
}

export async function withBrowser(options, callback) {
  const profile = path.resolve(options.profile || defaultProfilePath());
  await fs.promises.mkdir(profile, { recursive: true });
  const executablePath = findBrowserExecutable(options.browser);
  let context;
  try {
    context = await chromium.launchPersistentContext(profile, {
      executablePath,
      headless: !options.headed,
      locale: 'zh-TW',
      viewport: { width: 1280, height: 900 }
    });
  } catch (error) {
    throw new CliError(`Could not open the persistent browser profile. Close another hackmd-web process and retry. (${error.message})`);
  }

  try {
    const pages = context.pages();
    const page = pages[0] || await context.newPage();
    return await callback({ context, page, profile, executablePath });
  } finally {
    await context.close();
  }
}

export async function openOverview(page) {
  await page.goto(OVERVIEW_URL, { waitUntil: 'domcontentloaded', timeout: 45_000 });
  await page.waitForTimeout(750);
}

export async function fetchOverview(page) {
  const result = await page.evaluate(async () => {
    try {
      const response = await fetch(`/api/overview?v=${Date.now()}`, {
        credentials: 'same-origin',
        headers: { Accept: 'application/json' }
      });
      const contentType = response.headers.get('content-type') || '';
      if (!response.ok || !contentType.includes('application/json')) {
        return { ok: false, status: response.status, contentType };
      }
      const data = await response.json();
      return { ok: Array.isArray(data), status: response.status, data };
    } catch (error) {
      return { ok: false, status: 0, error: error.message };
    }
  });
  if (!result.ok || !Array.isArray(result.data)) {
    throw new CliError('HackMD session is not authenticated or the website response changed. Run `hackmd-web login` or import cookies again.', 3);
  }
  return result.data;
}

function findNoteById(notes, identifier) {
  return notes.find((note) => note.shortId === identifier || note.id === identifier) || null;
}

export async function waitForNoteVisible(page, identifier, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const notes = await fetchOverview(page);
      const note = findNoteById(notes, identifier);
      if (note) return note;
    } catch {
      // The editor can briefly navigate while its session is being established.
    }
    await page.waitForTimeout(750);
  }
  throw new CliError('The newly created note did not appear in the HackMD overview.');
}

export async function waitForMetadataChange(page, identifier, previousLastChange, timeoutMs = 35_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const note = findNoteById(await fetchOverview(page), identifier);
      if (note && note.lastchangeAt !== previousLastChange) return note;
    } catch {
      // Retry while the collaboration session settles.
    }
    await page.waitForTimeout(900);
  }
  throw new CliError(`HackMD did not report a saved revision within ${Math.ceil(timeoutMs / 1000)} seconds.`);
}

export async function waitForNoteAbsent(page, shortId, timeoutMs = 25_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const notes = await fetchOverview(page);
      if (!notes.some((note) => note.shortId === shortId || note.id === shortId)) return;
    } catch {
      // Retry while HackMD redirects back to the overview.
    }
    await page.waitForTimeout(750);
  }
  throw new CliError('The note still appears in the active-note overview after deletion.');
}

async function clickFirstVisible(locators, description) {
  for (const locator of locators) {
    const count = await locator.count();
    for (let index = 0; index < count; index += 1) {
      const item = locator.nth(index);
      if (await item.isVisible().catch(() => false)) {
        await item.click();
        return;
      }
    }
  }
  throw new CliError(`HackMD UI changed: could not find ${description}.`);
}

export function shortIdFromPage(page) {
  const url = new URL(page.url());
  const segments = url.pathname.split('/').filter(Boolean);
  const shortId = segments.at(-1);
  if (!shortId || ['zh', 'new'].includes(shortId)) throw new CliError(`Could not determine the note ID from ${page.url()}.`);
  return shortId;
}

export async function openNote(page, note) {
  const shortId = note.shortId || note.id;
  if (!shortId) throw new CliError('Resolved note has no usable ID.');
  await page.goto(`${BASE_URL}/${shortId}`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
  await page.waitForTimeout(1_000);
  const finalId = shortIdFromPage(page);
  if (![note.shortId, note.id].filter(Boolean).includes(finalId)) {
    throw new CliError('HackMD redirected away from the requested note.');
  }
}

export async function readEditorContent(page) {
  const editorSurface = page.locator('.CodeMirror').first();
  await editorSurface.waitFor({ state: 'attached', timeout: 15_000 });
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const value = await editorSurface.evaluate((element) => element.CodeMirror?.getValue?.()).catch(() => undefined);
    if (typeof value === 'string') return value;
    await page.waitForTimeout(300);
  }
  throw new CliError('HackMD UI changed: exact Markdown source was unavailable.');
}

async function reloadAndVerifyContent(page, expectedContent) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page.waitForTimeout(1_000);
    if (await readEditorContent(page) === expectedContent) return;
    await page.waitForTimeout(1_500);
  }
  throw new CliError('HackMD reported a saved revision, but reloading did not reproduce the exact Markdown.');
}

export async function fillEditor(page, content) {
  await clickFirstVisible([
    page.locator('label.ui-edit'),
    page.locator('[aria-label="編輯"]'),
    page.locator('[aria-label="Edit"]')
  ], 'edit mode');

  const editorSurface = page.locator('.CodeMirror').first();
  await editorSurface.waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {});
  if (!await editorSurface.isVisible().catch(() => false)) {
    throw new CliError('HackMD UI changed: could not find the visible Markdown editor.');
  }

  await page.waitForTimeout(750);
  await editorSurface.click({ position: { x: 80, y: 60 } });
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
  await page.keyboard.insertText(content);

  const editorValue = await editorSurface.evaluate((element) => element.CodeMirror?.getValue?.());
  if (editorValue !== content) {
    throw new CliError('The Markdown editor did not accept the complete input; no success was reported.');
  }
}

export async function createNote(page, content) {
  await openOverview(page);
  await fetchOverview(page);
  await clickFirstVisible([
    page.getByRole('button', { name: /^(建立我的筆記|Create my note|Create note|New note)$/i }),
    page.getByRole('link', { name: /^(建立筆記|Create note|New note)$/i })
  ], 'the create-note control');

  await page.waitForURL((url) => url.hostname === 'hackmd.io' && url.pathname.split('/').filter(Boolean).length === 1, { timeout: 30_000 });
  await page.waitForTimeout(1_000);
  const shortId = shortIdFromPage(page);
  const initial = await waitForNoteVisible(page, shortId);
  await fillEditor(page, content);
  const saved = await waitForMetadataChange(page, shortId, initial.lastchangeAt);
  await reloadAndVerifyContent(page, content);
  return saved;
}

export async function updateNote(page, originalNote, content) {
  await openNote(page, originalNote);
  const freshNotes = await fetchOverview(page);
  const fresh = resolveNote(freshNotes, originalNote.shortId || originalNote.id);
  if (fresh.lastchangeAt !== originalNote.lastchangeAt) {
    throw new CliError('The note changed after it was read. Refusing to overwrite a concurrent edit.', 4);
  }
  const currentContent = await readEditorContent(page);
  if (currentContent === content) return fresh;
  await fillEditor(page, content);
  const saved = await waitForMetadataChange(page, originalNote.shortId || originalNote.id, fresh.lastchangeAt);
  await reloadAndVerifyContent(page, content);
  return saved;
}

export async function deleteNote(page, note) {
  await openNote(page, note);
  await clickFirstVisible([
    page.getByRole('listitem', { name: /^(選單|Menu)$/i }),
    page.getByRole('button', { name: /^(選單|Menu)$/i })
  ], 'the note menu');
  await clickFirstVisible([
    page.getByRole('menuitem', { name: /(刪除此筆記|Delete this note|Delete note)/i })
  ], 'the delete-note menu item');

  const dialog = page.getByRole('dialog');
  await dialog.waitFor({ state: 'visible', timeout: 10_000 });
  await clickFirstVisible([
    dialog.getByRole('button', { name: /^(刪除|Delete)$/i })
  ], 'the delete confirmation button');
  await page.waitForTimeout(750);
  await waitForNoteAbsent(page, note.shortId || note.id);
  return noteMetadata(note);
}
