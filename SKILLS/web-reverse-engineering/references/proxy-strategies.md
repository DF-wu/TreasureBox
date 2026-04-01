# Proxy Strategies

Proxy quality is often the top predictor of success on defended targets.

## Proxy Types

| Type | Reputation | Speed | Cost | Best for |
|---|---|---|---|---|
| Datacenter | Low to medium | High | Low | low-friction targets, bulk fetches |
| Residential | High | Medium | Medium-high | defended consumer websites |
| ISP (static residential) | High | High | High | session continuity, account workflows |
| Mobile | Very high | Medium | Highest | hardest anti-bot environments |

## Rotation Models

### Per-request rotation
- strongest anonymity
- weak continuity

### Sticky session rotation
- same IP for N minutes or N requests
- needed for login/cart/search journey continuity

### Adaptive rotation (recommended)
- rotate by challenge signals, failure class, and ASN health
- avoid blind rotation that destroys valid sessions

## Proxy Pool Health Model

Track for each proxy:
- success rate
- challenge rate
- median latency
- target-specific block history
- ASN and country consistency

Score proxies and route traffic accordingly.

## Example Selection Logic

```python
# pseudo-code
if target_defense_level >= 4:
    pool = residential_or_isp
elif target_defense_level == 3:
    pool = mixed_pool
else:
    pool = datacenter_pool

proxy = pick_best_health_score(pool, target=target_name)
```

## Geo and Locale Coherence

Always align:
- proxy country/city
- `Accept-Language`
- timezone in browser context
- market-specific page variant assumptions

Incoherent identity is a common hidden blocker.

## Cost Governance

- route low-risk pages to cheaper pools
- reserve expensive pools for challenge-prone endpoints
- enforce per-target budget and automatic downgrade paths

## Failure Handling

| Failure | Action |
|---|---|
| timeout spike | quarantine proxy temporarily |
| repeated challenge loops | switch ASN and identity profile |
| 403 burst on one target | isolate target-specific blocklist for that pool |

Good proxy ops is an engineering problem, not just a vendor purchase.
