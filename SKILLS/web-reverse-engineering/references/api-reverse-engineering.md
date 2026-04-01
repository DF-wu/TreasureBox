# API Reverse Engineering

Direct API extraction is usually more stable than HTML parsing.

## Workflow

1. reproduce user flow in browser
2. capture XHR/fetch requests in DevTools
3. identify auth, pagination, filters, and anti-replay params
4. replay request outside browser
5. parameterize and productionize

## Tooling

| Tool | Use case | Install |
|---|---|---|
| Browser DevTools | request discovery, payload inspection | built-in |
| mitmproxy | intercept/modify traffic, mobile app traffic | `pip install mitmproxy` |
| Charles Proxy | GUI-based interception/replay | commercial |
| Frida | runtime hooking, SSL pinning bypass scenarios | project-specific |

## DevTools Checklist

For each useful request, capture:
- URL and method
- query/body params
- auth headers/cookies
- required ordering of prior calls
- response schema and pagination tokens

## Replay Pattern

```python
import requests

url = "https://target.example/api/search"
headers = {
    "Authorization": "Bearer <token>",
    "Accept": "application/json",
}
params = {"q": "keyword", "page": 1}

resp = requests.get(url, headers=headers, params=params, timeout=20)
print(resp.status_code)
print(resp.json())
```

## Mobile App Angle

Many mobile APIs are simpler than web frontends.

Typical steps:
1. set device proxy to mitmproxy/Charles
2. install interception cert
3. capture app traffic
4. map endpoint families and auth lifecycle

If SSL pinning blocks capture, advanced dynamic analysis may be required.

## Token and Signature Handling

Common blockers:
- short-lived access tokens
- one-time nonce values
- HMAC signatures tied to timestamps/body

Mitigation:
- emulate exact call sequence
- implement token refresh lifecycle
- preserve server-expected canonicalization rules for signing

## Production Guardrails

- schema validation for response drift
- endpoint-level rate limiting
- replay tests from stored fixtures
- fallback parser path if API contracts change suddenly

API-first extraction reduces fragility and maintenance cost when done correctly.
