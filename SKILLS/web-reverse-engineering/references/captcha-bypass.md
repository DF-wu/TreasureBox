# CAPTCHA Bypass Strategy

CAPTCHA should be treated as a symptom, not the core problem.

## Avoidance-First Model

1. fix fingerprint coherence
2. improve proxy reputation
3. tune behavior pacing
4. only then add CAPTCHA solving

## CAPTCHA Classes

| Type | Typical systems | Notes |
|---|---|---|
| image checkbox/grid | reCAPTCHA v2, hCaptcha | solvable via provider APIs |
| score-based invisible | reCAPTCHA v3 | highly sensitive to identity quality |
| managed challenges | Turnstile, enterprise variants | often triggered by risk scoring, not static puzzles |

## Solving Options

| Option | Pros | Cons |
|---|---|---|
| 2Captcha/Anti-Captcha | broad support, mature | latency + variable solve quality |
| CapSolver-like APIs | modern challenge coverage | cost and provider dependency |
| in-house model approach | control and privacy | expensive to build/maintain |

## Integration Pattern

```text
request -> challenge detected -> create solve task -> poll result -> inject token -> continue flow
```

## Minimal API Flow (Pseudo)

```python
# pseudo-code only
task_id = solver.create_task(site_key, page_url)
solution = solver.wait(task_id, timeout=120)
submit(solution.token)
```

## Operational Rules

- do not send every challenge to solver; first evaluate if identity mismatch is root cause
- cap max solve attempts per session
- move failed sessions to cooldown queue
- log challenge type, solver latency, acceptance rate

## When to Stop Solving

Stop and reprofile traffic when:
- solve acceptance rate collapses
- challenge loops increase after valid tokens
- target rotates challenge mode aggressively

That usually means your identity layer is broken, not your solver.

## Compliance Reminder

Challenge bypass may violate target terms in some jurisdictions or contexts. Validate legal posture before running at scale.
