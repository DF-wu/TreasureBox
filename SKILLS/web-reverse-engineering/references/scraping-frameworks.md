# Scraping Frameworks (Scale and Reliability)

For one-off pages, scripts are enough. For sustained extraction, use a framework.

## Framework Comparison

| Framework | Language | Best for | Install | Pros | Cons |
|---|---|---|---|---|---|
| Scrapy | Python | high-throughput crawls, mature pipelines | `pip install scrapy` | robust ecosystem, strong middleware model | steeper learning curve |
| Crawlee/Apify SDK | Node/TS | browser-heavy + queue orchestration | `npm i crawlee` | great browser integration and request queues | JS stack required |
| Colly | Go | lightweight high-speed crawlers | `go get github.com/gocolly/colly/v2` | fast and simple | fewer built-in anti-bot features |
| Rod | Go | browser automation + scraping | `go get github.com/go-rod/rod` | native Go, single binary, fast | smaller ecosystem than Playwright |
| Ferret | Go | declarative web scraping | `go get github.com/MontFerret/ferret` | FQL query language, fast | less mature than Scrapy |
| spider (Rust) | Rust | fast, memory-safe crawling | `cargo add spider` | zero-cost abstractions, safe | smaller ecosystem |
| PlaywrightCrawler | Node/TS | browser-based at scale | `npm i crawlee` | built on Playwright, queue managed | requires browser binary |
| Scrapy-Redis | Python | distributed Scrapy | `pip install scrapy-redis` | horizontal scaling with Redis | adds infrastructure complexity |
| Splash | Python | headless browser for Scrapy | `docker run scrapinghub/splash` | integrates with Scrapy middleware | slower than direct Playwright |

## Scrapy Minimal Example

```python
import scrapy

class ExampleSpider(scrapy.Spider):
    name = "example"
    start_urls = ["https://example.com"]

    def parse(self, response):
        yield {"title": response.css("title::text").get()}
```

## Crawlee Minimal Example

```javascript
import { PlaywrightCrawler } from 'crawlee';

const crawler = new PlaywrightCrawler({
  async requestHandler({ page, request, log }) {
    log.info(`Processing ${request.url}`);
    const title = await page.title();
    console.log({ url: request.url, title });
  },
});

await crawler.run(['https://example.com']);
```

## Architecture Pattern (Production)

```text
scheduler -> url queue -> worker pool -> parser -> validation -> storage
                                 -> retry/dead-letter
                                 -> metrics/logs/traces
```

## Must-Have Reliability Controls

- idempotent fetch + parse steps
- bounded retries with exponential backoff
- dead-letter queue for hard failures
- checkpointing for resume after crash
- per-target rate policies

## Integration with Anti-Bot Stack

- inject proxy decisions at request scheduling layer
- separate identity pools by target family
- store challenge outcomes to improve routing
- trigger fallback path (managed API/browser escalation) automatically

## Data Contract Discipline

Define schemas early:
- raw payload
- normalized record
- extraction metadata (source URL, timestamp, parser version, confidence)

Without schema/versioning, replay and audit become painful.

## Cost Controls

- cache immutable pages
- prioritize API endpoints over rendered pages
- keep browser usage for pages that strictly require JS
- batch writes to storage sinks
