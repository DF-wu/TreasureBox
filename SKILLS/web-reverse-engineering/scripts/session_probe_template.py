#!/usr/bin/env python3
"""
Read-only authenticated-session probe.

Inject a manually-exported session cookie into Camoufox, pass Cloudflare once, then map a
CF-gated SPA's API via in-page fetch (same-origin -> carries cookies + CF clearance) plus
JS-chunk grep. GET-only: safe to run without triggering writes / consuming quotas.

See references/authenticated-session-mapping.md for the full playbook.

Usage:
    1. Export the target's cookies (Cookie-Editor JSON) to cookies.json
    2. Edit BASE / DASHBOARD / CANDIDATE_GETS / PAGES below
    3. python session_probe_template.py cookies.json
"""
import asyncio
import json
import re
import sys
from urllib.parse import urljoin

BASE = "https://example.com"
DASHBOARD = f"{BASE}/dashboard"
# Login-check endpoint: NextAuth/Auth.js -> /api/auth/session ; Discourse -> /session/current.json
SESSION_CHECK = f"{BASE}/api/auth/session"
# Candidate API endpoints to GET (old + guessed-new). Read-only only.
CANDIDATE_GETS = [
    "/api/auth/session", "/api/user/info",
    "/api/checkin/status", "/api/dashboard/stats",
]
# SPA page routes whose JS chunks we grep for real /api/ literals + data-model field names.
PAGES = ["/dashboard"]


def normalize(raw: dict) -> dict | None:
    """Browser-export cookie -> Playwright add_cookies format. Ignores hostOnly/session/storeId."""
    if not raw.get("name") or raw.get("value") is None or not raw.get("domain"):
        return None
    c = {
        "name": str(raw["name"]), "value": str(raw["value"]), "domain": str(raw["domain"]),
        "path": str(raw.get("path") or "/"),
        "secure": bool(raw.get("secure", False)), "httpOnly": bool(raw.get("httpOnly", False)),
    }
    exp = raw.get("expires", raw.get("expirationDate"))
    if exp is not None:
        try:
            c["expires"] = float(exp)
        except (TypeError, ValueError):
            pass
    ss = raw.get("sameSite")
    if ss is not None:
        c["sameSite"] = {"lax": "Lax", "strict": "Strict", "none": "None",
                         "no_restriction": "None"}.get(str(ss).lower(), ss)
    return c


IN_PAGE_FETCH = """async ({m, u, h, b}) => {
    const opts = {method: m, headers: h || {}, credentials: 'include'};
    if (m !== 'GET' && b != null) opts.body = b;
    const r = await fetch(u, opts);
    const t = await r.text();
    return {status: r.status, text: t, ct: r.headers.get('content-type') || ''};
}"""


async def req(page, url, method="GET", headers=None, body=None):
    return await page.evaluate(IN_PAGE_FETCH, {"m": method, "u": url, "h": headers, "b": body})


async def main(cookie_file: str) -> int:
    from camoufox.async_api import AsyncCamoufox

    raw = json.loads(open(cookie_file, encoding="utf-8").read())
    cookies = [c for c in (normalize(r) for r in raw) if c]
    print(f"injecting {len(cookies)} cookies: {[c['name'] for c in cookies]}")

    async with AsyncCamoufox(headless="virtual", humanize=True) as browser:
        ctx = await browser.new_context()
        await ctx.add_cookies(cookies)
        page = await ctx.new_page()

        await page.goto(DASHBOARD, wait_until="domcontentloaded", timeout=45000)
        await page.wait_for_timeout(6000)  # let any CF interstitial clear
        print(f"url={page.url} title={await page.title()!r}")

        print("\n== session check ==")
        print(await req(page, SESSION_CHECK))

        print("\n== candidate GETs ==")
        for path in CANDIDATE_GETS:
            r = await req(page, f"{BASE}{path}")
            print(f"  {path:42} -> {r['status']} [{r['ct'][:24]}] {r['text'][:160]!r}")

        print("\n== JS-chunk grep for real /api/ endpoints ==")
        seen: set[str] = set()
        for pp in PAGES:
            html = (await req(page, f"{BASE}{pp}"))["text"]
            chunks = sorted(set(re.findall(r'/_next/static/[^"\'<>\s]+?\.js', html)))
            for cp in chunks[:80]:
                js = (await req(page, urljoin(BASE, cp)))["text"]
                seen |= set(re.findall(r'["\'`](/api/[a-zA-Z0-9/_\-]+)["\'`]', js))
        for a in sorted(seen):
            print(f"  {a}")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main(sys.argv[1] if len(sys.argv) > 1 else "cookies.json")))
