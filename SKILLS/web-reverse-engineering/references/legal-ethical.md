# Legal and Practical Risk Framework

This is an engineering reference, not legal advice. Use it to build intuition, then verify with counsel for your jurisdiction and use case.

## Critical Distinction: Criminal vs Civil

| Category | What it is | Typical trigger |
|---|---|---|
| **Criminal unauthorized access** | Violating computer fraud statutes (CFAA, etc.) | Bypassing technical access controls: passwords, encryption, authentication gates |
| **Civil contract dispute** | Violating Terms of Service | Scraping public pages after the provider says "don't" |
| **Privacy regulation** | GDPR, CCPA, etc. | Collecting, processing, or retaining personal data |
| **IP/database rights** | Copyright, sui generis database rights | Replicating creative selection/arrangement or substantial database investment |

**The key insight:** In most jurisdictions, scraping publicly available data from unauthenticated pages does not constitute criminal "unauthorized access." The hiQ v. LinkedIn precedent (US) and similar rulings elsewhere established that technical barriers matter, not contractual text alone.

## When ToS Actually Matters

- **Civil breach of contract claims:** Possible, but platforms rarely sue over public data scraping unless volume is massive or commercial harm is demonstrable.
- **Platform retaliation:** Account bans, IP blocks, API key revocation. This is operational risk, not legal risk.
- **CFAA (US) narrowing:** Post-Van Buren and hiQ, "exceeding authorized access" requires bypassing a technical gate, not violating use policy.

## Practical Risk Matrix

| Scenario | Criminal risk | Civil/operational risk | Mitigation |
|---|---|---|---|
| Public pages, no auth, no PII, moderate rate | Very low | Low | Standard throttling, respectful rate limits |
| Public pages, high volume, commercial reuse | Very low | Medium | Document lawful basis, assess database rights exposure |
| Authenticated scraping (your own account) | Low | Medium | Review ToS for account termination risk |
| Bypassing auth/paywalls/technical controls | **High** | High | Do not proceed without explicit legal clearance |
| Large-scale PII collection | Low (if public) | **High** | GDPR/CCPA obligations apply; implement data minimization and deletion |
| Scraping government, medical, financial records | Context-dependent | Context-dependent | Consult counsel; these categories attract heightened scrutiny |

## Operational Hygiene (Do These Regardless)

- Rate-limit to avoid service degradation
- Respect `robots.txt` as a signal, not a legal barrier
- Use identifiable User-Agent with contact info when practical
- Minimize data collection to what you actually need
- Implement retention limits and deletion schedules
- Do not scrape authenticated sessions you do not own without authorization

## Actual Stop Signals

Pause and seek legal counsel when:
- You receive a formal cease-and-desist or court order
- You are bypassing encryption, passwords, or other technical access controls
- You are handling regulated categories: health data (HIPAA), financial data (GLBA), children's data (COPPA)
- Your jurisdiction has specific anti-scraping statutes beyond general computer fraud law

## Do Not Confuse These

- **ToS violation ≠ crime.** Most scraping disputes are civil matters or platform enforcement, not law enforcement.
- **Public data ≠ private data.** If it loads in an incognito browser without logging in, it is generally public.
- **Anti-bot evasion ≠ unauthorized access.** Circumventing fingerprinting and behavioral detection is a technical arms race, not a legal boundary—unless you are also bypassing authentication.

## Risk Assessment Workflow

```
1. Is the data behind authentication or technical access control?
   → Yes: High criminal risk. Stop unless authorized.
   → No: Continue to 2.

2. Does the data contain personal information?
   → Yes: Assess privacy regulation obligations.
   → No: Continue to 3.

3. Is this high-volume commercial use?
   → Yes: Assess civil/database rights exposure.
   → No: Proceed with standard operational hygiene.
```

A practical scraping operation distinguishes between real legal threats and platform discomfort. Treat the former seriously; treat the latter as an engineering problem.
