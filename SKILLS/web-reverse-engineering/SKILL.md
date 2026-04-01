---
name: web-reverse-engineering
description: "Universal web reverse-engineering and scraping guide for any stack (human or agent). Use when you need browser automation, API reverse engineering, anti-bot evasion, proxy strategy, CAPTCHA handling, or large-scale extraction. Covers curl_cffi/hrequests/rnet, Playwright/Patchright/Camoufox/rebrowser, Scrapy/Crawlee, Cloudflare/Akamai/DataDome/Kasada patterns, legal constraints, and production runbooks."
---

# Web Reverse Engineering (Universal)

This skill is framework-agnostic. It is designed for:
- human engineers
- AI coding agents
- Python/Node/Go automation stacks

The focus is practical: choose the minimum-complexity approach that still works under target defenses.

## Operating Principles

1. Start cheap, escalate only when blocked.
2. Keep fingerprints consistent (UA, TLS, locale, timezone, IP geo).
3. Prefer API extraction over DOM scraping whenever possible.
4. Use prevention-first anti-bot strategy; CAPTCHA solving is last resort.
5. Respect legal boundaries and platform terms.

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
- `references/data-extraction.md`
- `references/legal-ethical.md`
- `references/emerging-trends.md`

## When to Escalate vs Stop

Escalate when:
- target is business-critical
- legal review is completed
- expected value exceeds infra and maintenance cost

Stop when:
- terms explicitly prohibit your use case and legal risk is high
- repeated bypass attempts increase operational or legal exposure
- equivalent licensed data source exists at reasonable cost
