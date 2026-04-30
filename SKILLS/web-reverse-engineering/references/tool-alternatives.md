# Tool Alternatives and Replacement Matrix

This page maps common tools to their specialized or stealth-oriented replacements. The goal is to upgrade your stack without relearning everything.

## HTTP Clients: Standard → Stealth

| Use case | Standard tool | Stealth replacement | Why upgrade |
|---|---|---|---|
| Simple GET/POST | `curl` / `wget` | `curl_cffi` | Real browser TLS/JA3 fingerprint |
| Python requests | `requests` / `httpx` | `curl_cffi` (via Python bindings) | Drop-in with `impersonate="chrome"` |
| Async Python | `aiohttp` / `httpx` | `hrequests` / `rnet` | Built-in anti-fingerprint + async |
| Node.js | `axios` / `node-fetch` | `got-scraping` / `impit` | Browser-like HTTP/2 behavior |
| Go | `net/http` | `req` (with TLS customization) | Fine-grained JA3/HTTP2 control |
| Rust | `reqwest` | `rquest` | TLS/HTTP2 impersonation, curl_cffi equivalent |

## Browser Automation: Detectable → Undetectable

| Use case | Standard tool | Stealth replacement | Why upgrade |
|---|---|---|---|
| General automation | Playwright / Selenium | `Patchright` / `rebrowser` | Patches CDP/webdriver leaks |
| High-pressure anti-bot | Playwright | `Camoufox` | Deep Firefox fingerprint control |
| Lightweight CDP | Selenium | `nodriver` | Native async CDP, no driver binary |
| Agent orchestration | Playwright + custom code | `Browser-Use` | High-level task planning |
| Chinese market targets | Playwright | `DrissionPage` | Anti-detection optimized for CN defenses |
| Go browser automation | Playwright | `Rod` / `chromedp` | Native Go, single binary, fast |
| Rust browser automation | Playwright | `chromiumoxide` / `headless_chrome` | Memory safe, high performance |

## Proxy: Datacenter → Residential/ISP

| Use case | Budget option | Quality replacement | Why upgrade |
|---|---|---|---|
| Low-friction targets | Free/datacenter proxies | Residential/ISP rotating | Passes ASN reputation checks |
| Session continuity | Per-request rotation | Sticky sessions (N min) | Login/cart journey support |
| Mobile-only content | Residential | Mobile proxy pool | Highest reputation tier |
| Self-hosted | Individual IPs | Proxy mesh (Bright Data, Oxylabs, IPRoyal) | Health scoring + auto-routing |
| Free tier testing | Public proxy lists | `Webshare` / `Proxy-Cheap` trials | Paid but cheap for validation |

## Scraping Frameworks: Script → Production

| Scale | Approach | Framework | Why upgrade |
|---|---|---|---|
| One-off script | `requests` + `BeautifulSoup` | `Scrapy` | Middleware, pipelines, retries |
| Browser-heavy | Playwright scripts | `Crawlee` / `PlaywrightCrawler` | Queue + orchestration built-in |
| Go stack | Python scripts | `Colly` / `Rod` / `chromedp` | Speed + single-binary deploy |
| Rust stack | Python/Node | `Ferret` / `spider` | Memory safety + performance |
| Distributed queue | Single-machine Scrapy | `Scrapy-Redis` / `Crawlee` + Redis | Horizontal scaling |
| Serverless | Self-hosted | `ScrapyRT` / `ScrapingHub` / `Apify` | Pay-per-request, no infra mgmt |

## CAPTCHA: Manual → Automated

| Type | Service | Notes |
|---|---|---|
| Image challenges | 2Captcha / Anti-Captcha | Broad support, variable quality |
| Invisible score-based | CapSolver / Anti-Captcha Enterprise | reCAPTCHA v3 / Turnstile focus |
| Self-hosted | Open-source models (YOLO-based) | High maintenance, privacy control |
| Browser extension | `Buster` / `NopeCHA` | Free tier, rate-limited |
| Audio challenges | `SpeechRecognition` + solver | For accessibility fallback paths |

## Reverse Engineering: Basic → Advanced

| Layer | Basic tool | Advanced replacement | Why upgrade |
|---|---|---|---|
| API interception | Browser DevTools | `mitmproxy` / `HTTP Toolkit` | Mobile app + modification + scripting |
| GUI interception | `Charles Proxy` | `Burp Suite` / `Fiddler Everywhere` | Security testing + extensibility |
| Traffic analysis | Browser Network | `Wireshark` / `tcpdump` / `tshark` | Full packet-level inspection |
| Mobile SSL pinning | None (blocked) | `Frida` / `objection` | Runtime hooking, no root required |
| Root-level mobile | `Frida` scripts | `Magisk` modules + `LSPosed` | System-wide hooks |
| APK analysis | Online decompilers | `jadx` / `apktool` + `dex2jar` | Local, scriptable, batchable |
| Dalvik/ART runtime | `dex2jar` + `jd-gui` | `GDA` / `JEB` | Direct Dalvik analysis, no conversion |
| Binary analysis | `strings` / `grep` | `Ghidra` / `radare2` / `IDA Pro` | Disassembly + decompilation |
| Windows PE | `CFF Explorer` | `x64dbg` / `dnSpy` / `ILSpy` | Dynamic debugging + .NET analysis |
| macOS/iOS binary | `otool` / `nm` | `Hopper` / `Ghidra` + `frida-ios-dump` | ARM64 analysis + app decryption |
| JS deobfuscation | `prettier` / manual | `Babel` AST / `de4js` / `jsnice` / `syn` | Automated structure recovery |
| WASM analysis | `wasm2wat` | `wasm-decompile` / `Ghidra` WASM | Decompile to C-like pseudocode |

## Data Extraction: Brittle → Robust

| Approach | Basic tool | Robust replacement | Why upgrade |
|---|---|---|---|
| CSS parsing | `BeautifulSoup` | `selectolax` / `lxml` | 10-100x faster, less memory |
| XPath | Manual | `parsel` (Scrapy) | Built-in selector fallback |
| JSON extraction | `json` module | `jmespath` / `jsonpath-ng` | Query language for nested data |
| Schema validation | Manual asserts | `pydantic` / `cerberus` / `voluptuous` | Type-safe + auto-docs |
| HTML to structured | Regex | `Readability-lxml` / `trafilatura` | Article/content extraction |
| LLM extraction | Raw prompts | `instructor` / `marvin` / ` outlines` | Structured output from LLMs |

## Protocol Analysis: Guessing → Instrumentation

| Approach | Basic tool | Advanced replacement | Why upgrade |
|---|---|---|---|
| HTTP inspection | Browser DevTools | `mitmproxy` + custom scripts | Programmable interception |
| WebSocket | DevTools Network | `wscat` / `websocat` / `mitmproxy` | CLI testing + proxy inspection |
| gRPC-web | Browser + guesswork | `grpcurl` / `BloomRPC` | Direct gRPC endpoint testing |
| Protobuf reverse | Manual hex reading | `protoc` + `blackboxprotobuf` | Decode unknown protobuf streams |
| Binary protocol | `hexdump` / `xxd` | `ImHex` / `010 Editor` | Structured binary templates |
| Network scanning | `nmap` | `masscan` / `rustscan` | 1000x faster for large ranges |
| Service discovery | `nmap` scripts | `zmap` + `zgrab` | Internet-scale scanning |

## Fingerprint Evasion: Naive → Surgical

| Approach | Basic tool | Advanced replacement | Why upgrade |
|---|---|---|---|
| User-Agent rotation | Hardcoded list | `fake-useragent` / `user-agents` library | Real-world UA distribution |
| Fingerprint generation | Manual | `fingerprint-suite` | Consistent canvas/webgl/audio |
| Profile management | Fresh profile each time | `puppeteer-extra-plugin-stealth` | Reduced leak surface |
| VM/container detect | Ignore | `Puppeteer-Stealth-Plugin` + custom | Bypass headless/VM checks |
| Hardware spoofing | None | `Camoufox` / `custom CDP commands` | Believable GPU/CPU/memory hints |

## Language Ecosystem Migration

| From | To | When it makes sense |
|---|---|---|
| Python scripts | Go binaries | Deploy to edge/IoT, single binary, faster |
| Python frameworks | Rust services | Memory-critical, 10x throughput needed |
| Node.js | Bun | 3x faster startup, compatible API |
| Selenium | Playwright | Modern web, auto-wait, better traces |
| Playwright | `nodriver` / `Rod` | Headless-only, no browser binary bloat |
| Scrapy | `Colly` (Go) | CPU-bound crawling, cross-compile deploy |
| BeautifulSoup | `selectolax` (C-backed) | 50-100x parse speed improvement |

## Decision Heuristic

When choosing a replacement, ask:
1. Is the current tool failing on detection or performance?
2. Does the replacement integrate with your existing stack?
3. Is the learning curve worth the success rate gain?
4. Can you A/B test both before committing?

Do not upgrade everything at once. Replace the bottleneck first.
