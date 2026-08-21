import { CliError } from './errors.js';

export const BASE_URL = 'https://hackmd.io';

export async function request(jar, input, options = {}, redirects = 5) {
  const url = new URL(input, BASE_URL);
  if (url.origin !== BASE_URL) throw new CliError(`Refusing request outside ${BASE_URL}.`);
  const headers = new Headers(options.headers);
  const cookie = jar.header(url);
  if (cookie) headers.set('Cookie', cookie);
  headers.set('Accept', headers.get('Accept') || 'application/json');
  headers.set('User-Agent', headers.get('User-Agent') || 'hackmd-rt/2.0');
  const response = await fetch(url, { ...options, headers, redirect: 'manual' });
  jar.absorb(response.headers, url);
  if (response.status >= 300 && response.status < 400 && redirects > 0) {
    const location = response.headers.get('location');
    if (!location) return response;
    const next = new URL(location, url);
    if (next.origin !== BASE_URL) throw new CliError(`Refusing redirect outside ${BASE_URL}.`);
    return request(jar, next, { method: 'GET', headers: { Accept: headers.get('Accept') } }, redirects - 1);
  }
  return response;
}

export async function fetchOverview(jar) {
  const response = await request(jar, `/api/overview?v=${Date.now()}`);
  const contentType = response.headers.get('content-type') || '';
  if (!response.ok || !contentType.includes('application/json')) {
    throw new CliError('HackMD session is not authenticated or the overview response changed.', 3);
  }
  const value = await response.json();
  if (!Array.isArray(value)) throw new CliError('HackMD overview did not return a note array.', 3);
  return value;
}

export async function realtimeServer(jar, noteId) {
  const noteResponse = await request(jar, `/${encodeURIComponent(noteId)}`, { headers: { Accept: 'text/html' } });
  if (!noteResponse.ok) throw new CliError(`Could not open note ${noteId}: HTTP ${noteResponse.status}.`);
  const html = await noteResponse.text();
  const register = html.match(/<meta\s+name=["']realtime-register-serverurl["']\s+content=["']([^"']+)/i)?.[1]
    || html.match(/<meta\s+content=["']([^"']+)["']\s+name=["']realtime-register-serverurl["']/i)?.[1];
  if (!register) throw new CliError('HackMD editor no longer advertises a realtime registration endpoint.');
  const endpoint = new URL(`${register.replace(/\/$/, '')}/realtime`);
  if (endpoint.origin !== BASE_URL) throw new CliError('Refusing an unexpected realtime registration origin.');
  endpoint.searchParams.set('noteId', noteId);
  const response = await request(jar, endpoint);
  if (!response.ok) throw new CliError(`Realtime registration failed: HTTP ${response.status}.`);
  const data = await response.json();
  const server = new URL(data.url);
  if (server.protocol !== 'https:') throw new CliError('Realtime registration returned a non-HTTPS server.');
  return { server, editorHtml: html };
}

export function csrfFromNewPage(html) {
  const token = html.match(/xhr\.send\('_csrf=([^']+)'\)/)?.[1];
  if (!token) throw new CliError('HackMD new-note page no longer exposes the expected CSRF submission.');
  return token;
}

export async function createEmptyNote(jar, title = '') {
  const page = await request(jar, '/new', { headers: { Accept: 'text/html' } });
  if (!page.ok) throw new CliError(`Could not prepare a new note: HTTP ${page.status}.`);
  const csrf = csrfFromNewPage(await page.text());
  const url = new URL('/new', BASE_URL);
  url.searchParams.set('title', title);
  url.searchParams.set('alias', 'false');
  url.searchParams.set('sync', '');
  url.searchParams.set('type', '');
  let response;
  try {
    response = await request(jar, url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'text/html' },
      body: new URLSearchParams({ _csrf: csrf }).toString()
    }, 0);
  } catch (error) {
    throw new CliError(
      `The create request outcome is unknown (${error.message}). Inspect recent HackMD notes before retrying.`,
      5,
      { mayHaveCreated: true }
    );
  }
  if (response.status < 300 || response.status >= 400) {
    throw new CliError(`HackMD did not create a note: HTTP ${response.status}.`);
  }
  const location = response.headers.get('location');
  if (!location) throw new CliError('HackMD created a note without returning its URL.');
  const noteUrl = new URL(location, BASE_URL);
  if (noteUrl.origin !== BASE_URL) throw new CliError('HackMD returned an unexpected note origin.');
  const noteId = decodeURIComponent(noteUrl.pathname.split('/').filter(Boolean).at(-1) || '');
  if (!noteId) throw new CliError('Could not determine the new note ID.');
  return { noteId, url: noteUrl.toString() };
}
