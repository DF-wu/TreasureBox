---
name: web-reverse-engineering
description: "Universal reverse-engineering guide covering web scraping, API RE, mobile app RE (Android/iOS), JavaScript deobfuscation, protocol analysis (WebSocket/gRPC/custom TCP), and binary RE (WASM, native libraries, desktop apps). Use when you need browser automation, anti-bot evasion, proxy strategy, CAPTCHA handling, authenticated/logged-in API mapping via session-cookie injection (CF-gated SPAs, dashboards, checkin/reward systems), traffic interception, or large-scale extraction. Covers curl_cffi/hrequests/rnet, Playwright/Patchright/Camoufox/rebrowser/DrissionPage, Scrapy/Crawlee/Colly/Rod, Frida/objection/jadx, Ghidra/radare2, mitmproxy/Wireshark, Cloudflare/Akamai/DataDome/Kasada patterns, legal frameworks, and production runbooks."
---

# Web Reverse Engineering (Universal)

This skill covers web scraping, API reverse engineering, mobile app RE, protocol analysis, JavaScript deobfuscation, and binary reverse engineering. It is framework-agnostic and designed for:
- human engineers
- AI coding agents
- Python/Node/Go/Rust automation stacks

The focus is practical: choose the minimum-complexity approach that still works under target defenses. Escalate through layers—HTTP → Browser → Mobile → Binary—only when the layer above fails.

## Operating Principles

1. Start cheap, escalate only when blocked.
2. Keep fingerprints consistent (UA, TLS, locale, timezone, IP geo).
3. Prefer API extraction over DOM scraping whenever possible.
4. Use prevention-first anti-bot strategy; CAPTCHA solving is last resort.
5. Understand legal context and risk boundaries. Platform terms are contractual signals, not criminal law.
6. Behind an auth wall? Inject a real (manually-exported) session before re-implementing login — and verify the session at its source before assuming a code bug. Stale credentials masquerade as broken code.

## Fast Decision Tree

```text
Target -> What is required?

1) Public JSON/API exists?
   -> Use API reverse engineering flow first.

2) Static HTML, no JS dependency?
   -> requests/httpx (baseline) or curl_cffi/hrequests (if blocked).

3) JS-rendered site with low bot pressure?
   -> Playwright (or Selenium) + sane pacing.

4) Bot defenses triggered (Cloudflare/DataDome/Akamai)?
   -> Patchright/rebrowser/Camoufox + residential/ISP proxies + behavior model.

5) Turnstile/hCaptcha/FunCaptcha appears repeatedly?
   -> Fix fingerprint + proxy reputation first, then selective CAPTCHA solving.

6) Need >100k pages/day reliability?
   -> Scrapy/Crawlee + queue + rotating proxy pool + observability.

7) Target is a mobile app?
   -> mitmproxy + Frida/objection → SSL pinning bypass → API extraction.

8) JS challenge scripts are obfuscated?
   -> Babel AST transforms → dynamic hooking → algorithm extraction.

9) Protocol is WebSocket/gRPC/custom TCP?
   -> Traffic capture → framing analysis → minimal client reproduction.

10) Security logic is in native binary (.so, .exe, .wasm)?
    -> Strings/imports scan → Ghidra/radare2 → dynamic hooking → reimplementation.

11) Target is a HuggingFace Space / Gradio app?
    -> Check /config for endpoints → map component IDs to fn params → reproduce via REST/WS/SSE (see Gradio Space playbook below).

12) Data/action is behind login AND Cloudflare (member dashboard, checkin/rewards)?
    -> Inject a manually-exported session → drive in-page fetch to map the API read-only
       (see Authenticated Session Mapping playbook below). Don't re-implement the login first.
```

## Common Playbooks

### A) "I only need a few fields from one page"
1. Inspect Network panel for JSON-LD or XHR.
2. If present, parse structured JSON directly.
3. If absent, CSS/XPath extraction with robust selectors.

### B) "Cloudflare blocks my Python requests"
1. Switch to curl_cffi impersonation.
2. Align headers + TLS profile + proxy geo.
3. Add jitter/backoff.
4. Escalate to browser with stealth patches if still blocked.

### C) "Need production crawler"
1. Framework: Scrapy (Py) or Crawlee (Node).
2. Externalize proxy pool and health scoring.
3. Add retries, circuit breakers, dead-letter queue.
4. Store raw + parsed + trace metadata for replay.

### D) "Wrap a Gradio/HF Space into a production API"

Gradio Spaces expose different API protocols depending on version. The `/config` endpoint reveals everything.

**Step 1: Fetch and parse config**
```bash
curl -s https://{space}.hf.space/config | python3 -c "import json,sys; d=json.load(sys.stdin); print(json.dumps({c['id']:c['type'] for c in d['components']}, indent=2))"
```

**Step 2: Determine protocol**

| Protocol | Gradio | Endpoint | When |
|----------|--------|----------|------|
| **REST named** | 3.x | `/api/{api_name}/` POST | `api_name` set in app.py |
| **REST unnamed** | 3.x | `/api/predict/` POST | No api_name |
| **WebSocket** | 3.x | `/queue/join` | Queue enabled |
| **SSE** | 4+ | `/gradio_api/call/{fn}` | Newer Spaces |

**Step 3: Map parameters**
Config `dependencies` array maps components to function params. Dropdowns with `type="index"` send the INDEX integer via REST but the LABEL string via WebSocket — test both.

**Step 4: Handle output formats**
- Audio: check `app.py` for `gr.Audio.postprocess` monkeypatch (may return base64 data URI instead of file path)
- File download: `{base_url}/file={path}` (3.x) or `{base_url}/gradio_api/file={path}` (4+)
- File upload: `{base_url}/upload` (3.x) or `{base_url}/gradio_api/upload` (4+)

**Step 5: Build resolution layer**
Gradio dropdown choices rarely match user-facing names. Build multi-layer fallback:
```
exact match → prefix match → alias table → case-insensitive → substring
```
Extract all choices from config component `choices` array for the map.

**Step 6: Add fallback**
If the Space has mirrors (forked Spaces), add REST primary + WebSocket fallback with different text limits. Truncate before fallback call.

**Real example (hf2api VITS)**:
- Discovered via `app.py`: `api_name="generate"`, `concurrency_count=1`
- REST endpoint: `POST /api/generate/` with `{"data": [text, lang, speaker_id, ns, nsw, ls]}`
- Response: `{"data": ["成功", "/file=/tmp/gradio/x.wav", "耗时 2.34s"]}`
- Download: `GET /file=/tmp/gradio/x.wav` → audio bytes
- Fallback: WebSocket `/queue/join` on forked Space with 100-char limit

### E) "Map a logged-in, Cloudflare-gated SPA (dashboard/checkin/rewards)"

A valid session cookie is a skeleton key — use it to map the authed API instead of re-implementing the login.

1. **Log in by hand once**, export cookies (Cookie-Editor JSON). Keep the session cookie(s).
2. **Inject** into a stealth browser (`add_cookies`) → `goto(dashboard)` → pass CF once (real top-level nav runs CF JS).
3. **Confirm auth** via the framework's session endpoint (`/api/auth/session`, `/session/current.json`).
4. **Enumerate read-only** with **in-page `fetch`** — `page.evaluate(() => fetch(u,{credentials:'include'}))` runs in the real origin and passes CF; `context.request`/curl_cffi do NOT run CF JS and get 403 on gated endpoints.
5. **Grep the JS bundles** (`/_next/static/*.js`) for `"/api/..."` literals + field names — the SPA page route (`/gas-station/checkin`) is NOT the API route (`/api/checkin`).
6. **Stay read-only** during recon: GET + grep only, never POST writes / consume quotas. Don't greedily click DOM buttons (broad text matches misclick).

Key sub-techniques:
- **Cookie names fingerprint the framework/version** — `next-auth.session-token` (NextAuth v4) vs `__Secure-authjs.session-token` (Auth.js v5). A rename usually means a framework upgrade with the SAME endpoints.
- **Isolate stale-credentials from code bugs FIRST** — inject cookies, hit the login-check endpoint (Discourse `/session/current.json`: 200=auth, 404=anon). "Broken" authed flows are usually dead cookies.
- **JWT/JWE sessions** (`eyJ...`) self-validate independent of the OAuth upstream → inject for the full TTL (days–weeks). Production hybrid: inject session → skip OAuth if valid, fall back to full login only on cold start.

See `references/authenticated-session-mapping.md` + `scripts/session_probe_template.py`.

## Anti-Bot Severity Ladder

| Level | Typical signals | Recommended baseline |
|---|---|---|
| L0 | No active bot stack | requests/httpx + throttling |
| L1 | IP/rate checks only | rotating proxies + retries |
| L2 | TLS/HTTP2 checks | curl_cffi/hrequests/rnet |
| L3 | JS + browser fingerprint | Playwright + stealth patching |
| L4 | behavior + challenge loops | Patchright/Camoufox + residential/ISP |
| L5 | enterprise bot manager | full stack + adaptive controls + fallback APIs |

## Verification Checklist (before scaling)

- bot detector pages are clean enough (webdriver/CDP leaks reduced)
- accept-language/timezone/proxy region are coherent
- request cadence resembles real user flows
- success rate and challenge rate are logged per target and per proxy ASN

## References

- `references/http-clients.md`
- `references/browser-automation.md`
- `references/anti-detection.md`
- `references/anti-bot-bypass.md`
- `references/scraping-frameworks.md`
- `references/proxy-strategies.md`
- `references/captcha-bypass.md`
- `references/api-reverse-engineering.md`
- `references/authenticated-session-mapping.md` — inject a real session to map a CF-gated SPA API (in-page fetch, SPA-route-vs-API, auth-cookie fingerprinting, credential-vs-code isolation)
- `references/data-extraction.md`
- `references/legal-ethical.md`
- `references/emerging-trends.md`
- `references/tool-alternatives.md` — replacement matrix for every layer
- `references/js-deobfuscation.md` — AST-based and dynamic analysis
- `references/mobile-reverse-engineering.md` — Android/iOS app RE
- `references/binary-native-reverse-engineering.md` — compiled binary analysis
- `references/protocol-reverse-engineering.md` — WebSocket, gRPC, custom TCP/UDP
- `references/gradio-space-reverse-engineering.md` — Gradio/HF Space API patterns (REST, WS, SSE; component mapping; audio output tricks; multi-upstream fallback)

## When to Escalate vs Stop

Escalate when:
- target is business-critical
- you have assessed actual legal exposure (not just ToS discomfort)
- expected value exceeds infra and maintenance cost

Stop when:
- you face active legal process (cease-and-desist, injunction, criminal inquiry)
- technical barriers indicate protected/ authenticated resources you genuinely cannot access without authorization
- equivalent licensed data source exists at lower total cost

Do not treat Terms of Service as a hard stop. In most jurisdictions, public data scraping does not constitute "unauthorized access" under criminal computer fraud statutes. Contractual disputes and criminal liability are different risk categories.
