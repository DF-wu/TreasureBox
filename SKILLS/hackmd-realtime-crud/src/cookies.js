import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { CliError } from './errors.js';

export function defaultCookiePath() {
  if (process.env.HACKMD_RT_COOKIES) return path.resolve(process.env.HACKMD_RT_COOKIES);
  const root = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  return path.join(root, 'hackmd-rt', 'cookies.json');
}

function normalizedDomain(value) {
  return String(value || '').trim().replace(/^\./, '').toLowerCase();
}

function domainMatches(cookie, hostname) {
  return cookie.hostOnly
    ? hostname === cookie.domain
    : hostname === cookie.domain || hostname.endsWith(`.${cookie.domain}`);
}

function pathMatches(cookiePath, requestPath) {
  const base = cookiePath || '/';
  return requestPath === base
    || requestPath.startsWith(base.endsWith('/') ? base : `${base}/`);
}

function normalizedSameSite(value) {
  const sameSite = String(value || '').toLowerCase().replace(/[ _-]/g, '');
  if (sameSite === 'strict') return 'Strict';
  if (sameSite === 'none' || sameSite === 'norestriction') return 'None';
  return 'Lax';
}

function booleanValue(value) {
  if (typeof value === 'boolean') return value;
  return /^(1|true|yes)$/i.test(String(value || ''));
}

function first(row, ...keys) {
  for (const key of keys) {
    if (row?.[key] !== undefined && row[key] !== null) return row[key];
  }
  return undefined;
}

export function normalizeCookieExport(value, now = Date.now()) {
  const rows = Array.isArray(value) ? value : value?.cookies;
  if (!Array.isArray(rows)) throw new CliError('Cookie export must be an array or {"cookies": [...]} object.');

  const cookies = [];
  let skipped = 0;
  for (const row of rows) {
    const name = String(first(row, 'name', 'Name raw') || '').trim();
    const rawDomain = String(first(row, 'domain', 'host', 'Host raw') || '').trim();
    const domain = normalizedDomain(rawDomain);
    const rawExpires = Number(first(row, 'expires', 'expirationDate', 'Expires raw'));
    const expires = Number.isFinite(rawExpires) && rawExpires > 0
      ? (rawExpires > 1e12 ? rawExpires : rawExpires * 1000)
      : null;
    if (!name || domain !== 'hackmd.io' || (expires !== null && expires <= now)) {
      skipped += 1;
      continue;
    }
    cookies.push({
      name,
      value: String(first(row, 'value', 'Content raw') ?? ''),
      domain,
      hostOnly: row.hostOnly === undefined ? !rawDomain.startsWith('.') : booleanValue(row.hostOnly),
      path: String(first(row, 'path', 'Path raw') || '/'),
      expires,
      httpOnly: booleanValue(first(row, 'httpOnly', 'HTTP only raw')),
      secure: booleanValue(first(row, 'secure', 'Send for raw')),
      sameSite: normalizedSameSite(first(row, 'sameSite', 'SameSite raw'))
    });
  }
  return { cookies, skipped };
}

function splitSetCookie(header) {
  if (!header) return [];
  return header.split(/,(?=\s*[^;,=]+=[^;,]*)/g);
}

function parseSetCookie(header, requestUrl) {
  const parts = header.split(';').map((part) => part.trim());
  const separator = parts[0]?.indexOf('=') ?? -1;
  if (separator <= 0) return null;
  const url = new URL(requestUrl);
  const cookie = {
    name: parts[0].slice(0, separator),
    value: parts[0].slice(separator + 1),
    domain: url.hostname,
    hostOnly: true,
    path: '/',
    expires: null,
    httpOnly: false,
    secure: false,
    sameSite: 'Lax'
  };
  for (const attribute of parts.slice(1)) {
    const index = attribute.indexOf('=');
    const key = (index < 0 ? attribute : attribute.slice(0, index)).toLowerCase();
    const value = index < 0 ? '' : attribute.slice(index + 1);
    if (key === 'domain') {
      cookie.domain = normalizedDomain(value);
      cookie.hostOnly = false;
    }
    else if (key === 'path') cookie.path = value || '/';
    else if (key === 'expires') cookie.expires = Date.parse(value) || null;
    else if (key === 'max-age') cookie.expires = Date.now() + Number(value) * 1000;
    else if (key === 'httponly') cookie.httpOnly = true;
    else if (key === 'secure') cookie.secure = true;
    else if (key === 'samesite') cookie.sameSite = normalizedSameSite(value);
  }
  return cookie;
}

export class CookieJar {
  constructor(cookies = []) {
    this.cookies = normalizeCookieExport(cookies).cookies;
  }

  static async load(file = defaultCookiePath()) {
    try {
      const parsed = JSON.parse(await fs.promises.readFile(file, 'utf8'));
      return new CookieJar(parsed);
    } catch (error) {
      if (error.code === 'ENOENT') return new CookieJar();
      throw new CliError(`Could not read cookie store ${file}: ${error.message}`);
    }
  }

  header(url, now = Date.now()) {
    const target = new URL(url);
    return this.cookies
      .filter((cookie) => domainMatches(cookie, target.hostname))
      .filter((cookie) => pathMatches(cookie.path, target.pathname))
      .filter((cookie) => cookie.expires === null || cookie.expires > now)
      .filter((cookie) => !cookie.secure || target.protocol === 'https:')
      .sort((left, right) => (right.path || '/').length - (left.path || '/').length)
      .map((cookie) => `${cookie.name}=${cookie.value}`)
      .join('; ');
  }

  absorb(headers, requestUrl) {
    const values = typeof headers.getSetCookie === 'function'
      ? headers.getSetCookie()
      : splitSetCookie(headers.get('set-cookie'));
    for (const value of values) {
      const incoming = parseSetCookie(value, requestUrl);
      if (!incoming || incoming.domain !== 'hackmd.io') continue;
      this.cookies = this.cookies.filter((cookie) => !(
        cookie.name === incoming.name && cookie.domain === incoming.domain && cookie.path === incoming.path
      ));
      if (incoming.expires === null || incoming.expires > Date.now()) this.cookies.push(incoming);
    }
  }

  async save(file = defaultCookiePath()) {
    await fs.promises.mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
    const temporary = `${file}.${process.pid}.tmp`;
    await fs.promises.writeFile(temporary, `${JSON.stringify({ cookies: this.cookies }, null, 2)}\n`, { mode: 0o600 });
    await fs.promises.rename(temporary, file);
    await fs.promises.chmod(file, 0o600);
  }
}

export async function importCookies(source, destination = defaultCookiePath(), clear = false) {
  let parsed;
  try {
    parsed = JSON.parse(await fs.promises.readFile(path.resolve(source), 'utf8'));
  } catch (error) {
    throw new CliError(`Could not read cookie export: ${error.message}`);
  }
  const imported = normalizeCookieExport(parsed);
  const jar = clear ? new CookieJar() : await CookieJar.load(destination);
  for (const cookie of imported.cookies) {
    jar.cookies = jar.cookies.filter((current) => !(
      current.name === cookie.name && current.domain === cookie.domain && current.path === cookie.path
    ));
    jar.cookies.push(cookie);
  }
  await jar.save(destination);
  return { imported: imported.cookies.length, skipped: imported.skipped, path: destination };
}
