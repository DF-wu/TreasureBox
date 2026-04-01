# HTTP Clients (Network-Layer Evasion)

Use HTTP clients first when you do not need heavy DOM interaction. They are faster, cheaper, and easier to scale than browser automation.

## Tool Matrix

| Tool | Stack | What it does | Install | Pros | Cons |
|---|---|---|---|---|---|
| curl_cffi | Python | Browser-like TLS/JA3/HTTP2 impersonation | `pip install -U curl_cffi` | Mature, fast, strong anti-bot baseline | No JS runtime |
| hrequests | Python | High-level requests API + browser-like transport | `pip install -U hrequests` | Convenient API, async options, anti-fingerprint support | Smaller ecosystem than requests/httpx |
| rnet | Python | Fine-grained TLS/HTTP2 fingerprint control | `pip install -U --pre rnet` | Low-level control, performance-focused | Younger project, more tuning required |
| httpx/requests | Python | Standard HTTP clients | `pip install -U httpx` | Stable and simple | Easy to detect on protected targets |
| got-scraping / impit | Node.js | Browser-like HTTP in JS ecosystem | `npm i got-scraping` | Good Node integration | Tooling fragmentation |

Note: version velocity is high. Always verify with `pip index versions <pkg>` or package release pages before pinning.

## Minimal Patterns

### 1) Baseline request (cheap path)

```python
import httpx

resp = httpx.get("https://example.com", timeout=15)
print(resp.status_code)
```

### 2) TLS/browser impersonation with curl_cffi

```python
from curl_cffi import requests

resp = requests.get(
    "https://target.example",
    impersonate="chrome",  # keep this aligned with your UA/header profile
    timeout=20,
)
print(resp.status_code)
```

### 3) hrequests session

```python
import hrequests

s = hrequests.Session(browser="chrome")
resp = s.get("https://target.example")
print(resp.status_code)
```

## Practical Hardening

- Keep `User-Agent`, TLS profile, `Accept-Language`, and proxy geography coherent.
- Add randomized pacing and exponential backoff.
- Rotate proxies on challenge spikes, not every single request by default.
- Persist cookies/session tokens for stateful flows.

## Failure Signatures and Actions

| Symptom | Likely cause | Next action |
|---|---|---|
| Immediate 403/1020 | TLS/HTTP fingerprint mismatch | switch to curl_cffi profile + trusted residential/ISP proxy |
| Infinite challenge page | low IP reputation or incoherent fingerprint | rotate proxy ASN and align locale/timezone headers |
| Works manually, fails in code | missing dynamic tokens/cookies | replay full request chain from DevTools |

## Upgrade Path

If HTTP clients fail after fingerprint alignment:
1. move to patched browser automation (`browser-automation.md`)
2. apply anti-detection controls (`anti-detection.md`)
3. execute service-specific strategy (`anti-bot-bypass.md`)
