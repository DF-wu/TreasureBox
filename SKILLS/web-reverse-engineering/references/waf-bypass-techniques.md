# WAF Bypass Techniques

Practical techniques for bypassing Web Application Firewalls (WAF) including Cloudflare, Akamai, DataDome, and Aliyun WAF. Focus on cookie harvesting, browser fingerprint evasion, and challenge solving.

## WAF Detection Landscape

| WAF Provider | Primary Defense | Cookie Names | Bypass Difficulty |
|--------------|----------------|--------------|-------------------|
| Cloudflare | JS challenge + TLS fingerprint | `cf_clearance`, `__cf_bm` | Medium |
| Aliyun (阿里云) | Sliding CAPTCHA + cookie challenges | `acw_tc`, `acw_sc__v2`, `cdn_sec_tc` | Medium-High |
| Akamai | Bot Manager with device fingerprinting | `_abck`, `bm_sz` | High |
| DataDome | Behavioral analysis + device fingerprinting | `datadome` | High |
| Imperva (Incapsula) | Progressive challenges | `incap_ses_*`, `visid_incap_*` | Medium |

## Core Principle: Cookie Harvesting

**Key insight**: WAF challenge cookies are NOT reusable across sessions or IPs. They are cryptographically bound to:
- TLS fingerprint (JA3/JA4)
- HTTP/2 fingerprint
- IP address or subnet
- User-Agent string
- Timestamp (time-limited validity)

**Implication**: You CANNOT:
- Export a cookie from your browser and inject it into a Python script
- Share cookies across multiple IPs in a proxy pool
- Reuse a cookie after your IP or User-Agent changes

**What you CAN do**:
- Harvest a fresh cookie per request using a real browser
- Reuse a cookie within its validity window (usually 30 seconds to 5 minutes) on the SAME fingerprint
- Combine user session cookie (long-lived) with WAF cookie (ephemeral)

## Architecture Pattern: Dual-Cookie Strategy

Most authed API operations behind WAF require TWO layers of cookies:

1. **User session cookie** (long-lived, portable)
   - Example: `session=abc123...` (JWT or database session ID)
   - Lifespan: Hours to weeks
   - Purpose: Authentication
   - Source: Login flow, manually exported once

2. **WAF challenge cookie** (ephemeral, fingerprint-bound)
   - Example: `acw_tc=xyz...`, `cf_clearance=...`
   - Lifespan: 30 seconds to 5 minutes
   - Purpose: Bot detection bypass
   - Source: Browser navigation through WAF challenge

**Request flow**:
```
User session cookie (from login) 
    + 
WAF cookie (from fresh browser harvest)
    → 
Merge into single request
    →
httpx/curl_cffi API call succeeds
```

## Implementation: Headless Cookie Harvesting

### Strategy 1: Minimal Navigation (Recommended)

Visit the login page (or any protected page) with a headless browser, wait for WAF challenge to pass, extract cookies.

```python
from cloakbrowser import launch_async
import httpx

async def get_waf_cookies(url: str, required_cookie_names: list[str], *, use_proxy: bool = False):
    """Harvest WAF cookies via headless browser navigation."""
    launch_kwargs = {'headless': True}
    
    if use_proxy:
        proxy_url = os.getenv('PROXY_URL')
        if proxy_url:
            launch_kwargs['proxy'] = {
                'server': proxy_url,
                # Playwright proxy format
            }
    
    browser = await launch_async(**launch_kwargs)
    page = await browser.new_page()
    
    try:
        # Navigate to protected page (triggers WAF challenge)
        await page.goto(url, wait_until='domcontentloaded', timeout=30000)
        
        # Wait for WAF challenge to pass
        await wait_for_waf_ready(page, timeout_ms=30000)
        
        # Extract cookies
        cookies = await page.context.cookies()
        waf_cookies = {}
        for cookie in cookies:
            name = cookie.get('name')
            value = cookie.get('value')
            if name in required_cookie_names and value:
                waf_cookies[name] = value
        
        missing = [c for c in required_cookie_names if c not in waf_cookies]
        if missing:
            print(f"[WARN] Missing WAF cookies: {missing}")
            return None
        
        return waf_cookies
    finally:
        await browser.close()


async def wait_for_waf_ready(page, timeout_ms=30000):
    """Wait for WAF challenge to complete and site to be interactive."""
    await page.wait_for_load_state('domcontentloaded', timeout=timeout_ms)
    
    # Check that page is not showing WAF challenge UI
    site_ready_js = """() => {
        const text = document.body?.innerText || '';
        
        // Detect common WAF challenge text
        const blocked = /请进行验证|为了更好的访问体验|访问受限|Access denied|verify you are human|checking your browser|just a moment/i.test(text);
        if (blocked) return false;
        
        // Detect visible CAPTCHA elements
        const captchaIframe = document.querySelector(
            'iframe[src*="captcha"], iframe[src*="verify"], iframe[src*="slide"], ' +
            '.nc-container, #nocaptcha, [id*="aliyun"]'
        );
        if (captchaIframe) {
            const rect = captchaIframe.getBoundingClientRect();
            if (rect && rect.width > 0 && rect.height > 0) return false;
        }
        
        // Check for minimum interactive elements (site has loaded)
        const isVisible = (el) => {
            if (!el || !el.isConnected) return false;
            const style = window.getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden') return false;
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
        };
        const visibleButtons = [...document.querySelectorAll('button, a')].filter(isVisible);
        return visibleButtons.length > 0;
    }"""
    
    try:
        await page.wait_for_function(site_ready_js, timeout=timeout_ms)
    except:
        # Fallback: wait a few seconds and hope for the best
        await asyncio.sleep(3)


# Usage: Combine with user session cookie
async def make_authed_request(api_url: str, user_session_cookie: str):
    """Make API request with both user session and fresh WAF cookies."""
    waf_cookies = await get_waf_cookies(
        'https://example.com/login',
        required_cookie_names=['acw_tc', 'acw_sc__v2'],
        use_proxy=True
    )
    
    if not waf_cookies:
        raise Exception("Failed to harvest WAF cookies")
    
    # Merge cookies
    all_cookies = {
        'session': user_session_cookie,
        **waf_cookies
    }
    
    async with httpx.AsyncClient() as client:
        client.cookies.update(all_cookies)
        response = await client.get(api_url, headers={
            'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
            'Referer': 'https://example.com/',
        })
        return response
```

**Optimization**: Cache WAF cookies for their validity window (test empirically, usually 1-3 minutes).

```python
_waf_cookie_cache = {}
_waf_cookie_timestamp = {}

async def get_waf_cookies_cached(url: str, required_names: list[str], ttl_seconds: int = 120):
    """Cached WAF cookie harvesting to avoid repeated browser launches."""
    cache_key = (url, tuple(required_names))
    
    now = time.time()
    if cache_key in _waf_cookie_cache:
        age = now - _waf_cookie_timestamp[cache_key]
        if age < ttl_seconds:
            return _waf_cookie_cache[cache_key]
    
    cookies = await get_waf_cookies(url, required_names)
    if cookies:
        _waf_cookie_cache[cache_key] = cookies
        _waf_cookie_timestamp[cache_key] = now
    return cookies
```

### Strategy 2: Full Login Flow (When Session Cookie is Short-Lived)

If the user session cookie itself is short-lived (e.g., 1 hour), harvest both session + WAF cookies together via browser login:

```python
async def login_and_get_cookies(email: str, password: str):
    """Perform full browser login, return all cookies (session + WAF)."""
    context = await launch_persistent_context_async(
        profile_dir,
        headless=True,
        humanize=True
    )
    page = await context.new_page()
    
    # Full login flow (see automated-login-solver.md)
    await navigate_login_page(page, login_url, timeout_ms=60000)
    await login_with_email_form(page, email, password, timeout_ms=60000)
    await verify_browser_login(page, console_url, timeout_ms=45000)
    
    # Extract ALL cookies (session + WAF)
    cookies = await context.cookies()
    all_cookies = {c['name']: c['value'] for c in cookies if c.get('name') and c.get('value')}
    
    await context.close()
    return all_cookies
```

**When to use**:
- User session expires frequently (can't rely on manual export)
- Need to automate login for multiple accounts
- Session cookie is httpOnly (can't extract from browser devtools)

## Provider-Specific Techniques

### Cloudflare

**Challenge types**:
1. **JS Challenge** (5-second wait page): Automatically passes in real browsers
2. **Managed Challenge** (interactive CAPTCHA): Requires `cf_clearance` cookie after solving
3. **Bot Fight Mode**: Aggressive blocking, hard to bypass

**Cookie**: `cf_clearance` (valid ~30 minutes, bound to IP + TLS fingerprint)

**Bypass approach**:
- Use `curl_cffi` for HTTP requests (mimics real browser TLS)
- For JS challenge: Headless browser wait (5-10 seconds)
- For managed challenge: CAPTCHA solving service or residential proxy rotation

```python
from curl_cffi.requests import AsyncSession

async with AsyncSession(impersonate='chrome110') as session:
    response = await session.get(
        url,
        headers={'User-Agent': 'Mozilla/5.0 ...'},
        proxy=proxy_url
    )
```

**Red flags that trigger challenges**:
- ❌ TLS fingerprint mismatch (Python requests library)
- ❌ HTTP/1.1 when modern browsers use HTTP/2
- ❌ Missing Sec-Fetch-* headers
- ❌ Datacenter IP ranges (AWS, GCP, Azure)

### Aliyun (阿里云) WAF

**Challenge type**: Sliding CAPTCHA (`acw_sc__v2` challenge) or pure cookie challenge (`acw_tc`)

**Cookies**: 
- `acw_tc`: Simple challenge, valid ~2-5 minutes
- `acw_sc__v2`: Sliding CAPTCHA challenge (harder)
- `cdn_sec_tc`: CDN-level challenge

**Bypass approach**:
- For `acw_tc` only: Headless browser navigation (no interaction needed)
- For `acw_sc__v2`: Sliding CAPTCHA solver (computer vision or manual solving)

```python
# anyrouter.top uses acw_tc + cdn_sec_tc + acw_sc__v2
required_cookies = ['acw_tc', 'cdn_sec_tc', 'acw_sc__v2']
waf_cookies = await get_waf_cookies('https://anyrouter.top/login', required_cookies)
```

**Debugging**: If cookies are obtained but still get 403:
- Check cookie domain/path settings
- Verify Referer header matches domain
- Ensure User-Agent matches browser used to harvest cookies
- Test cookie validity window (may be shorter than expected)

### Akamai Bot Manager

**Challenge**: Device fingerprinting + behavioral analysis

**Cookie**: `_abck` (sensor data), `bm_sz` (bot manager session)

**Bypass difficulty**: HIGH (requires sophisticated fingerprint spoofing)

**Techniques**:
- Use undetected-chromedriver or rebrowser-patches
- Avoid headless mode (easily detected)
- Add realistic mouse movements and scroll behavior
- Rotate devices (mobile vs desktop fingerprints)

```python
from playwright.async_api import async_playwright

async with async_playwright() as p:
    browser = await p.chromium.launch(
        headless=False,  # Akamai detects headless
        args=[
            '--disable-blink-features=AutomationControlled',
            '--disable-dev-shm-usage',
        ]
    )
    context = await browser.new_context(
        user_agent='Mozilla/5.0 ...',
        viewport={'width': 1920, 'height': 1080},
        device_scale_factor=1,
        is_mobile=False,
    )
    
    # Add realistic behavior
    page = await context.new_page()
    await page.goto(url)
    await page.mouse.move(100, 100)
    await page.mouse.move(200, 200)
    await page.evaluate('window.scrollTo(0, 200)')
```

### DataDome

**Challenge**: Behavioral analysis + device fingerprinting + IP reputation

**Cookie**: `datadome` (contains encrypted device fingerprint)

**Bypass difficulty**: HIGH

**Techniques**:
- Use residential proxies (datacenter IPs are instant block)
- Rotate User-Agents but keep consistent within session
- Add random delays between requests (mimics human behavior)
- Avoid parallel requests from same IP

## Anti-Detection Checklist

When harvesting WAF cookies via browser:

✅ **TLS Fingerprint**
- Use real browser (Playwright, Puppeteer, Selenium)
- Or use `curl_cffi` with `impersonate` parameter for HTTP-only requests

✅ **HTTP Headers**
- `User-Agent`: Match modern browser (Chrome 110+, Firefox 115+)
- `Accept`: `text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8`
- `Accept-Language`: Match proxy geo (`en-US` for US proxy)
- `Accept-Encoding`: `gzip, deflate, br, zstd`
- `Sec-Fetch-Site`, `Sec-Fetch-Mode`, `Sec-Fetch-Dest`: Present and correct
- `Referer`: Match site domain
- `Origin`: Match site domain (for POST requests)

✅ **Proxy Configuration**
- Use residential or ISP proxies for aggressive WAF
- Match proxy geo with Accept-Language header
- Test proxy reputation (some IPs are pre-banned)

✅ **Request Timing**
- Add jitter between requests: `time.sleep(random.uniform(1, 3))`
- Avoid burst patterns (10 requests in 1 second)
- Mimic human session: Homepage → wait → navigate to target

✅ **Browser Fingerprint** (for browser-based harvesting)
- Viewport size: `1920x1080` (most common desktop)
- Screen resolution: Match viewport or slightly larger
- Timezone: Match proxy location
- WebGL/Canvas fingerprint: Use real browser to avoid spoofing detection
- Avoid headless mode if possible (or patch `navigator.webdriver`)

## httpx Configuration for Post-Harvest Requests

After harvesting WAF cookies, use them in httpx client:

```python
import httpx

client = httpx.Client(
    http2=True,  # Modern browsers use HTTP/2
    timeout=30.0,
    headers={
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br, zstd',
        'Referer': 'https://example.com/',
        'Origin': 'https://example.com',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Dest': 'empty',
    }
)

# Merge cookies
client.cookies.update(user_session_cookies)
client.cookies.update(waf_cookies)

# Optional: Use proxy
if proxy_url:
    client = httpx.Client(..., proxy=proxy_url)

response = client.post('/api/user/sign_in', json={...})
```

## Debugging WAF Failures

When requests still fail after cookie harvesting:

1. **Compare browser request to script request**:
   ```bash
   # Browser request (copy as curl from devtools)
   curl 'https://example.com/api/user/self' \
     -H 'cookie: session=...; acw_tc=...' \
     -H 'user-agent: Mozilla/5.0 ...' \
     --http2
   
   # Script request
   curl 'https://example.com/api/user/self' \
     -H 'cookie: session=...; acw_tc=...' \
     -H 'user-agent: Mozilla/5.0 ...' \
     --http2
   ```
   
2. **Check cookie attributes**:
   - Domain: Should be `.example.com` (with leading dot for subdomains)
   - Path: Should match request path
   - SameSite: `None` or `Lax` (not `Strict`)
   - Secure: Must use HTTPS if flag is set

3. **Verify cookie freshness**:
   ```python
   import time
   harvest_time = time.time()
   # ... make request ...
   age = time.time() - harvest_time
   print(f"Cookie age: {age:.1f}s")  # Should be < 120s for most WAF
   ```

4. **Test IP binding**:
   - Harvest cookie with proxy A
   - Make request with proxy A → should work
   - Make request with proxy B → likely fails (IP-bound)

5. **Log full request/response**:
   ```python
   import logging
   logging.basicConfig(level=logging.DEBUG)
   # httpx will log full request/response
   ```

## Production Patterns

### Pattern 1: Lazy Cookie Harvesting

Harvest WAF cookies only when needed (on first request or after 403):

```python
class WAFClient:
    def __init__(self, base_url, user_cookies, waf_cookie_names):
        self.base_url = base_url
        self.user_cookies = user_cookies
        self.waf_cookie_names = waf_cookie_names
        self.waf_cookies = {}
        self.waf_cookies_expire = 0
    
    async def _refresh_waf_cookies(self):
        """Harvest fresh WAF cookies."""
        self.waf_cookies = await get_waf_cookies(
            f'{self.base_url}/login',
            self.waf_cookie_names
        )
        self.waf_cookies_expire = time.time() + 120  # 2 min TTL
    
    async def request(self, method, path, **kwargs):
        """Make request with auto-refresh WAF cookies."""
        if time.time() >= self.waf_cookies_expire:
            await self._refresh_waf_cookies()
        
        all_cookies = {**self.user_cookies, **self.waf_cookies}
        
        async with httpx.AsyncClient() as client:
            client.cookies.update(all_cookies)
            response = await client.request(method, f'{self.base_url}{path}', **kwargs)
            
            # Retry once if 403 (cookie might have expired early)
            if response.status_code == 403:
                await self._refresh_waf_cookies()
                client.cookies.update(self.waf_cookies)
                response = await client.request(method, f'{self.base_url}{path}', **kwargs)
            
            return response
```

### Pattern 2: Per-Provider Configuration

Different providers need different cookies and settings:

```python
WAF_CONFIGS = {
    'anyrouter': {
        'domain': 'https://anyrouter.top',
        'waf_cookie_names': ['acw_tc', 'cdn_sec_tc', 'acw_sc__v2'],
        'cookie_ttl': 120,
        'use_proxy': False,
    },
    'agentrouter': {
        'domain': 'https://agentrouter.org',
        'waf_cookie_names': ['acw_tc'],
        'cookie_ttl': 180,
        'use_proxy': True,  # Geo-restricted, needs proxy
    },
}

def get_waf_config(provider_name):
    return WAF_CONFIGS.get(provider_name, {
        'waf_cookie_names': [],
        'cookie_ttl': 120,
        'use_proxy': False,
    })
```

## Legal & Ethical Considerations

WAF bypass is legal when:
- Accessing public data you're entitled to view
- Automating your own account (terms of service, not law)
- Research or security testing with authorization

WAF bypass may be illegal when:
- Circumventing access controls to protected systems (CFAA)
- Scraping data you don't have rights to
- Causing service disruption (DDoS)

**Best practice**: Respect rate limits, avoid aggressive scraping, and consult legal counsel for commercial use.

## Related Playbooks

- `automated-login-solver.md` — Browser-based login flows
- `anti-detection.md` — Comprehensive fingerprint evasion
- `proxy-strategies.md` — Proxy selection and rotation
- `authenticated-session-mapping.md` — Combining session + WAF cookies for API mapping
