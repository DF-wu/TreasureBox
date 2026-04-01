# Browser Automation (JS + Interaction Targets)

When data is rendered client-side or protected by JS challenges, browser automation is required.

## Tool Comparison

| Tool | Stack | Install | Best use | Pros | Cons |
|---|---|---|---|---|---|
| Playwright | Py/Node | `pip install playwright` + `playwright install` | Standard automation/testing | Stable API, strong ecosystem | Detectable without hardening |
| Patchright | Node/Py wrappers | package-specific | Chromium stealth baseline | Drop-in for Playwright flows, CDP leak fixes | Chromium-only |
| rebrowser-patches | Node/Py wrappers | package-specific | Harden existing Playwright/Puppeteer | Practical patch model, active anti-detection focus | patch maintenance overhead |
| Camoufox | Python-first | project docs | High-pressure anti-bot targets | Deep Firefox-level fingerprint controls | platform/version constraints vary |
| Selenium + undetected driver | Py/JS/etc | `pip install selenium undetected-chromedriver` | Legacy suites | Huge ecosystem | Less predictable on modern anti-bot stacks |
| nodriver | Python | `pip install nodriver` | CDP-native async automation | Fast and lightweight | Non-trivial migration from Selenium |
| Browser-Use | Python | `pip install browser-use` | agent-style web tasks | high-level orchestration | abstraction overhead for low-level scraping |

## Baseline Playwright Pattern

```python
import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()
        await page.goto("https://example.com", wait_until="domcontentloaded")
        title = await page.title()
        print(title)
        await browser.close()

asyncio.run(run())
```

## Hardening Layers

1. Transport coherence: proxy + locale + timezone + language headers.
2. Runtime leak reduction: patch frameworks that mitigate known CDP markers.
3. Humanized interaction: non-linear cursor paths, realistic think time, bounded concurrency.
4. Session continuity: reuse warm profiles for stateful targets where allowed.

## Browser Choice Heuristics

- Chromium-patched (Patchright/rebrowser): best default for most anti-bot targets.
- Camoufox/Firefox path: useful when Chromium-specific detections are strong.
- Hybrid strategy: probe with HTTP clients, escalate to browsers only for pages requiring JS.

## Common Pitfalls

- Running too many concurrent tabs from a single identity.
- Fresh profile every request on a target expecting continuity.
- Inconsistent `Accept-Language` vs IP region.
- Overusing one proxy ASN across all traffic.

## Observability You Need

Track per target:
- success rate
- challenge rate
- median time to first useful data
- failure buckets (network, challenge, parsing, auth)

Without these metrics, anti-bot tuning is guesswork.
