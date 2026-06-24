# Proxy Rotation Strategies

Production-grade proxy rotation for web scraping and automation: health checking, automatic failover, geo-matching, and integration with Playwright and httpx.

## Proxy Types & Use Cases

| Type | Cost | Speed | Detection Risk | Best For |
|------|------|-------|----------------|----------|
| **Datacenter** | $ | Fast | High | APIs with no bot detection |
| **Residential** | $$$ | Medium | Low | Aggressive bot detection (Cloudflare, Akamai) |
| **ISP** | $$ | Fast | Low-Medium | Balance of speed and stealth |
| **Mobile (4G/5G)** | $$$$ | Slow | Very Low | Highly restricted platforms (social media) |

**Rule of thumb**:
- Start with datacenter proxies
- Upgrade to residential if you see CAPTCHA loops or rate limiting
- Use ISP proxies for production scrapers (best cost/stealth balance)
- Reserve mobile proxies for platforms that explicitly ban datacenter IPs

## Architecture: Clash/Mihomo Proxy Manager

**Why Clash/Mihomo**:
- Automatic health checking (tests proxy availability)
- URL-test mode (picks fastest working proxy)
- Subscription support (single URL updates 1000+ proxies)
- Built-in load balancing
- Works with both Playwright and httpx

### Setup Script

```bash
#!/usr/bin/env bash
# Deploy mihomo proxy with health checking and auto-selection
# Environment variables:
#   PROXY_SUBSCRIPTION_URL  - Clash subscription link (required)
#   PROXY_PORT              - Local port (default: 7890)
#   PROXY_TEST_URL          - Health check target (default: Google)

set -euo pipefail

PROXY_SUBSCRIPTION_URL="${PROXY_SUBSCRIPTION_URL:?PROXY_SUBSCRIPTION_URL required}"
PROXY_DIR="/tmp/mihomo-proxy"
PROXY_PORT="${PROXY_PORT:-7890}"
PROXY_TEST_URL="${PROXY_TEST_URL:-https://www.google.com/generate_204}"
MIHOMO_VERSION="${MIHOMO_VERSION:-v1.19.0}"

mkdir -p "${PROXY_DIR}"
cd "${PROXY_DIR}"

# Download mihomo binary
echo "[INFO] Downloading mihomo ${MIHOMO_VERSION}..."
ARCHIVE="mihomo-linux-amd64-${MIHOMO_VERSION}.gz"
curl -fsSL -o "${ARCHIVE}" \
  "https://github.com/MetaCubeX/mihomo/releases/download/${MIHOMO_VERSION}/${ARCHIVE}"
gunzip -f "${ARCHIVE}"
chmod +x "mihomo-linux-amd64-${MIHOMO_VERSION}"
MIHOMO_BIN="${PROXY_DIR}/mihomo-linux-amd64-${MIHOMO_VERSION}"

# Generate config
cat > config.yaml <<EOF
mixed-port: ${PROXY_PORT}  # HTTP + SOCKS5 on same port
allow-lan: false
ipv6: false
mode: rule
log-level: warning
unified-delay: true  # More accurate RTT measurement

proxy-providers:
  subscription:
    type: http
    url: "${PROXY_SUBSCRIPTION_URL}"
    interval: 3600  # Refresh every hour
    path: ./subscription.yaml
    health-check:
      enable: true
      interval: 300  # Test every 5 minutes
      url: https://www.gstatic.com/generate_204
      # Lazy: false means test all proxies on startup
      lazy: false

proxy-groups:
  - name: AUTO
    type: url-test  # Automatically picks fastest working proxy
    url: "${PROXY_TEST_URL}"
    interval: 300  # Re-test every 5 minutes
    tolerance: 150  # Switch if another proxy is 150ms faster
    lazy: false  # Test all proxies immediately
    use:
      - subscription

rules:
  - MATCH,AUTO  # All traffic goes through auto-selected proxy
EOF

# Start mihomo
echo "[INFO] Starting mihomo on 127.0.0.1:${PROXY_PORT}..."
nohup "${MIHOMO_BIN}" -d "${PROXY_DIR}" -f config.yaml > mihomo.log 2>&1 &
echo $! > mihomo.pid

# Wait for health check to complete
PROXY_URL="http://127.0.0.1:${PROXY_PORT}"
READY=false
for attempt in {1..45}; do
  if curl -fsS -x "${PROXY_URL}" --max-time 20 "${PROXY_TEST_URL}" -o /dev/null 2>/dev/null; then
    READY=true
    break
  fi
  echo "[INFO] Waiting for proxy health check (${attempt}/45)..."
  sleep 2
done

if [[ "${READY}" != "true" ]]; then
  echo "[FAILED] Proxy health check failed"
  tail -n 30 mihomo.log
  exit 1
fi

echo "[SUCCESS] Proxy ready: ${PROXY_URL}"
echo "PROXY_URL=${PROXY_URL}" >> "${GITHUB_ENV:-/dev/null}"
```

**Key features**:
- **url-test mode**: Automatically picks fastest working proxy from pool
- **tolerance**: Only switches if new proxy is significantly faster (avoids flapping)
- **lazy: false**: Tests all proxies on startup (ensures at least one works)
- **health-check interval**: Periodic testing detects dead proxies

### Stop Script

```bash
#!/usr/bin/env bash
# Graceful shutdown of mihomo proxy

PROXY_DIR="/tmp/mihomo-proxy"
PID_FILE="${PROXY_DIR}/mihomo.pid"

if [[ -f "${PID_FILE}" ]]; then
  PID=$(cat "${PID_FILE}")
  if kill -0 "${PID}" 2>/dev/null; then
    echo "[INFO] Stopping mihomo (PID ${PID})..."
    kill "${PID}"
    sleep 2
    kill -9 "${PID}" 2>/dev/null || true
  fi
  rm -f "${PID_FILE}"
fi

echo "[INFO] Mihomo proxy stopped"
```

## Integration Patterns

### Playwright Integration

```python
import os
from playwright.async_api import async_playwright

def get_playwright_proxy(*, use_proxy: bool = False) -> dict | None:
    """Get proxy config for Playwright in Clash-compatible format."""
    if not use_proxy:
        return None
    
    proxy_url = os.getenv('PROXY_URL', '').strip()
    if not proxy_url:
        return None
    
    # Parse proxy URL
    # Format: http://127.0.0.1:7890 or http://user:pass@host:port
    from urllib.parse import urlparse
    parsed = urlparse(proxy_url)
    
    proxy_config = {
        'server': f'{parsed.scheme}://{parsed.hostname}:{parsed.port}'
    }
    
    if parsed.username:
        proxy_config['username'] = parsed.username
    if parsed.password:
        proxy_config['password'] = parsed.password
    
    return proxy_config


async def launch_with_proxy(use_proxy: bool = False):
    """Launch Playwright browser with optional proxy."""
    launch_kwargs = {'headless': True}
    
    proxy = get_playwright_proxy(use_proxy=use_proxy)
    if proxy:
        launch_kwargs['proxy'] = proxy
        print(f"[INFO] Browser using proxy: {proxy['server']}")
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(**launch_kwargs)
        page = await browser.new_page()
        
        # Test proxy
        await page.goto('https://api.ipify.org?format=json')
        ip_info = await page.text_content('body')
        print(f"[INFO] Browser IP: {ip_info}")
        
        return browser, page
```

### httpx Integration

```python
import httpx
import os

def get_httpx_proxy(*, use_proxy: bool = False) -> str | None:
    """Get proxy URL for httpx client."""
    if not use_proxy:
        return None
    return os.getenv('PROXY_URL', '').strip() or None


async def make_request_with_proxy(url: str, *, use_proxy: bool = False):
    """Make httpx request with optional proxy."""
    client_kwargs = {'http2': True, 'timeout': 30.0}
    
    proxy_url = get_httpx_proxy(use_proxy=use_proxy)
    if proxy_url:
        client_kwargs['proxy'] = proxy_url
        print(f"[INFO] HTTP client using proxy: {proxy_url}")
    
    async with httpx.AsyncClient(**client_kwargs) as client:
        response = await client.get(url)
        return response


# Synchronous version
def make_sync_request_with_proxy(url: str, *, use_proxy: bool = False):
    """Make synchronous httpx request with optional proxy."""
    client_kwargs = {'http2': True, 'timeout': 30.0}
    
    proxy_url = get_httpx_proxy(use_proxy=use_proxy)
    if proxy_url:
        client_kwargs['proxy'] = proxy_url
    
    with httpx.Client(**client_kwargs) as client:
        response = client.get(url)
        return response
```

## Per-Provider Proxy Configuration

Different targets may need different proxy strategies:

```python
from dataclasses import dataclass

@dataclass
class ProviderConfig:
    """Provider-specific configuration including proxy settings."""
    name: str
    domain: str
    use_proxy: bool = False
    proxy_required: bool = False  # Fail if proxy unavailable


# Built-in provider configs
PROVIDERS = {
    'anyrouter': ProviderConfig(
        name='anyrouter',
        domain='https://anyrouter.top',
        use_proxy=False,  # Accessible globally
    ),
    'agentrouter': ProviderConfig(
        name='agentrouter',
        domain='https://agentrouter.org',
        use_proxy=True,  # Geo-restricted, needs proxy
        proxy_required=True,
    ),
}


async def execute_with_provider_proxy(provider_name: str, operation):
    """Execute operation with provider-specific proxy settings."""
    config = PROVIDERS.get(provider_name)
    if not config:
        raise ValueError(f"Unknown provider: {provider_name}")
    
    proxy_url = get_httpx_proxy(use_proxy=config.use_proxy)
    
    if config.proxy_required and not proxy_url:
        raise RuntimeError(
            f"Provider {provider_name} requires proxy but PROXY_URL not set"
        )
    
    return await operation(proxy_url=proxy_url)
```

## Health Checking & Failover

### Manual Health Check

If not using Clash/Mihomo, implement health checking manually:

```python
import asyncio
import httpx
from dataclasses import dataclass
from typing import List

@dataclass
class ProxyHealth:
    url: str
    is_alive: bool
    latency_ms: float
    last_check: float


class ProxyPool:
    def __init__(self, proxy_urls: List[str], test_url: str = 'https://www.google.com/generate_204'):
        self.proxy_urls = proxy_urls
        self.test_url = test_url
        self.health: dict[str, ProxyHealth] = {}
    
    async def check_proxy(self, proxy_url: str) -> ProxyHealth:
        """Test single proxy and measure latency."""
        start = asyncio.get_event_loop().time()
        
        try:
            async with httpx.AsyncClient(proxy=proxy_url, timeout=10.0) as client:
                response = await client.get(self.test_url)
                is_alive = response.status_code in (200, 204)
        except:
            is_alive = False
        
        latency_ms = (asyncio.get_event_loop().time() - start) * 1000
        
        return ProxyHealth(
            url=proxy_url,
            is_alive=is_alive,
            latency_ms=latency_ms if is_alive else float('inf'),
            last_check=asyncio.get_event_loop().time()
        )
    
    async def check_all(self):
        """Check all proxies concurrently."""
        tasks = [self.check_proxy(url) for url in self.proxy_urls]
        results = await asyncio.gather(*tasks)
        
        for health in results:
            self.health[health.url] = health
        
        alive = sum(1 for h in self.health.values() if h.is_alive)
        print(f"[INFO] Proxy health: {alive}/{len(self.proxy_urls)} alive")
    
    def get_fastest_alive(self) -> str | None:
        """Get fastest working proxy."""
        alive_proxies = [
            h for h in self.health.values()
            if h.is_alive
        ]
        
        if not alive_proxies:
            return None
        
        fastest = min(alive_proxies, key=lambda h: h.latency_ms)
        return fastest.url
    
    async def request_with_failover(self, url: str, max_retries: int = 3):
        """Make request with automatic proxy failover."""
        for attempt in range(max_retries):
            proxy_url = self.get_fastest_alive()
            
            if not proxy_url:
                # Re-check all proxies
                await self.check_all()
                proxy_url = self.get_fastest_alive()
                
                if not proxy_url:
                    raise RuntimeError("No working proxies available")
            
            try:
                async with httpx.AsyncClient(proxy=proxy_url, timeout=30.0) as client:
                    response = await client.get(url)
                    return response
            except Exception as e:
                print(f"[WARN] Request failed via {proxy_url}: {e}")
                # Mark proxy as dead
                if proxy_url in self.health:
                    self.health[proxy_url].is_alive = False
        
        raise RuntimeError(f"Request failed after {max_retries} attempts")


# Usage
proxy_pool = ProxyPool([
    'http://proxy1.example.com:8080',
    'http://proxy2.example.com:8080',
    'http://proxy3.example.com:8080',
])

await proxy_pool.check_all()
response = await proxy_pool.request_with_failover('https://target.com/api/data')
```

## Geo-Matching

Match proxy location with target site locale:

```python
PROXY_GEO_MAP = {
    'us': {
        'proxy_urls': ['http://us-proxy-1:8080', 'http://us-proxy-2:8080'],
        'locale': 'en-US',
        'timezone': 'America/New_York',
    },
    'eu': {
        'proxy_urls': ['http://eu-proxy-1:8080', 'http://eu-proxy-2:8080'],
        'locale': 'en-GB',
        'timezone': 'Europe/London',
    },
    'cn': {
        'proxy_urls': ['http://cn-proxy-1:8080'],
        'locale': 'zh-CN',
        'timezone': 'Asia/Shanghai',
    },
}


async def launch_browser_with_geo(geo: str = 'us'):
    """Launch browser with geo-matched proxy and locale."""
    config = PROXY_GEO_MAP.get(geo, PROXY_GEO_MAP['us'])
    
    # Pick random proxy from geo pool
    import random
    proxy_url = random.choice(config['proxy_urls'])
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            proxy={'server': proxy_url},
            locale=config['locale'],
            timezone_id=config['timezone'],
        )
        
        return browser, context
```

## Rate Limiting with Proxies

Even with proxies, respect rate limits:

```python
import asyncio
from collections import defaultdict
import time

class RateLimitedProxyPool:
    def __init__(self, proxy_pool: ProxyPool, requests_per_minute: int = 30):
        self.proxy_pool = proxy_pool
        self.requests_per_minute = requests_per_minute
        self.request_times: dict[str, list[float]] = defaultdict(list)
    
    async def wait_for_rate_limit(self, proxy_url: str):
        """Wait if proxy has hit rate limit."""
        now = time.time()
        window_start = now - 60  # 1-minute window
        
        # Remove requests outside window
        self.request_times[proxy_url] = [
            t for t in self.request_times[proxy_url]
            if t > window_start
        ]
        
        if len(self.request_times[proxy_url]) >= self.requests_per_minute:
            # Calculate wait time
            oldest = self.request_times[proxy_url][0]
            wait_time = 60 - (now - oldest) + 0.1  # Add buffer
            
            if wait_time > 0:
                print(f"[INFO] Rate limit reached for {proxy_url}, waiting {wait_time:.1f}s")
                await asyncio.sleep(wait_time)
        
        self.request_times[proxy_url].append(now)
    
    async def request(self, url: str):
        """Make rate-limited request through proxy pool."""
        proxy_url = self.proxy_pool.get_fastest_alive()
        
        if not proxy_url:
            raise RuntimeError("No working proxies available")
        
        await self.wait_for_rate_limit(proxy_url)
        
        async with httpx.AsyncClient(proxy=proxy_url) as client:
            return await client.get(url)
```

## Debugging Proxy Issues

### Test Proxy Connectivity

```python
async def test_proxy(proxy_url: str, test_urls: list[str] = None):
    """Comprehensive proxy test."""
    if test_urls is None:
        test_urls = [
            'https://www.google.com/generate_204',
            'https://api.ipify.org?format=json',
            'https://httpbin.org/ip',
        ]
    
    results = {}
    
    async with httpx.AsyncClient(proxy=proxy_url, timeout=10.0) as client:
        for url in test_urls:
            try:
                start = time.time()
                response = await client.get(url)
                latency = (time.time() - start) * 1000
                
                results[url] = {
                    'status': response.status_code,
                    'latency_ms': latency,
                    'body': response.text[:200],
                }
            except Exception as e:
                results[url] = {
                    'error': str(e)
                }
    
    return results
```

### Compare Direct vs Proxy

```python
async def compare_direct_vs_proxy(url: str, proxy_url: str):
    """Compare request with and without proxy."""
    
    # Direct request
    try:
        async with httpx.AsyncClient() as client:
            direct = await client.get(url)
            direct_result = {
                'status': direct.status_code,
                'body': direct.text[:500],
            }
    except Exception as e:
        direct_result = {'error': str(e)}
    
    # Proxy request
    try:
        async with httpx.AsyncClient(proxy=proxy_url) as client:
            proxied = await client.get(url)
            proxy_result = {
                'status': proxied.status_code,
                'body': proxied.text[:500],
            }
    except Exception as e:
        proxy_result = {'error': str(e)}
    
    print("Direct request:", direct_result)
    print("Proxy request:", proxy_result)
```

## Production Patterns

### Pattern 1: Conditional Proxy (Recommended)

Only use proxy when provider requires it:

```python
async def execute_checkin(account, provider_config):
    """Execute checkin with conditional proxy."""
    use_proxy = provider_config.use_proxy
    
    # Browser operations
    proxy = get_playwright_proxy(use_proxy=use_proxy)
    browser = await launch_async(headless=True, proxy=proxy)
    
    # HTTP operations
    proxy_url = get_httpx_proxy(use_proxy=use_proxy)
    async with httpx.AsyncClient(proxy=proxy_url) as client:
        response = await client.post('/api/checkin')
    
    return response
```

### Pattern 2: Subscription-Based (GitHub Actions)

For CI/CD environments, start proxy service before script:

```yaml
# .github/workflows/scheduled-task.yml
- name: Setup Mihomo Proxy
  if: env.PROXY_SUBSCRIPTION_URL != ''
  run: bash scripts/setup_mihomo_proxy.sh

- name: Run Script
  run: python main.py

- name: Stop Proxy
  if: always()
  run: bash scripts/stop_mihomo_proxy.sh
```

### Pattern 3: Local Development

For local development, support existing proxy:

```bash
# Use existing local proxy (Clash, V2Ray, etc.)
export PROXY_URL=http://127.0.0.1:7890
python main.py

# Or start mihomo from subscription
export PROXY_SUBSCRIPTION_URL=https://example.com/clash?token=xxx
bash scripts/setup_mihomo_proxy.sh
python main.py
```

## Related Playbooks

- `waf-bypass-techniques.md` — Using proxies for WAF evasion
- `anti-detection.md` — Matching proxy geo with browser locale
- `automated-login-solver.md` — Proxy configuration for browser automation
