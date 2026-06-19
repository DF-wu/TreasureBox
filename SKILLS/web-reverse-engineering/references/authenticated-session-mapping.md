# Authenticated Session Mapping

> Map and reproduce a **logged-in, CF-gated SPA API** by injecting a real session instead of
> re-implementing the login/OAuth/CAPTCHA dance. This is the fastest way to reverse a site that
> sits behind both Cloudflare *and* an auth wall (dashboards, member areas, checkin/reward systems).

## When to use

- The data/action you want is behind a login **and** Cloudflare/Turnstile.
- The site is a modern SPA (Next.js/Nuxt/React) where the *page routes* are not the *API*.
- The login is expensive or flaky to automate (OAuth redirects, Turnstile loops, MFA).
- The site changed and you don't know the new flow/endpoints yet.

Core idea: **a valid session cookie is a skeleton key.** Log in once by hand, export the cookies,
inject them into a stealth browser, and drive the site's own same-origin `fetch` to enumerate the
API — read-only — without ever solving the login.

## Playbook

1. **Acquire a session manually.** Log into the target in a normal browser; export cookies with a
   Cookie-Editor extension (JSON). You need the session cookie(s); ignore analytics junk.
2. **Inject into a stealth browser.** Start Camoufox/Patchright, `new_context`, `add_cookies(...)`,
   then `goto(dashboard_url)` and pass CF once (real top-level navigation runs the CF JS).
3. **Confirm you're logged in.** Hit the framework's session endpoint (e.g. `/api/auth/session`,
   `/session/current.json`, `/api/user/info`). A real user object = the session is live.
4. **Enumerate the API read-only.** Use **in-page `fetch`** (see below) to GET a batch of candidate
   endpoints; print status + body snippet. Probe both old and guessed-new paths.
5. **Mine the JS bundles for the real endpoints + data model.** Grep `/_next/static/*.js` (or the
   SPA's chunks) for `"/api/..."` string literals and field names. The page route ≠ the API route.
6. **Stay read-only during recon.** GET + grep only. Do **not** POST state-changing actions (don't
   consume quotas / trigger writes) until you understand the contract. Don't blindly click DOM
   buttons either — greedy text matching misclicks (a "立即…" match once triggered a donation).
7. **Reproduce.** Once mapped, either keep driving via the browser (if CF-gated) or replay with
   `curl_cffi` reusing the cookies (if the API tolerates non-browser clients).

## The key trick: in-page `fetch` to pass same-origin CF

`context.request` (Playwright APIRequestContext) and `curl_cffi` inherit cookies but **do not run
Cloudflare's JS** → they behave like curl-with-cookies and get 403 on gated endpoints. A `fetch()`
executed **inside the page** runs in the real browser origin and passes CF exactly like the site's
own AJAX.

```python
# Run HTTP from inside the page; same-origin, carries cookies + CF clearance.
async def in_page_get(page, url: str, headers: dict | None = None):
    return await page.evaluate(
        """async ({u, h}) => {
            const r = await fetch(u, {headers: h || {}, credentials: 'include'});
            const t = await r.text();
            return {status: r.status, body: t.slice(0, 2000),
                    ct: r.headers.get('content-type') || ''};
        }""",
        {"u": url, "h": headers},
    )
# Caller must first page.goto() a same-origin page so cookies + CF clearance apply.
```

For POST, pass `{method:'POST', body: JSON.stringify(payload), headers:{'Content-Type':'application/json'}}`.

## SPA frontend route ≠ backend API

Next.js/Nuxt routes like `/gas-station/checkin` are **client-side pages**; the real call is a
`fetch("/api/...")` inside a JS chunk. Don't assume the URL bar path maps to an endpoint.

```python
import re
html = (await in_page_get(page, f"{BASE}/some/page"))["body"]  # use full text, not the 2KB slice
chunks = sorted(set(re.findall(r'/_next/static/[^"\'<>\s]+?\.js', html)))
api = set()
for cp in chunks:
    js = (await in_page_get(page, BASE + cp))["body"]
    api |= set(re.findall(r'["\'`](/api/[a-zA-Z0-9/_\-]+)["\'`]', js))
    # also grep field names to learn the data model: hasCheckedToday, capRequired, remaining, ...
```

Real result from one site: the page moved to `/gas-station/checkin`, but the backend was still
`POST /api/checkin` — only a frontend rename. Chunk-grep caught it in seconds; guessing would not.

## Auth-framework fingerprinting (cookie names tell you the version)

Cookie names leak the framework + major version. When a site "changes", diff the cookie names first
— a rename often means a framework upgrade with the **same endpoints**.

| Framework | Session cookie | Other cookies | Verify-login endpoint |
|---|---|---|---|
| NextAuth v4 | `next-auth.session-token` | `next-auth.csrf-token` | `/api/auth/session` |
| **Auth.js v5** (next-auth v5) | `__Secure-authjs.session-token` | `__Host-authjs.csrf-token`, `__Secure-authjs.callback-url` | `/api/auth/session` |
| Discourse | `_t` (persistent), `_forum_session` | — | `/session/current.json` (200=auth, 404=anon) |
| Laravel | `laravel_session`, `XSRF-TOKEN` | — | app-specific |
| Rails | `_<app>_session` | `CSRF-Token` | app-specific |

Observed migration: NextAuth v4 → Auth.js v5 renamed `next-auth.*` → `authjs.*` (with
`__Secure-`/`__Host-` prefixes in production) but kept `/api/auth/signin/{provider}`, `/api/auth/csrf`,
`/api/auth/providers`. Code fix was just: accept the new cookie name + update one status field.

## Isolate "stale credentials" from "code bug" (do this FIRST)

A failing authed flow is *usually* dead cookies, not broken code. Before touching code, verify the
session at its source by injecting the cookies and hitting the provider's own login-check endpoint:

- Discourse: `GET /session/current.json` → **200 + `current_user`** = valid; **404** = not logged in.
- NextAuth/Auth.js: `GET /api/auth/session` → user object vs `{}`/`null`.

If the check says "anonymous", stop — the fix is *re-export cookies*, not a code change. This one
check turns "x666 is broken, rewrite it" into "x666 is fine, the `_t` cookie expired."

## Stateless sessions (JWT/JWE) survive independent of the OAuth upstream

If the session cookie is a JWT (`eyJ...`, 3 dot-segments) or JWE (5 dot-segments), the session is
**self-contained and server-validates without the upstream IdP**. It stays valid for its TTL (often
days–weeks) even if the OAuth provider's own cookies die. Implication:

- You can inject just that token and stay logged in for the whole TTL — no re-login per run.
- Decode the JWT header/payload (`base64url`) to read `exp`; the `/api/auth/session` response often
  echoes an `expires` timestamp.
- Production pattern (hybrid): **inject the stored session → if `/api/auth/session` returns a user,
  skip OAuth entirely; only fall back to the full login when the token is dead.** Robust against both
  Turnstile flakiness and upstream-credential expiry.

## Read-only recon discipline & pitfalls

- GET + chunk-grep only until the contract is understood; never POST writes during mapping.
- Don't consume one-shot/daily resources (checkins, draws, votes) while probing.
- Avoid greedy DOM clicking — match button text precisely; an over-broad match navigates away.
- Keep the probe idempotent and re-runnable; print everything (status, content-type, body snippet).
- Treat exported session files as **secrets** — delete throwaway cookie dumps after use.

## Productionizing

- Persist the session (`storage_state`) and refresh-on-rotation ("keep-warm") so the next run starts
  from the freshest cookies.
- Prefer the injected-session short-circuit; reserve the heavy OAuth/Turnstile path for cold starts.
- Schema-validate responses; sites silently change field names (e.g. `checked_in` →
  `checkinStatus.hasCheckedToday`). Log a diff when the shape drifts.

See `scripts/session_probe_template.py` for a runnable read-only probe (Camoufox + in-page fetch +
chunk grep).
