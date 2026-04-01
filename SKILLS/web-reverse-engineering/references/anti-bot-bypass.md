# Anti-Bot Bypass by Vendor

This page is tactical: detection vectors + recommended response stack.

## Service Matrix

| Service | Difficulty | Typical detection stack |
|---|---|---|
| Cloudflare | High | TLS/HTTP fingerprint, JS challenge, Turnstile, behavior scoring |
| Akamai Bot Manager | Very High | sensor telemetry, browser integrity checks, behavior models |
| DataDome | Very High | client fingerprint, network reputation, intent/behavior models |
| Kasada | Very High | script integrity, dynamic challenge protocol, behavior + network |
| PerimeterX / HUMAN | High | browser + interaction telemetry, anomaly scoring |
| Imperva | High | layered reputation + challenge policy |

## Cloudflare Playbook

1. Probe with `curl_cffi` + consistent header profile.
2. Move to residential/ISP proxy pool with ASN diversity.
3. Escalate to patched browser automation for JS/Turnstile flows.
4. Reduce noisy retries; challenge loops usually indicate identity mismatch, not "try harder".

## Akamai Playbook

1. Assume deep telemetry and strict behavioral checks.
2. Use browser path early; HTTP-only often fails at scale.
3. Keep session continuity and realistic clickstream order.
4. If economics fail, evaluate managed scraping providers.

## DataDome Playbook

1. Prioritize proxy quality over proxy quantity.
2. Patch runtime leaks and avoid deterministic action cadence.
3. Track challenge rate per proxy ASN and isolate toxic pools quickly.
4. For critical targets, maintain target-specific browser/profile templates.

## Kasada Playbook

1. Treat as top-tier defense with frequent challenge updates.
2. Use full browser automation with strong identity coherence.
3. Minimize deviations from ordinary user journeys.
4. Expect ongoing maintenance, not one-time bypass.

## Strategy Selection

| Situation | Recommended route |
|---|---|
| low volume, strict SLA | managed scraping API may be cheaper overall |
| medium volume, engineering bandwidth available | patched browser stack + quality proxies |
| high volume, many target variants | framework + identity orchestration + observability |

## Metrics That Matter

- challenge rate by target
- challenge rate by ASN/provider
- median solved page time
- useful-data-per-dollar

## Red Flags

- same fingerprint with many IPs in short windows
- same IP with many incompatible fingerprints
- abrupt burst traffic after challenge failures

Bypass success is less about single-request wins and more about stable, repeatable extraction economics.
