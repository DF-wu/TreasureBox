# Legal and Ethical Guardrails

This is an engineering reference, not legal advice.

## Core Risk Domains

1. unauthorized access laws
2. contract/terms-of-service violations
3. privacy and personal-data regulation
4. copyright/database-rights exposure
5. anti-circumvention issues

## Jurisdictional Signals (High Level)

- US: public-data scraping can be lower risk than access behind authentication gates, but context matters.
- EU/UK: personal data processing obligations can apply even to scraped public pages.
- Global: terms enforcement and civil claims vary widely by venue and business impact.

## Practical Risk Matrix

| Scenario | Relative risk |
|---|---|
| public pages, moderate rate, no personal data | low-medium |
| authenticated scraping or paywall bypass | high |
| large-scale personal data collection | high |
| active anti-bot circumvention with commercial reuse | high |

## Minimum Governance Checklist

Before production:
- document purpose and lawful basis
- classify data types (PII vs non-PII)
- define retention and deletion policy
- apply minimization (collect only what is needed)
- create incident response path for takedown requests

## Robots and Terms

- `robots.txt` is not universally binding law, but is an important policy signal.
- explicit terms can still create contractual risk.
- repeated evasion against explicit prohibitions increases legal exposure.

## Operational Ethics

- avoid service degradation (rate-limit responsibly)
- avoid sensitive/private user data unless clearly authorized
- provide contactable user-agent identity where possible
- do not retain unnecessary raw personal data

## Escalation Triggers (Stop and Review)

Stop immediately if:
- legal notice or cease-and-desist is received
- you detect regulated personal data at scale without approved controls
- bypass methods require increasingly invasive circumvention

## Safer Alternatives

- licensed datasets
- official partner APIs
- managed providers with compliance controls and contracts

A sustainable scraping program treats legal/compliance as part of architecture, not an afterthought.
