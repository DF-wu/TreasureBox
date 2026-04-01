# Anti-Detection Fundamentals

Modern detection is multi-layer. Winning requires coherence across layers, not a single stealth plugin.

## Detection Surfaces

## 1) Network Layer

- TLS ClientHello and JA3/JA4 signatures
- HTTP/2 frame/order/settings fingerprints
- ASN reputation and IP history

Mitigation:
- use browser-like transport (`curl_cffi`, `hrequests`, `rnet`)
- rotate proxies by quality and ASN diversity
- keep headers and transport profile consistent

## 2) Browser Runtime Layer

- `navigator.webdriver` and automation artifacts
- CDP leaks (e.g., Runtime domain behavior)
- canvas/webgl/audio/font entropy mismatches
- plugin/device/screen inconsistencies

Mitigation:
- patched automation stacks (Patchright/rebrowser)
- anti-detect browser profiles where needed
- avoid impossible hardware/browser combinations

## 3) Behavioral Layer

- deterministic click/scroll timing
- no idle/reading behavior
- impossible interaction velocity

Mitigation:
- action pacing with jitter
- realistic dwell times near content blocks
- bounded retries and session-level memory

## Coherence Checklist

If any row is inconsistent, risk rises quickly.

| Signal | Must align with |
|---|---|
| IP geo | timezone, locale, language headers |
| Browser UA | TLS profile family |
| Device profile | screen size, hardware threads, memory hints |
| Session cookies | navigation flow and referrer chain |

## Fingerprint Validation Targets

Use these pages only for diagnostics, not as absolute pass/fail:
- `https://bot-detector.rebrowser.net`
- `https://tls.peet.ws`
- `https://bot.sannysoft.com`
- `https://abrahamjuliot.github.io/creepjs/`

## Practical Escalation

1. Start with transport-level impersonation and quality proxies.
2. If challenged, move to patched browser runtime.
3. If still challenged, improve behavior model and session continuity.
4. If still failing, decide if target should be handled by managed scraping APIs.

## Why Teams Still Fail

- They optimize one layer only.
- They rotate IPs aggressively but keep an obvious browser signature.
- They keep perfect browser signatures but use robotic timing.

The anti-detection game is about believable end-to-end identity, not one magic tool.
